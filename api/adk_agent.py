"""ADK-style agent for the Voice Tutor.

Defines tool functions for searching code via RAG, retrieving wiki pages,
explaining components, and listing files. Tools integrate with BetterCodeWiki's
existing storage and RAG pipeline.
"""

import json
import logging
from typing import Any, Dict, List

from api.logging_config import setup_logging

setup_logging()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tool functions
# ---------------------------------------------------------------------------


async def search_code(query: str, repo_url: str, owner: str, repo: str,
                      repo_type: str = "github", language: str = "en") -> str:
    """Search the codebase for relevant code snippets using the existing RAG pipeline.

    Parameters
    ----------
    query : str
        Natural-language search query describing the code to find.
    repo_url : str
        Full URL of the repository (used as RAG session key).
    owner : str
        Repository owner.
    repo : str
        Repository name.
    repo_type : str
        Repository hosting type (e.g. ``"github"``).
    language : str
        Language code for the wiki (e.g. ``"en"``).

    Returns
    -------
    str
        Matching code snippets formatted as a readable string.
    """
    logger.info("search_code called: query=%r, repo_url=%r", query, repo_url)

    try:
        from api.rag import RAG
        from api.rag_session import rag_session_manager

        session_key = rag_session_manager.get_session_key(repo_url)
        rag = rag_session_manager.get(session_key)

        if rag is None:
            # Build a lightweight RAG instance for retrieval only
            rag = RAG()
            rag.prepare_retriever(repo_url, type=repo_type)
            rag_session_manager.put(session_key, rag)

        retrieved = rag.call(query, language=language)

        if isinstance(retrieved, tuple):
            # Error path: (RAGAnswer, [])
            return retrieved[0].answer if hasattr(retrieved[0], "answer") else str(retrieved[0])

        # Normal path: list of RetrieverOutput
        if retrieved and hasattr(retrieved[0], "documents") and retrieved[0].documents:
            snippets: List[str] = []
            for doc in retrieved[0].documents[:5]:
                meta = getattr(doc, "meta_data", {}) or {}
                file_path = meta.get("file_path", "unknown")
                text = getattr(doc, "text", str(doc))
                snippets.append(f"### {file_path}\n```\n{text[:2000]}\n```")
            return "\n\n".join(snippets) if snippets else f"No results found for '{query}'."

        return f"No results found for '{query}'."

    except Exception as e:
        logger.exception("Error in search_code tool")
        return f"Error searching code: {e}"


async def get_wiki_page(page_id: str, owner: str, repo: str,
                        repo_type: str = "github", language: str = "en") -> str:
    """Retrieve a specific wiki page from the cached wiki data.

    Parameters
    ----------
    page_id : str
        The ID or title of the wiki page to retrieve.
    owner : str
        Repository owner.
    repo : str
        Repository name.
    repo_type : str
        Repository hosting type.
    language : str
        Language code for the wiki.

    Returns
    -------
    str
        The wiki page content, or an error message if not found.
    """
    logger.info("get_wiki_page called: page_id=%r, owner=%r, repo=%r", page_id, owner, repo)

    try:
        from api.storage import get_storage

        storage = get_storage()
        data = await storage.get_wiki_cache(owner, repo, repo_type, language)

        if data is None:
            return f"No wiki cache found for {owner}/{repo}. Generate the wiki first."

        pages = data.get("generated_pages", {})
        page_id_lower = page_id.lower()

        # Try exact match first
        if page_id in pages:
            page = pages[page_id]
            title = page.get("title", page_id)
            content = page.get("content", "")
            return f"# {title}\n\n{content}"

        # Try case-insensitive match on ID or title
        for pid, page in pages.items():
            title = page.get("title", "")
            if pid.lower() == page_id_lower or title.lower() == page_id_lower:
                content = page.get("content", "")
                return f"# {title}\n\n{content}"

        # Try partial match
        for pid, page in pages.items():
            title = page.get("title", "")
            if page_id_lower in pid.lower() or page_id_lower in title.lower():
                content = page.get("content", "")
                return f"# {title}\n\n{content}"

        available = [p.get("title", pid) for pid, p in pages.items()]
        return (
            f"Page '{page_id}' not found. Available pages:\n"
            + "\n".join(f"- {t}" for t in available[:20])
        )

    except Exception as e:
        logger.exception("Error in get_wiki_page tool")
        return f"Error retrieving wiki page: {e}"


async def explain_component(component_name: str, repo_url: str, owner: str,
                            repo: str, repo_type: str = "github",
                            language: str = "en") -> str:
    """Explain a specific component or module from the codebase.

    Combines RAG code search with wiki page lookup to provide comprehensive
    context about the requested component.

    Parameters
    ----------
    component_name : str
        Name of the component, module, class, or pattern to explain.
    repo_url : str
        Full URL of the repository.
    owner : str
        Repository owner.
    repo : str
        Repository name.
    repo_type : str
        Repository hosting type.
    language : str
        Language code for the wiki.

    Returns
    -------
    str
        Relevant code and wiki context about the component.
    """
    logger.info("explain_component called: component_name=%r", component_name)

    parts: List[str] = []

    # Search code via RAG
    code_results = await search_code(
        query=component_name, repo_url=repo_url,
        owner=owner, repo=repo, repo_type=repo_type, language=language,
    )
    if code_results and "No results" not in code_results and "Error" not in code_results:
        parts.append(f"## Code References\n{code_results}")

    # Search wiki pages
    wiki_result = await get_wiki_page(
        page_id=component_name, owner=owner, repo=repo,
        repo_type=repo_type, language=language,
    )
    if wiki_result and "not found" not in wiki_result.lower() and "Error" not in wiki_result:
        parts.append(f"## Wiki Documentation\n{wiki_result}")

    if not parts:
        return f"No information found about '{component_name}' in the codebase or wiki."

    return "\n\n".join(parts)


