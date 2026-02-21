"""WebSocket handler for AI-powered diagram node explanations."""

import logging
import json
from typing import List, Optional

import google.generativeai as genai
from adalflow.components.model_client.ollama_client import OllamaClient
from adalflow.core.types import ModelType
from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from api.config import (
    get_model_config,
    configs,
    OPENROUTER_API_KEY,
    OPENAI_API_KEY,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
)
from api.openai_client import OpenAIClient
from api.openrouter_client import OpenRouterClient
from api.bedrock_client import BedrockClient
from api.azureai_client import AzureAIClient
from api.dashscope_client import DashscopeClient
from api.rag import RAG
from api.prompts import DIAGRAM_NODE_EXPLAIN_PROMPT

# Configure logging
from api.logging_config import setup_logging

setup_logging()
logger = logging.getLogger(__name__)


class DiagramExplainRequest(BaseModel):
    repo_url: str = Field(..., description="Repository URL")
    type: str = Field("github", description="Repository type")
    node_id: str = Field(..., description="Diagram node ID")
    node_label: str = Field(..., description="Node label text")
    node_technology: Optional[str] = Field(None, description="Technology slug")
    node_files: List[str] = Field(default_factory=list, description="Associated file paths")
    node_description: Optional[str] = Field(None, description="Node description from structured data")
    diagram_context: str = Field("", description="Brief diagram summary for context")
    provider: str = Field("google", description="AI provider")
    model: Optional[str] = Field(None, description="Model name override")
    language: str = Field("en", description="Response language")
    token: Optional[str] = Field(None, description="Access token for private repos")


