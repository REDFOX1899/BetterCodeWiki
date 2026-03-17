"""Voice tutor WebSocket handler bridging browser audio to Gemini Live API.

Uses BetterCodeWiki's existing RAG pipeline and wiki cache for grounding.
Follows the same WebSocket handler pattern as ``websocket_wiki.py``.
"""

import asyncio
import base64
import contextlib
import json
import logging
import os
from typing import Any, Dict, Optional

from fastapi import WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types as genai_types

from api.adk_agent import get_tool_declarations, handle_tool_call
from api.storage import get_storage

from api.logging_config import setup_logging

setup_logging()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Maximum characters of wiki/code context to inject into the live session
MAX_VOICE_CONTEXT_CHARS = 150_000

# Gemini Live model for real-time voice interaction
LIVE_MODEL = "gemini-2.0-flash-live-001"

# Audio format constants
AUDIO_SAMPLE_RATE_INPUT = 16000   # 16kHz PCM input from browser
AUDIO_SAMPLE_RATE_OUTPUT = 24000  # 24kHz PCM output from Gemini
AUDIO_MIME_TYPE = "audio/pcm"


# ---------------------------------------------------------------------------
# Tool declarations for Gemini function calling
# ---------------------------------------------------------------------------

_VOICE_TOOLS = [
    genai_types.Tool(function_declarations=[
        genai_types.FunctionDeclaration(
            name="search_code",
            description=(
                "Search the codebase for files or symbols matching a query. "
                "Returns relevant code snippets via RAG."
            ),
            parameters=genai_types.Schema(
                type="OBJECT",
                properties={
                    "query": genai_types.Schema(
                        type="STRING",
                        description="Search query: a filename, symbol name, or keyword to look for.",
                    ),
                },
                required=["query"],
            ),
        ),
        genai_types.FunctionDeclaration(
            name="get_wiki_page",
            description=(
                "Retrieve a specific wiki documentation page by its ID or title."
            ),
            parameters=genai_types.Schema(
                type="OBJECT",
                properties={
                    "page_id": genai_types.Schema(
                        type="STRING",
                        description="The ID or title of the wiki page to retrieve.",
                    ),
                },
                required=["page_id"],
            ),
        ),
        genai_types.FunctionDeclaration(
            name="explain_component",
            description=(
                "Provide a detailed explanation of a specific component, module, "
                "or architectural pattern found in the codebase."
            ),
            parameters=genai_types.Schema(
                type="OBJECT",
                properties={
                    "component_name": genai_types.Schema(
                        type="STRING",
                        description="Name of the component, module, class, or pattern to explain.",
                    ),
                },
                required=["component_name"],
            ),
        ),
        genai_types.FunctionDeclaration(
            name="list_files",
            description=(
                "List files in a directory of the codebase."
            ),
            parameters=genai_types.Schema(
                type="OBJECT",
                properties={
                    "directory": genai_types.Schema(
                        type="STRING",
                        description="Relative directory path within the repository (e.g. 'src/api').",
                    ),
                },
                required=["directory"],
            ),
        ),
    ]),
]


# ---------------------------------------------------------------------------
# Helper: load wiki context for the voice session
# ---------------------------------------------------------------------------

async def _load_wiki_context(owner: str, repo: str, repo_type: str,
                             language: str) -> Optional[str]:
    """Load wiki cache content to use as grounding context for the voice session.

    Parameters
    ----------
    owner : str
        Repository owner.
    repo : str
        Repository name.
    repo_type : str
        Repository hosting type (e.g. ``"github"``).
    language : str
        Language code (e.g. ``"en"``).

    Returns
    -------
    str or None
        Formatted wiki context string, or ``None`` if no cache exists.
    """
    storage = get_storage()
    data = await storage.get_wiki_cache(owner, repo, repo_type, language)
    if data is None:
        return None

    parts = []

    # Include file tree if available
    file_tree = data.get("file_tree", "") or data.get("tree", "")
    if file_tree:
        parts.append(f"## Directory Structure\n```\n{file_tree}\n```")

    # Include wiki page summaries
    pages = data.get("generated_pages", {})
    if pages:
        page_summaries = []
        for pid, page in pages.items():
            title = page.get("title", pid)
            content = page.get("content", "")
            # Truncate each page to keep total context manageable
            truncated = content[:3000] if len(content) > 3000 else content
            page_summaries.append(f"### {title}\n{truncated}")
        parts.append("## Wiki Pages\n" + "\n\n".join(page_summaries))

    if not parts:
        return None

    context = "\n\n".join(parts)
    if len(context) > MAX_VOICE_CONTEXT_CHARS:
        context = context[:MAX_VOICE_CONTEXT_CHARS] + "\n\n... (content truncated for context limit)"
        logger.info("Truncated voice context to %d chars for %s/%s", MAX_VOICE_CONTEXT_CHARS, owner, repo)

    return context


# ---------------------------------------------------------------------------
# Helper: build system instruction
# ---------------------------------------------------------------------------

def _build_system_instruction(wiki_context: Optional[str]) -> str:
    """Build the system instruction for the Gemini Live session.

    Parameters
    ----------
    wiki_context : str or None
        Optional wiki content to inject as grounding context.

    Returns
    -------
    str
        The full system instruction string.
    """
    base_instruction = (
        "You are a Live Code Tutor — a friendly, patient, and expert programming mentor. "
        "You help developers understand codebases through voice conversation.\n\n"
        "Guidelines:\n"
        "- Speak naturally and conversationally, as if pair-programming with a colleague.\n"
        "- When explaining code, be clear and concise. Use analogies when helpful.\n"
        "- Reference specific files and line numbers when discussing the codebase.\n"
        "- If the user asks about something not in the codebase context, say so honestly.\n"
        "- You can use the provided tools to search code, retrieve wiki pages, "
        "explain components, and list files.\n"
        "- Keep responses focused — voice conversations work best with shorter, "
        "digestible explanations.\n"
        "- Ask clarifying questions when the user's intent is ambiguous.\n"
    )

    if wiki_context:
        base_instruction += (
            "\n\nYou have access to the following codebase wiki and documentation. "
            "Use it to answer questions about the repository:\n\n"
            f"{wiki_context}"
        )

    return base_instruction


# ---------------------------------------------------------------------------
# WebSocket handler (matches websocket_wiki.py pattern)
# ---------------------------------------------------------------------------

async def handle_voice_tutor(websocket: WebSocket) -> None:
    """Bridge browser audio to Gemini Live API for real-time voice tutoring.

    This function follows the same handler pattern as
    ``websocket_wiki.handle_websocket_chat`` — it is a plain async function
    that receives an already-accepted-or-not WebSocket. Rate limiting and
    auth are handled by the wrapper in ``api.py``.

    Query Parameters (from websocket.query_params)
    -----------------------------------------------
    api_key : str
        User's Gemini API key (BYOK model).
    owner : str
        Repository owner (e.g. ``"facebook"``).
    repo : str
        Repository name (e.g. ``"react"``).
    repo_type : str
        Repository type, default ``"github"``.
    language : str
        Wiki language, default ``"en"``.

    Protocol
    --------
    Browser -> Server (JSON messages):
        - ``{"type": "audio", "data": "<base64-encoded PCM 16-bit 16kHz>"}``
        - ``{"type": "end_turn"}`` — signal end of user speech
        - ``{"type": "close"}`` — gracefully close the session

    Server -> Browser (JSON messages):
        - ``{"type": "audio", "data": "<base64-encoded PCM audio>"}``
        - ``{"type": "text", "data": "<transcript or text response>"}``
        - ``{"type": "tool_call", "name": "...", "args": {...}}``
        - ``{"type": "tool_result", "name": "...", "result": "..."}``
        - ``{"type": "turn_complete"}``
        - ``{"type": "error", "message": "..."}``
        - ``{"type": "connected"}`` — session established
    """
    # Extract query parameters
    api_key = websocket.query_params.get("api_key")
    owner = websocket.query_params.get("owner", "")
    repo_name = websocket.query_params.get("repo", "")
    repo_type = websocket.query_params.get("repo_type", "github")
    language = websocket.query_params.get("language", "en")

    # Validate required parameters
    if not api_key:
        await websocket.accept()
        await websocket.send_json({"type": "error", "message": "Missing api_key query parameter."})
        await websocket.close(code=1008, reason="Missing api_key")
        return

    if not owner or not repo_name:
        await websocket.accept()
        await websocket.send_json({"type": "error", "message": "Missing owner or repo query parameter."})
        await websocket.close(code=1008, reason="Missing owner/repo")
        return

    await websocket.accept()
    logger.info("Voice tutor WebSocket connected (owner=%s, repo=%s)", owner, repo_name)

    # Construct repo URL for RAG
    repo_url = f"https://{repo_type}.com/{owner}/{repo_name}"

    # Load wiki context for grounding
    wiki_context: Optional[str] = None
    try:
        wiki_context = await _load_wiki_context(owner, repo_name, repo_type, language)
        if wiki_context is None:
            await websocket.send_json({
                "type": "error",
                "message": f"No wiki found for {owner}/{repo_name}. Proceeding without wiki context.",
            })
    except Exception:
        logger.exception("Failed to load wiki context for %s/%s", owner, repo_name)
        await websocket.send_json({
            "type": "error",
            "message": "Failed to load wiki context. Proceeding without it.",
        })

    system_instruction = _build_system_instruction(wiki_context)

    # Build Gemini Live session config
    live_config = genai_types.LiveConnectConfig(
        response_modalities=["AUDIO", "TEXT"],
        system_instruction=genai_types.Content(
            parts=[genai_types.Part(text=system_instruction)],
        ),
        tools=_VOICE_TOOLS,
    )

    client = genai.Client(api_key=api_key)

    try:
        async with client.aio.live.connect(model=LIVE_MODEL, config=live_config) as session:
            await websocket.send_json({"type": "connected"})
            logger.info("Gemini Live session established for %s/%s", owner, repo_name)

            # Run browser->Gemini and Gemini->browser concurrently
            browser_to_gemini_task = asyncio.create_task(
                _relay_browser_to_gemini(websocket, session),
            )
            gemini_to_browser_task = asyncio.create_task(
                _relay_gemini_to_browser(
                    websocket, session,
                    repo_url=repo_url, owner=owner, repo=repo_name,
                    repo_type=repo_type, language=language,
                ),
            )

            # Wait for either task to complete (one finishing means session is done)
            done, pending = await asyncio.wait(
                [browser_to_gemini_task, gemini_to_browser_task],
                return_when=asyncio.FIRST_COMPLETED,
            )

            # Cancel the remaining task
            for task in pending:
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError, Exception):
                    await task

            # Re-raise any exceptions from completed tasks
            for task in done:
                exc = task.exception()
                if exc and not isinstance(exc, (WebSocketDisconnect, asyncio.CancelledError)):
                    raise exc

    except WebSocketDisconnect:
        logger.info("Voice tutor WebSocket disconnected normally (owner=%s, repo=%s)", owner, repo_name)
    except Exception as exc:
        logger.exception("Voice tutor session error (owner=%s, repo=%s)", owner, repo_name)
        with contextlib.suppress(Exception):
            await websocket.send_json({"type": "error", "message": f"Session error: {exc}"})
    finally:
        with contextlib.suppress(Exception):
            await websocket.close()
        logger.info("Voice tutor WebSocket closed (owner=%s, repo=%s)", owner, repo_name)


# ---------------------------------------------------------------------------
# Relay: browser -> Gemini
# ---------------------------------------------------------------------------

async def _relay_browser_to_gemini(
    websocket: WebSocket,
    session: Any,
) -> None:
    """Forward audio from the browser WebSocket to the Gemini Live session.

    Parameters
    ----------
    websocket : WebSocket
        The browser WebSocket connection.
    session : Any
        The active Gemini Live API session.
    """
    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")

            if msg_type == "audio":
                # Decode base64 PCM audio and send to Gemini
                audio_bytes = base64.b64decode(msg["data"])
                await session.send(
                    input=genai_types.LiveClientRealtimeInput(
                        media_chunks=[
                            genai_types.Blob(data=audio_bytes, mime_type=AUDIO_MIME_TYPE),
                        ],
                    ),
                )

            elif msg_type == "end_turn":
                # Signal end of user's turn
                await session.send(input=".", end_of_turn=True)

            elif msg_type == "close":
                logger.info("Browser requested voice session close")
                break

    except WebSocketDisconnect:
        logger.info("Browser disconnected during voice send relay")
        raise
    except Exception:
        logger.exception("Error in browser-to-Gemini voice relay")
        raise


# ---------------------------------------------------------------------------
# Relay: Gemini -> browser
# ---------------------------------------------------------------------------

async def _relay_gemini_to_browser(
    websocket: WebSocket,
    session: Any,
    repo_url: str,
    owner: str,
    repo: str,
    repo_type: str,
    language: str,
) -> None:
    """Forward audio/text from Gemini Live session to the browser WebSocket.

    Handles audio responses, text transcripts, tool calls, and turn
    completion signals. Tool calls are routed through ``adk_agent.handle_tool_call``
    which uses the existing RAG pipeline and wiki storage.

    Parameters
    ----------
    websocket : WebSocket
        The browser WebSocket connection.
    session : Any
        The active Gemini Live API session.
    repo_url : str
        Full URL of the repository for RAG lookups.
    owner : str
        Repository owner.
    repo : str
        Repository name.
    repo_type : str
        Repository hosting type.
    language : str
        Language code for the wiki.
    """
    try:
        while True:
            async for response in session.receive():
                server_content = response.server_content
                tool_call = response.tool_call

                if tool_call:
                    # Handle function calls from Gemini via adk_agent
                    for fc in tool_call.function_calls:
                        logger.info("Gemini voice tool call: %s(%s)", fc.name, fc.args)
                        await websocket.send_json({
                            "type": "tool_call",
                            "name": fc.name,
                            "args": dict(fc.args) if fc.args else {},
                        })

                        # Execute the tool via the adk_agent
                        result = await handle_tool_call(
                            function_name=fc.name,
                            args=dict(fc.args) if fc.args else {},
                            repo_url=repo_url,
                            owner=owner,
                            repo=repo,
                            repo_type=repo_type,
                            language=language,
                        )

                        # Truncate for voice readability
                        truncated_result = result[:2000] if result else "No result."

                        await websocket.send_json({
                            "type": "tool_result",
                            "name": fc.name,
                            "result": truncated_result,
                        })

                        # Send tool response back to Gemini
                        await session.send(
                            input=genai_types.LiveClientToolResponse(
                                function_responses=[
                                    genai_types.FunctionResponse(
                                        name=fc.name,
                                        response={"result": truncated_result},
                                    ),
                                ],
                            ),
                        )

                if server_content:
                    if server_content.model_turn:
                        for part in server_content.model_turn.parts:
                            if part.inline_data:
                                # Audio response — forward as base64
                                audio_b64 = base64.b64encode(part.inline_data.data).decode("utf-8")
                                await websocket.send_json({
                                    "type": "audio",
                                    "data": audio_b64,
                                    "mime_type": part.inline_data.mime_type or AUDIO_MIME_TYPE,
                                })
                            elif part.text:
                                # Text response (transcript)
                                await websocket.send_json({
                                    "type": "text",
                                    "data": part.text,
                                })

                    if server_content.turn_complete:
                        await websocket.send_json({"type": "turn_complete"})

    except WebSocketDisconnect:
        logger.info("Browser disconnected during voice receive relay")
        raise
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("Error in Gemini-to-browser voice relay")
        raise