async def list_files(directory: str, owner: str, repo: str,
                     repo_type: str = "github", language: str = "en") -> str:
    """List files in a directory of the codebase using the wiki cache file tree.

    Parameters
    ----------
    directory : str
        Relative directory path within the repository (e.g. ``"src/api"``).
    owner : str
        Repository owner.
    repo : str
        Repository name.
    repo_type : str
        Repository hosting type.
    language : str
        Language code for the wiki.

    Returns
    -------
    str
        A newline-separated list of file paths under the requested directory.
    """
    logger.info("list_files called: directory=%r, owner=%r, repo=%r", directory, owner, repo)

    try:
        from api.storage import get_storage

        storage = get_storage()
        data = await storage.get_wiki_cache(owner, repo, repo_type, language)

        if data is None:
            return f"No wiki cache found for {owner}/{repo}."

        # Try to get file tree from the cache
        file_tree = data.get("file_tree", "") or data.get("tree", "")

        if not file_tree:
            # Fall back to listing page IDs
            pages = data.get("generated_pages", {})
            return "File tree not available. Wiki pages:\n" + "\n".join(
                f"- {p.get('title', pid)}" for pid, p in pages.items()
            )

        dir_normalized = directory.rstrip("/")
        matching: List[str] = []
        for line in file_tree.splitlines():
            stripped = line.strip()
            if stripped.startswith(dir_normalized) or dir_normalized in stripped:
                matching.append(stripped)

        if not matching:
            # Show top-level listing
            return (
                f"No files found under '{directory}'. "
                f"Available paths:\n{file_tree[:3000]}"
            )

        return "\n".join(matching)

    except Exception as e:
        logger.exception("Error in list_files tool")
        return f"Error listing files: {e}"


# ---------------------------------------------------------------------------
# Tool declarations (Gemini function-calling format)
# ---------------------------------------------------------------------------

_TOOL_DECLARATIONS: List[Dict[str, Any]] = [
    {
        "name": "search_code",
        "description": "Search the codebase for relevant code snippets using RAG.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Natural-language search query describing the code to find.",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_wiki_page",
        "description": "Retrieve a specific wiki page by its ID or title.",
        "parameters": {
            "type": "object",
            "properties": {
                "page_id": {
                    "type": "string",
                    "description": "The ID or title of the wiki page to retrieve.",
                },
            },
            "required": ["page_id"],
        },
    },
    {
        "name": "explain_component",
        "description": (
            "Provide a detailed explanation of a specific component, module, "
            "or architectural pattern found in the codebase."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "component_name": {
                    "type": "string",
                    "description": "Name of the component, module, class, or pattern to explain.",
                },
            },
            "required": ["component_name"],
        },
    },
    {
        "name": "list_files",
        "description": "List files in a directory of the codebase.",
        "parameters": {
            "type": "object",
            "properties": {
                "directory": {
                    "type": "string",
                    "description": "Relative directory path within the repository (e.g. 'src/api').",
                },
            },
            "required": ["directory"],
        },
    },
]

# Map function names to callables for routing
_TOOL_REGISTRY: Dict[str, Any] = {
    "search_code": search_code,
    "get_wiki_page": get_wiki_page,
    "explain_component": explain_component,
    "list_files": list_files,
}


def get_tool_declarations() -> List[Dict[str, Any]]:
    """Return tool declarations in Gemini function-calling format."""
    return _TOOL_DECLARATIONS


async def handle_tool_call(
    function_name: str,
    args: Dict[str, Any],
    repo_url: str,
    owner: str,
    repo: str,
    repo_type: str = "github",
    language: str = "en",
) -> str:
    """Route a tool call to the appropriate function.

    Parameters
    ----------
    function_name : str
        Name of the tool function to invoke.
    args : dict
        Keyword arguments from Gemini function calling.
    repo_url : str
        Full URL of the repository.
    owner : str
        Repository owner.
    repo : str
        Repository name.
    repo_type : str
        Repository hosting type.
    language : str
        Language code for the wiki.

    Returns
    -------
    str
        The string result from the invoked tool function.
    """
    tool_fn = _TOOL_REGISTRY.get(function_name)
    if tool_fn is None:
        return f"Unknown tool function: {function_name}"

    # Inject context parameters that the tools need but Gemini doesn't send
    kwargs = dict(args)
    kwargs.setdefault("owner", owner)
    kwargs.setdefault("repo", repo)
    kwargs.setdefault("repo_type", repo_type)
    kwargs.setdefault("language", language)

    # Tools that need repo_url
    if function_name in ("search_code", "explain_component"):
        kwargs.setdefault("repo_url", repo_url)

    logger.info(
        "Handling tool call: function=%s, args=%s",
        function_name,
        json.dumps({k: v[:50] if isinstance(v, str) and len(v) > 50 else v for k, v in kwargs.items()}),
    )

    return await tool_fn(**kwargs)