async def handle_diagram_explain(websocket: WebSocket):
    """WebSocket endpoint that streams AI explanation for a diagram node.

    Follows the same pattern as handle_websocket_chat in websocket_wiki.py:
    1. Accept WebSocket connection
    2. Receive JSON request
    3. Build a focused prompt with node context
    4. Use RAG to retrieve relevant code context
    5. Stream the AI response back via WebSocket
    6. Close connection
    """
    await websocket.accept()

    try:
        # Receive and parse the request data
        request_data = await websocket.receive_json()
        request = DiagramExplainRequest(**request_data)

        logger.info(f"Diagram explain request for node '{request.node_label}' in {request.repo_url}")

        # Create a new RAG instance for this request
        try:
            request_rag = RAG(provider=request.provider, model=request.model)

            # If the node has associated files, use them as included_files filter
            included_files = None
            if request.node_files:
                included_files = list(request.node_files)
                logger.info(f"Focusing RAG on node files: {included_files}")

            request_rag.prepare_retriever(
                request.repo_url, request.type, request.token,
                included_files=included_files,
            )
            logger.info(f"Retriever prepared for {request.repo_url}")
        except ValueError as e:
            if "No valid documents with embeddings found" in str(e):
                logger.error(f"No valid embeddings found: {str(e)}")
                await websocket.send_text("Error: No valid document embeddings found. Please try again or check your repository content.")
                await websocket.close()
                return
            else:
                logger.error(f"ValueError preparing retriever: {str(e)}")
                await websocket.send_text(f"Error preparing retriever: {str(e)}")
                await websocket.close()
                return
        except Exception as e:
            logger.error(f"Error preparing retriever: {str(e)}")
            if "All embeddings should be of the same size" in str(e):
                await websocket.send_text("Error: Inconsistent embedding sizes detected. Please try again.")
            else:
                await websocket.send_text(f"Error preparing retriever: {str(e)}")
            await websocket.close()
            return

        # Build a RAG query focused on the node
        rag_query = f"{request.node_label}"
        if request.node_files:
            rag_query = f"Contexts related to {' '.join(request.node_files)}"

        # Retrieve relevant context
        context_text = ""
        try:
            retrieved_documents = request_rag(rag_query, language=request.language)
            if retrieved_documents and retrieved_documents[0].documents:
                documents = retrieved_documents[0].documents
                logger.info(f"Retrieved {len(documents)} documents for diagram explain")

                docs_by_file = {}
                for doc in documents:
                    file_path = doc.meta_data.get('file_path', 'unknown')
                    if file_path not in docs_by_file:
                        docs_by_file[file_path] = []
                    docs_by_file[file_path].append(doc)

                context_parts = []
                for file_path, docs in docs_by_file.items():
                    header = f"## File Path: {file_path}\n\n"
                    content = "\n\n".join([doc.text for doc in docs])
                    context_parts.append(f"{header}{content}")

                context_text = "\n\n" + "-" * 10 + "\n\n".join(context_parts)
            else:
                logger.warning("No documents retrieved from RAG for diagram explain")
        except Exception as e:
            logger.error(f"Error in RAG retrieval for diagram explain: {str(e)}")

        # Get language information
        language_code = request.language or configs["lang_config"]["default"]
        supported_langs = configs["lang_config"]["supported_languages"]
        language_name = supported_langs.get(language_code, "English")

        # Build the focused explanation prompt
        node_files_str = ", ".join(request.node_files) if request.node_files else "N/A"
        system_prompt = DIAGRAM_NODE_EXPLAIN_PROMPT.format(
            node_label=request.node_label,
            node_technology=request.node_technology or "N/A",
            node_description=request.node_description or "N/A",
            node_files=node_files_str,
            diagram_context=request.diagram_context or "N/A",
            language_name=language_name,
        )

        # Create the final prompt with context
        prompt = f"/no_think {system_prompt}\n\n"

        CONTEXT_START = "<START_OF_CONTEXT>"
        CONTEXT_END = "<END_OF_CONTEXT>"
        if context_text.strip():
            prompt += f"{CONTEXT_START}\n{context_text}\n{CONTEXT_END}\n\n"
        else:
            logger.info("No context available from RAG for diagram explain")
            prompt += "<note>Answering without retrieval augmentation.</note>\n\n"

        prompt += f"Explain the \"{request.node_label}\" component.\n\nAssistant: "

        model_config = get_model_config(request.provider, request.model)["model_kwargs"]

        # Provider selection — follows websocket_wiki.py exactly
        if request.provider == "ollama":
            prompt += " /no_think"

            model = OllamaClient()
            model_kwargs = {
                "model": model_config["model"],
                "stream": True,
                "options": {
                    "temperature": model_config["temperature"],
                    "top_p": model_config["top_p"],
                    "num_ctx": model_config["num_ctx"],
                },
            }

            api_kwargs = model.convert_inputs_to_api_kwargs(
                input=prompt,
                model_kwargs=model_kwargs,
                model_type=ModelType.LLM,
            )
        elif request.provider == "openrouter":
            logger.info(f"Using OpenRouter with model: {request.model}")
            if not OPENROUTER_API_KEY:
                logger.warning("OPENROUTER_API_KEY not configured, but continuing with request")

            model = OpenRouterClient()
            model_kwargs = {
                "model": request.model,
                "stream": True,
                "temperature": model_config["temperature"],
            }
            if "top_p" in model_config:
                model_kwargs["top_p"] = model_config["top_p"]

            api_kwargs = model.convert_inputs_to_api_kwargs(
                input=prompt,
                model_kwargs=model_kwargs,
                model_type=ModelType.LLM,
            )
        elif request.provider == "openai":
            logger.info(f"Using OpenAI with model: {request.model}")
            if not OPENAI_API_KEY:
                logger.warning("OPENAI_API_KEY not configured, but continuing with request")

            model = OpenAIClient()
            model_kwargs = {
                "model": request.model,
                "stream": True,
                "temperature": model_config["temperature"],
            }
            if "top_p" in model_config:
                model_kwargs["top_p"] = model_config["top_p"]

            api_kwargs = model.convert_inputs_to_api_kwargs(
                input=prompt,
                model_kwargs=model_kwargs,
                model_type=ModelType.LLM,
            )
        elif request.provider == "bedrock":
            logger.info(f"Using AWS Bedrock with model: {request.model}")
            if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
                logger.warning("AWS credentials not configured, but continuing with request")

            model = BedrockClient()
            model_kwargs = {"model": request.model}
            for key in ["temperature", "top_p"]:
                if key in model_config:
                    model_kwargs[key] = model_config[key]

            api_kwargs = model.convert_inputs_to_api_kwargs(
                input=prompt,
                model_kwargs=model_kwargs,
                model_type=ModelType.LLM,
            )
        elif request.provider == "azure":
            logger.info(f"Using Azure AI with model: {request.model}")

            model = AzureAIClient()
            model_kwargs = {
                "model": request.model,
                "stream": True,
                "temperature": model_config["temperature"],
                "top_p": model_config["top_p"],
            }

            api_kwargs = model.convert_inputs_to_api_kwargs(
                input=prompt,
                model_kwargs=model_kwargs,
                model_type=ModelType.LLM,
            )
        elif request.provider == "dashscope":
            logger.info(f"Using Dashscope with model: {request.model}")

            model = DashscopeClient()
            model_kwargs = {
                "model": request.model,
                "stream": True,
                "temperature": model_config["temperature"],
                "top_p": model_config["top_p"],
            }

            api_kwargs = model.convert_inputs_to_api_kwargs(
                input=prompt,
                model_kwargs=model_kwargs,
                model_type=ModelType.LLM,
            )
        else:
            # Google Generative AI (default provider)
            model = genai.GenerativeModel(
                model_name=model_config["model"],
                generation_config={
                    "temperature": model_config["temperature"],
                    "top_p": model_config["top_p"],
                    "top_k": model_config["top_k"],
                },
            )

        # Stream the response
        try:
            if request.provider == "ollama":
                response = await model.acall(api_kwargs=api_kwargs, model_type=ModelType.LLM)
                async for chunk in response:
                    text = None
                    if isinstance(chunk, dict):
                        text = chunk.get("message", {}).get("content") if isinstance(chunk.get("message"), dict) else chunk.get("message")
                    else:
                        message = getattr(chunk, "message", None)
                        if message is not None:
                            if isinstance(message, dict):
                                text = message.get("content")
                            else:
                                text = getattr(message, "content", None)

                    if not text:
                        text = getattr(chunk, 'response', None) or getattr(chunk, 'text', None)

                    if not text and hasattr(chunk, "__dict__"):
                        message = chunk.__dict__.get("message")
                        if isinstance(message, dict):
                            text = message.get("content")

                    if isinstance(text, str) and text and not text.startswith('model=') and not text.startswith('created_at='):
                        clean_text = text.replace('<think>', '').replace('</think>', '')
                        await websocket.send_text(clean_text)
                await websocket.close()

            elif request.provider == "openrouter":
                try:
                    logger.info("Making OpenRouter API call for diagram explain")
                    response = await model.acall(api_kwargs=api_kwargs, model_type=ModelType.LLM)
                    async for chunk in response:
                        await websocket.send_text(chunk)
                    await websocket.close()
                except Exception as e_openrouter:
                    logger.error(f"Error with OpenRouter API: {str(e_openrouter)}")
                    error_msg = f"\nError with OpenRouter API: {str(e_openrouter)}\n\nPlease check that you have set the OPENROUTER_API_KEY environment variable with a valid API key."
                    await websocket.send_text(error_msg)
                    await websocket.close()

            elif request.provider == "openai":
                try:
                    logger.info("Making OpenAI API call for diagram explain")
                    response = await model.acall(api_kwargs=api_kwargs, model_type=ModelType.LLM)
                    async for chunk in response:
                        choices = getattr(chunk, "choices", [])
                        if len(choices) > 0:
                            delta = getattr(choices[0], "delta", None)
                            if delta is not None:
                                text = getattr(delta, "content", None)
                                if text is not None:
                                    await websocket.send_text(text)
                    await websocket.close()
                except Exception as e_openai:
                    logger.error(f"Error with OpenAI API: {str(e_openai)}")
                    error_msg = f"\nError with OpenAI API: {str(e_openai)}\n\nPlease check that you have set the OPENAI_API_KEY environment variable with a valid API key."
                    await websocket.send_text(error_msg)
                    await websocket.close()

            elif request.provider == "bedrock":
                try:
                    logger.info("Making AWS Bedrock API call for diagram explain")
                    response = await model.acall(api_kwargs=api_kwargs, model_type=ModelType.LLM)
                    if isinstance(response, str):
                        await websocket.send_text(response)
                    else:
                        await websocket.send_text(str(response))
                    await websocket.close()
                except Exception as e_bedrock:
                    logger.error(f"Error with AWS Bedrock API: {str(e_bedrock)}")
                    error_msg = (
                        f"\nError with AWS Bedrock API: {str(e_bedrock)}\n\n"
                        "Please check that you have set the AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY "
                        "environment variables with valid credentials."
                    )
                    await websocket.send_text(error_msg)
                    await websocket.close()

            elif request.provider == "azure":
                try:
                    logger.info("Making Azure AI API call for diagram explain")
                    response = await model.acall(api_kwargs=api_kwargs, model_type=ModelType.LLM)
                    async for chunk in response:
                        choices = getattr(chunk, "choices", [])
                        if len(choices) > 0:
                            delta = getattr(choices[0], "delta", None)
                            if delta is not None:
                                text = getattr(delta, "content", None)
                                if text is not None:
                                    await websocket.send_text(text)
                    await websocket.close()
                except Exception as e_azure:
                    logger.error(f"Error with Azure AI API: {str(e_azure)}")
                    error_msg = f"\nError with Azure AI API: {str(e_azure)}\n\nPlease check that you have set the AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, and AZURE_OPENAI_VERSION environment variables with valid values."
                    await websocket.send_text(error_msg)
                    await websocket.close()

            elif request.provider == "dashscope":
                try:
                    logger.info("Making Dashscope API call for diagram explain")
                    response = await model.acall(api_kwargs=api_kwargs, model_type=ModelType.LLM)
                    async for text in response:
                        if text:
                            await websocket.send_text(text)
                    await websocket.close()
                except Exception as e_dashscope:
                    logger.error(f"Error with Dashscope API: {str(e_dashscope)}")
                    error_msg = (
                        f"\nError with Dashscope API: {str(e_dashscope)}\n\n"
                        "Please check that you have set the DASHSCOPE_API_KEY (and optionally "
                        "DASHSCOPE_WORKSPACE_ID) environment variables with valid values."
                    )
                    await websocket.send_text(error_msg)
                    await websocket.close()

            else:
                # Google Generative AI (default provider)
                response = model.generate_content(prompt, stream=True)
                for chunk in response:
                    if hasattr(chunk, 'text'):
                        await websocket.send_text(chunk.text)
                await websocket.close()

        except Exception as e_outer:
            logger.error(f"Error in diagram explain streaming response: {str(e_outer)}")
            await websocket.send_text(f"\nError: {str(e_outer)}")
            try:
                await websocket.close()
            except Exception:
                pass

    except WebSocketDisconnect:
        logger.info("Diagram explain WebSocket disconnected")
    except Exception as e:
        logger.error(f"Error in diagram explain WebSocket handler: {str(e)}")
        try:
            await websocket.send_text(json.dumps({"error": str(e)}))
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass
