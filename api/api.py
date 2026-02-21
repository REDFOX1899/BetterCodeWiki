import os
import logging
import time
from collections import defaultdict
from fastapi import FastAPI, HTTPException, Query, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from typing import List, Optional, Dict, Any, Literal
import json
from datetime import datetime
from pydantic import BaseModel, Field
import google.generativeai as genai
import asyncio
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from api.wiki_structure_parser import parse_wiki_structure, convert_json_to_xml

# Configure logging
from api.logging_config import setup_logging

setup_logging()
logger = logging.getLogger(__name__)

# --- Rate Limiting Setup ---

# slowapi limiter for HTTP endpoints (in-memory storage by default)
limiter = Limiter(key_func=get_remote_address)


class WebSocketRateLimiter:
    """
    In-memory per-IP rate limiter for WebSocket endpoints.

    slowapi does not support WebSocket connections, so this class provides
    equivalent functionality using a sliding-window counter approach.
    """

    def __init__(self):
        # Maps (ip, endpoint) -> list of timestamps
        self._hits: Dict[str, list] = defaultdict(list)

    def is_allowed(self, ip: str, endpoint: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
        """
        Check if a request from the given IP to the given endpoint is allowed.

        Returns:
            A tuple of (allowed: bool, retry_after_seconds: int).
            retry_after_seconds is 0 when allowed is True.
        """
        key = f"{ip}:{endpoint}"
        now = time.monotonic()
        cutoff = now - window_seconds

        # Prune old entries outside the window
        self._hits[key] = [t for t in self._hits[key] if t > cutoff]

        if len(self._hits[key]) >= max_requests:
            # Calculate how long until the oldest entry expires
            oldest = self._hits[key][0]
            retry_after = int(oldest + window_seconds - now) + 1
            return False, retry_after

        self._hits[key].append(now)
        return True, 0


ws_rate_limiter = WebSocketRateLimiter()


# Initialize FastAPI app
app = FastAPI(
    title="Streaming API",
    description="API for streaming chat completions"
)

# Register slowapi state and custom rate-limit exception handler
app.state.limiter = limiter


def _custom_rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Custom handler for HTTP 429 rate limit exceeded responses.

    Returns a JSON body with a clear error message and includes a
    Retry-After header indicating how many seconds the client should wait.
    slowapi's _inject_headers is used to set standard rate-limit headers
    including Retry-After.
    """
    limit_detail = str(exc.detail) if hasattr(exc, "detail") else "Rate limit exceeded"
    response = JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded",
            "detail": f"Too many requests. Limit is {limit_detail}. Please slow down and try again later."
        }
    )
    # Inject rate-limit headers (X-RateLimit-Limit, X-RateLimit-Remaining,
    # X-RateLimit-Reset, Retry-After) via slowapi's built-in mechanism
    response = request.app.state.limiter._inject_headers(
        response, request.state.view_rate_limit
    )
    return response


app.add_exception_handler(RateLimitExceeded, _custom_rate_limit_exceeded_handler)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Helper function to get adalflow root path
def get_adalflow_default_root_path():
    return os.path.expanduser(os.path.join("~", ".adalflow"))

# --- Pydantic Models ---
class WikiPage(BaseModel):
    """
    Model for a wiki page.
    """
    id: str
    title: str
    content: str
    filePaths: List[str]
    importance: str # Should ideally be Literal['high', 'medium', 'low']
    relatedPages: List[str]
    diagramData: Optional[List[Dict]] = None

class ProcessedProjectEntry(BaseModel):
    id: str  # Filename
    owner: str
    repo: str
    name: str  # owner/repo
    repo_type: str # Renamed from type to repo_type for clarity with existing models
    submittedAt: int # Timestamp
    language: str # Extracted from filename

class RepoInfo(BaseModel):
    owner: str
    repo: str
    type: str
    token: Optional[str] = None
    localPath: Optional[str] = None
    repoUrl: Optional[str] = None


class WikiSection(BaseModel):
    """
    Model for the wiki sections.
    """
    id: str
    title: str
    pages: List[str]
    subsections: Optional[List[str]] = None


class WikiStructureModel(BaseModel):
    """
    Model for the overall wiki structure.
    """
    id: str
    title: str
    description: str
    pages: List[WikiPage]
    sections: Optional[List[WikiSection]] = None
    rootSections: Optional[List[str]] = None

class WikiCacheData(BaseModel):
    """
    Model for the data to be stored in the wiki cache.
    """
    wiki_structure: WikiStructureModel
    generated_pages: Dict[str, WikiPage]
    repo_url: Optional[str] = None  #compatible for old cache
    repo: Optional[RepoInfo] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    template: Optional[str] = None

class WikiCacheRequest(BaseModel):
    """
    Model for the request body when saving wiki cache.
    """
    repo: RepoInfo
    language: str
    wiki_structure: WikiStructureModel
    generated_pages: Dict[str, WikiPage]
    provider: str
    model: str
    template: Optional[str] = None

class WikiExportRequest(BaseModel):
    """
    Model for requesting a wiki export.
    """
    repo_url: str = Field(..., description="URL of the repository")
    pages: List[WikiPage] = Field(..., description="List of wiki pages to export")
    format: Literal["markdown", "json"] = Field(..., description="Export format (markdown or json)")

class RegeneratePageRequest(BaseModel):
    """
    Model for requesting regeneration of a single wiki page.
    """
    owner: str = Field(..., description="Repository owner")
    repo: str = Field(..., description="Repository name")
    repo_type: str = Field("github", description="Repository type (github, gitlab, bitbucket)")
    page_id: str = Field(..., description="ID of the page to regenerate")
    language: str = Field("en", description="Language for content generation")
    provider: str = Field("google", description="LLM provider")
    model: Optional[str] = Field(None, description="Model name")
    custom_model: Optional[str] = Field(None, description="Custom model identifier")
    access_token: Optional[str] = Field(None, description="Access token for private repos")
    repo_url: Optional[str] = Field(None, description="Full repository URL")

# --- Model Configuration Models ---
class Model(BaseModel):
    """
    Model for LLM model configuration
    """
    id: str = Field(..., description="Model identifier")
    name: str = Field(..., description="Display name for the model")

class Provider(BaseModel):
    """
    Model for LLM provider configuration
    """
    id: str = Field(..., description="Provider identifier")
    name: str = Field(..., description="Display name for the provider")
    models: List[Model] = Field(..., description="List of available models for this provider")
    supportsCustomModel: Optional[bool] = Field(False, description="Whether this provider supports custom models")

class ModelConfig(BaseModel):
    """
    Model for the entire model configuration
    """
    providers: List[Provider] = Field(..., description="List of available model providers")
    defaultProvider: str = Field(..., description="ID of the default provider")

class AuthorizationConfig(BaseModel):
    code: str = Field(..., description="Authorization code")

from api.config import configs, WIKI_AUTH_MODE, WIKI_AUTH_CODE
from api.diagram_extract import extract_diagram_data

# Load wiki templates configuration
_WIKI_TEMPLATES_PATH = os.path.join(os.path.dirname(__file__), "config", "wiki_templates.json")
_wiki_templates_cache: Optional[Dict[str, Any]] = None

def _load_wiki_templates() -> Dict[str, Any]:
    global _wiki_templates_cache
    if _wiki_templates_cache is None:
        with open(_WIKI_TEMPLATES_PATH, "r", encoding="utf-8") as f:
            _wiki_templates_cache = json.load(f)
    return _wiki_templates_cache

@app.get("/api/wiki_templates")
async def get_wiki_templates():
    """Return available wiki template configurations."""
    try:
        return _load_wiki_templates()
    except Exception as e:
        logger.error(f"Error loading wiki templates: {e}")
        raise HTTPException(status_code=500, detail="Failed to load wiki templates")

@app.get("/lang/config")
async def get_lang_config():
    return configs["lang_config"]

@app.get("/auth/status")
async def get_auth_status():
    """
    Check if authentication is required for the wiki.
    """
    return {"auth_required": WIKI_AUTH_MODE}

@app.post("/auth/validate")
async def validate_auth_code(request: AuthorizationConfig):
    """
    Check authorization code.
    """
    return {"success": WIKI_AUTH_CODE == request.code}

@app.get("/models/config", response_model=ModelConfig)
async def get_model_config():
    """
    Get available model providers and their models.

    This endpoint returns the configuration of available model providers and their
    respective models that can be used throughout the application.

    Returns:
        ModelConfig: A configuration object containing providers and their models
    """
    try:
        logger.info("Fetching model configurations")

        # Create providers from the config file
        providers = []
        default_provider = configs.get("default_provider", "google")

        # Add provider configuration based on config.py
        for provider_id, provider_config in configs["providers"].items():
            models = []
            # Add models from config
            for model_id in provider_config["models"].keys():
                # Get a more user-friendly display name if possible
                models.append(Model(id=model_id, name=model_id))

            # Add provider with its models
            providers.append(
                Provider(
                    id=provider_id,
                    name=f"{provider_id.capitalize()}",
                    supportsCustomModel=provider_config.get("supportsCustomModel", False),
                    models=models
                )
            )

        # Create and return the full configuration
        config = ModelConfig(
            providers=providers,
            defaultProvider=default_provider
        )
        return config

    except Exception as e:
        logger.error(f"Error creating model configuration: {str(e)}")
        # Return some default configuration in case of error
        return ModelConfig(
            providers=[
                Provider(
                    id="google",
                    name="Google",
                    supportsCustomModel=True,
                    models=[
                        Model(id="gemini-2.5-flash", name="Gemini 2.5 Flash")
                    ]
                )
            ],
            defaultProvider="google"
        )

@app.post("/export/wiki")
async def export_wiki(request: WikiExportRequest):
    """
    Export wiki content as Markdown or JSON.

    Args:
        request: The export request containing wiki pages and format

    Returns:
        A downloadable file in the requested format
    """
    try:
        logger.info(f"Exporting wiki for {request.repo_url} in {request.format} format")

        # Extract repository name from URL for the filename
        repo_parts = request.repo_url.rstrip('/').split('/')
        repo_name = repo_parts[-1] if len(repo_parts) > 0 else "wiki"

        # Get current timestamp for the filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if request.format == "markdown":
            # Generate Markdown content
            content = generate_markdown_export(request.repo_url, request.pages)
            filename = f"{repo_name}_wiki_{timestamp}.md"
            media_type = "text/markdown"
        else:  # JSON format
            # Generate JSON content
            content = generate_json_export(request.repo_url, request.pages)
            filename = f"{repo_name}_wiki_{timestamp}.json"
            media_type = "application/json"

        # Create response with appropriate headers for file download
        response = Response(
            content=content,
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

        return response

    except Exception as e:
        error_msg = f"Error exporting wiki: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/local_repo/structure")
async def get_local_repo_structure(path: str = Query(None, description="Path to local repository")):
    """Return the file tree and README content for a local repository."""
    if not path:
        return JSONResponse(
            status_code=400,
            content={"error": "No path provided. Please provide a 'path' query parameter."}
        )

    if not os.path.isdir(path):
        return JSONResponse(
            status_code=404,
            content={"error": f"Directory not found: {path}"}
        )

    try:
        logger.info(f"Processing local repository at: {path}")
        file_tree_lines = []
        readme_content = ""

        for root, dirs, files in os.walk(path):
            # Exclude hidden dirs/files and virtual envs
            dirs[:] = [d for d in dirs if not d.startswith('.') and d != '__pycache__' and d != 'node_modules' and d != '.venv']
            for file in files:
                if file.startswith('.') or file == '__init__.py' or file == '.DS_Store':
                    continue
                rel_dir = os.path.relpath(root, path)
                rel_file = os.path.join(rel_dir, file) if rel_dir != '.' else file
                file_tree_lines.append(rel_file)
                # Find README.md (case-insensitive)
                if file.lower() == 'readme.md' and not readme_content:
                    try:
                        with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                            readme_content = f.read()
                    except Exception as e:
                        logger.warning(f"Could not read README.md: {str(e)}")
                        readme_content = ""

        file_tree_str = '\n'.join(sorted(file_tree_lines))
        return {"file_tree": file_tree_str, "readme": readme_content}
    except Exception as e:
        logger.error(f"Error processing local repository: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Error processing local repository: {str(e)}"}
        )

def generate_markdown_export(repo_url: str, pages: List[WikiPage]) -> str:
    """
    Generate Markdown export of wiki pages.

    Args:
        repo_url: The repository URL
        pages: List of wiki pages

    Returns:
        Markdown content as string
    """
    # Start with metadata
    markdown = f"# Wiki Documentation for {repo_url}\n\n"
    markdown += f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"

    # Add table of contents
    markdown += "## Table of Contents\n\n"
    for page in pages:
        markdown += f"- [{page.title}](#{page.id})\n"
    markdown += "\n"

    # Add each page
    for page in pages:
        markdown += f"<a id='{page.id}'></a>\n\n"
        markdown += f"## {page.title}\n\n"



        # Add related pages
        if page.relatedPages and len(page.relatedPages) > 0:
            markdown += "### Related Pages\n\n"
            related_titles = []
            for related_id in page.relatedPages:
                # Find the title of the related page
                related_page = next((p for p in pages if p.id == related_id), None)
                if related_page:
                    related_titles.append(f"[{related_page.title}](#{related_id})")

            if related_titles:
                markdown += "Related topics: " + ", ".join(related_titles) + "\n\n"

        # Add page content
        markdown += f"{page.content}\n\n"
        markdown += "---\n\n"

    return markdown

def generate_json_export(repo_url: str, pages: List[WikiPage]) -> str:
    """
    Generate JSON export of wiki pages.

    Args:
        repo_url: The repository URL
        pages: List of wiki pages

    Returns:
        JSON content as string
    """
    # Create a dictionary with metadata and pages
    export_data = {
        "metadata": {
            "repository": repo_url,
            "generated_at": datetime.now().isoformat(),
            "page_count": len(pages)
        },
        "pages": [page.model_dump() for page in pages]
    }

    # Convert to JSON string with pretty formatting
    return json.dumps(export_data, indent=2)

# Import the simplified chat implementation
from api.simple_chat import chat_completions_stream as _original_chat_completions_stream
from api.websocket_wiki import handle_websocket_chat as _original_handle_websocket_chat
from api.diagram_explain import handle_diagram_explain as _original_handle_diagram_explain


# --- Rate-limited endpoint wrappers ---

# Wiki generation WebSocket endpoints: 5 requests per hour per IP
_WS_WIKI_MAX_REQUESTS = 5
_WS_WIKI_WINDOW_SECONDS = 3600  # 1 hour

# Chat/ask HTTP endpoint: 30 requests per hour per IP
_CHAT_RATE_LIMIT = "30/hour"

# Chat/ask WebSocket endpoint: 30 requests per hour per IP
_WS_CHAT_MAX_REQUESTS = 30
_WS_CHAT_WINDOW_SECONDS = 3600  # 1 hour


@limiter.limit(_CHAT_RATE_LIMIT)
async def chat_completions_stream(request: Request):
    """
    Rate-limited wrapper for the chat completions streaming endpoint.

    Applies a limit of 30 requests per hour per IP address via slowapi.
    The underlying handler reads the JSON body from the Request object.
    """
    from api.simple_chat import ChatCompletionRequest
    body = await request.json()
    chat_request = ChatCompletionRequest(**body)
    return await _original_chat_completions_stream(chat_request)


async def rate_limited_websocket_chat(websocket: WebSocket):
    """
    Rate-limited wrapper for the /ws/chat WebSocket endpoint.

    Checks the per-IP rate limit (30 requests/hour) before accepting the
    connection. If the limit is exceeded, sends a 429 close code with
    a Retry-After message and closes the WebSocket.
    """
    client_ip = websocket.client.host if websocket.client else "unknown"
    allowed, retry_after = ws_rate_limiter.is_allowed(
        client_ip, "/ws/chat", _WS_CHAT_MAX_REQUESTS, _WS_CHAT_WINDOW_SECONDS
    )
    if not allowed:
        logger.warning(f"WebSocket rate limit exceeded for {client_ip} on /ws/chat")
        await websocket.accept()
        await websocket.send_json({
            "error": "Rate limit exceeded",
            "detail": f"Too many requests. You are limited to {_WS_CHAT_MAX_REQUESTS} requests per hour. Please retry after {retry_after} seconds.",
            "retry_after": retry_after
        })
        await websocket.close(code=1008, reason="Rate limit exceeded")
        return
    await _original_handle_websocket_chat(websocket)


async def rate_limited_diagram_explain(websocket: WebSocket):
    """
    Rate-limited wrapper for the /ws/diagram/explain WebSocket endpoint.

    Checks the per-IP rate limit (5 requests/hour) before accepting the
    connection. If the limit is exceeded, sends a 429 close code with
    a Retry-After message and closes the WebSocket.
    """
    client_ip = websocket.client.host if websocket.client else "unknown"
    allowed, retry_after = ws_rate_limiter.is_allowed(
        client_ip, "/ws/diagram/explain", _WS_WIKI_MAX_REQUESTS, _WS_WIKI_WINDOW_SECONDS
    )
    if not allowed:
        logger.warning(f"WebSocket rate limit exceeded for {client_ip} on /ws/diagram/explain")
        await websocket.accept()
        await websocket.send_json({
            "error": "Rate limit exceeded",
            "detail": f"Too many requests. You are limited to {_WS_WIKI_MAX_REQUESTS} requests per hour. Please retry after {retry_after} seconds.",
            "retry_after": retry_after
        })
        await websocket.close(code=1008, reason="Rate limit exceeded")
        return
    await _original_handle_diagram_explain(websocket)


# Add the rate-limited chat_completions_stream endpoint to the main app
app.add_api_route("/chat/completions/stream", chat_completions_stream, methods=["POST"])

# Add the rate-limited WebSocket endpoints
app.add_websocket_route("/ws/chat", rate_limited_websocket_chat)
app.add_websocket_route("/ws/diagram/explain", rate_limited_diagram_explain)


# --- Wiki Structure Parsing Endpoint ---

class ParseStructureRequest(BaseModel):
    """Request body for the wiki structure parsing endpoint."""
    raw_text: str = Field(..., description="Raw LLM response text containing wiki structure (XML or JSON)")
    output_format: Literal["json", "xml"] = Field("json", description="Desired output format: 'json' for normalized dict, 'xml' for XML string")


@app.post("/api/parse_wiki_structure")
async def parse_wiki_structure_endpoint(request: ParseStructureRequest):
    """
    Parse a raw LLM response into a normalized wiki structure.

    Tries XML parsing first, then JSON parsing, then regex extraction.
    Returns either a normalized JSON dict or an XML string depending on
    the requested output_format.

    This endpoint allows the frontend to delegate robust parsing to the
    backend, handling cases where LLMs return malformed XML or JSON
    instead of the requested XML format.
    """
    try:
        structure = parse_wiki_structure(request.raw_text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if request.output_format == "xml":
        xml_str = convert_json_to_xml(structure)
        return Response(content=xml_str, media_type="application/xml")

    return JSONResponse(content=structure)


# --- Wiki Cache Helper Functions ---

WIKI_CACHE_DIR = os.path.join(get_adalflow_default_root_path(), "wikicache")
os.makedirs(WIKI_CACHE_DIR, exist_ok=True)

def get_wiki_cache_path(owner: str, repo: str, repo_type: str, language: str) -> str:
    """Generates the file path for a given wiki cache."""
    filename = f"deepwiki_cache_{repo_type}_{owner}_{repo}_{language}.json"
    return os.path.join(WIKI_CACHE_DIR, filename)

async def read_wiki_cache(owner: str, repo: str, repo_type: str, language: str) -> Optional[WikiCacheData]:
    """Reads wiki cache data from the file system."""
    cache_path = get_wiki_cache_path(owner, repo, repo_type, language)
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return WikiCacheData(**data)
        except Exception as e:
            logger.error(f"Error reading wiki cache from {cache_path}: {e}")
            return None
    return None

async def save_wiki_cache(data: WikiCacheRequest) -> bool:
    """Saves wiki cache data to the file system."""
    cache_path = get_wiki_cache_path(data.repo.owner, data.repo.repo, data.repo.type, data.language)
    logger.info(f"Attempting to save wiki cache. Path: {cache_path}")
    try:
        # Extract structured diagram data from page content if present
        for page in data.generated_pages.values():
            if page.diagramData is None and page.content:
                try:
                    diagram_data = extract_diagram_data(page.content)
                    if diagram_data:
                        page.diagramData = diagram_data
                except Exception as e:
                    logger.warning(f"Failed to extract diagram data for page {page.id}: {e}")

        payload = WikiCacheData(
            wiki_structure=data.wiki_structure,
            generated_pages=data.generated_pages,
            repo=data.repo,
            provider=data.provider,
            model=data.model,
            template=data.template
        )
        # Log size of data to be cached for debugging (avoid logging full content if large)
        try:
            payload_json = payload.model_dump_json()
            payload_size = len(payload_json.encode('utf-8'))
            logger.info(f"Payload prepared for caching. Size: {payload_size} bytes.")
        except Exception as ser_e:
            logger.warning(f"Could not serialize payload for size logging: {ser_e}")


        logger.info(f"Writing cache file to: {cache_path}")
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(payload.model_dump(), f, indent=2)
        logger.info(f"Wiki cache successfully saved to {cache_path}")
        return True
    except IOError as e:
        logger.error(f"IOError saving wiki cache to {cache_path}: {e.strerror} (errno: {e.errno})", exc_info=True)
        return False
    except Exception as e:
        logger.error(f"Unexpected error saving wiki cache to {cache_path}: {e}", exc_info=True)
        return False

# --- Wiki Cache API Endpoints ---

@app.get("/api/wiki_cache", response_model=Optional[WikiCacheData])
async def get_cached_wiki(
    owner: str = Query(..., description="Repository owner"),
    repo: str = Query(..., description="Repository name"),
    repo_type: str = Query(..., description="Repository type (e.g., github, gitlab)"),
    language: str = Query(..., description="Language of the wiki content")
):
    """
    Retrieves cached wiki data (structure and generated pages) for a repository.
    """
    # Language validation
    supported_langs = configs["lang_config"]["supported_languages"]
    if not supported_langs.__contains__(language):
        language = configs["lang_config"]["default"]

    logger.info(f"Attempting to retrieve wiki cache for {owner}/{repo} ({repo_type}), lang: {language}")
    cached_data = await read_wiki_cache(owner, repo, repo_type, language)
    if cached_data:
        return cached_data
    else:
        # Return 200 with null body if not found, as frontend expects this behavior
        # Or, raise HTTPException(status_code=404, detail="Wiki cache not found") if preferred
        logger.info(f"Wiki cache not found for {owner}/{repo} ({repo_type}), lang: {language}")
        return None

@app.post("/api/wiki_cache")
async def store_wiki_cache(request_data: WikiCacheRequest):
    """
    Stores generated wiki data (structure and pages) to the server-side cache.
    """
    # Language validation
    supported_langs = configs["lang_config"]["supported_languages"]

    if not supported_langs.__contains__(request_data.language):
        request_data.language = configs["lang_config"]["default"]

    logger.info(f"Attempting to save wiki cache for {request_data.repo.owner}/{request_data.repo.repo} ({request_data.repo.type}), lang: {request_data.language}")
    success = await save_wiki_cache(request_data)
    if success:
        return {"message": "Wiki cache saved successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to save wiki cache")

@app.delete("/api/wiki_cache")
async def delete_wiki_cache(
    owner: str = Query(..., description="Repository owner"),
    repo: str = Query(..., description="Repository name"),
    repo_type: str = Query(..., description="Repository type (e.g., github, gitlab)"),
    language: str = Query(..., description="Language of the wiki content"),
    authorization_code: Optional[str] = Query(None, description="Authorization code")
):
    """
    Deletes a specific wiki cache from the file system.
    """
    # Language validation
    supported_langs = configs["lang_config"]["supported_languages"]
    if not supported_langs.__contains__(language):
        raise HTTPException(status_code=400, detail="Language is not supported")

    if WIKI_AUTH_MODE:
        logger.info("check the authorization code")
        if not authorization_code or WIKI_AUTH_CODE != authorization_code:
            raise HTTPException(status_code=401, detail="Authorization code is invalid")

    logger.info(f"Attempting to delete wiki cache for {owner}/{repo} ({repo_type}), lang: {language}")
    cache_path = get_wiki_cache_path(owner, repo, repo_type, language)

    if os.path.exists(cache_path):
        try:
            os.remove(cache_path)
            logger.info(f"Successfully deleted wiki cache: {cache_path}")
            return {"message": f"Wiki cache for {owner}/{repo} ({language}) deleted successfully"}
        except Exception as e:
            logger.error(f"Error deleting wiki cache {cache_path}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete wiki cache: {str(e)}")
    else:
        logger.warning(f"Wiki cache not found, cannot delete: {cache_path}")
        raise HTTPException(status_code=404, detail="Wiki cache not found")

@app.post("/api/wiki/regenerate_page")
@limiter.limit("10/hour")
async def regenerate_wiki_page(request: Request, body: RegeneratePageRequest):
    """
    Regenerate a single wiki page without regenerating the entire wiki.

    Reads the existing cached wiki to get the page's context and file associations,
    calls the LLM to regenerate just that one page, updates the cached wiki JSON
    with the new page content (preserving all other pages), and returns the
    regenerated page content.
    """
    logger.info(f"Regenerate page request: {body.owner}/{body.repo} page={body.page_id}")

    # Read existing cache
    cached = await read_wiki_cache(body.owner, body.repo, body.repo_type, body.language)
    if not cached:
        raise HTTPException(status_code=404, detail="No cached wiki found for this repository. Generate the full wiki first.")

    # Find the page in the cache
    page_data = cached.generated_pages.get(body.page_id)
    if not page_data:
        raise HTTPException(status_code=404, detail=f"Page '{body.page_id}' not found in cached wiki.")

    # Find the page in the wiki structure for file paths
    structure_page = None
    for p in cached.wiki_structure.pages:
        if p.id == body.page_id:
            structure_page = p
            break

    file_paths = page_data.filePaths or (structure_page.filePaths if structure_page else [])
    page_title = page_data.title

    # Build the repo URL
    repo_url = body.repo_url or ""
    if not repo_url and cached.repo:
        repo_url = cached.repo.repoUrl or ""
    if not repo_url:
        type_hosts = {"github": "https://github.com", "gitlab": "https://gitlab.com", "bitbucket": "https://bitbucket.org"}
        base = type_hosts.get(body.repo_type, "https://github.com")
        repo_url = f"{base}/{body.owner}/{body.repo}"

    # Build file URL helper
    def generate_file_url(file_path: str) -> str:
        if body.repo_type == "github":
            return f"{repo_url}/blob/main/{file_path}"
        elif body.repo_type == "gitlab":
            return f"{repo_url}/-/blob/main/{file_path}"
        elif body.repo_type == "bitbucket":
            return f"{repo_url}/src/main/{file_path}"
        return file_path

    # Build the same prompt used by the frontend for page generation
    language_name = {
        "en": "English", "ja": "Japanese (\u65e5\u672c\u8a9e)", "zh": "Mandarin Chinese (\u4e2d\u6587)",
        "zh-tw": "Traditional Chinese (\u7e41\u9ad4\u4e2d\u6587)", "es": "Spanish (Espa\u00f1ol)",
        "kr": "Korean (\ud55c\uad6d\uc5b4)", "vi": "Vietnamese (Ti\u1ebfng Vi\u1ec7t)",
        "pt-br": "Brazilian Portuguese (Portugu\u00eas Brasileiro)",
        "fr": "Fran\u00e7ais (French)", "ru": "\u0420\u0443\u0441\u0441\u043a\u0438\u0439 (Russian)",
    }.get(body.language, "English")

    file_links = "\n".join(f"- [{fp}]({generate_file_url(fp)})" for fp in file_paths)

    prompt_content = f"""You are an expert technical writer and software architect.
Your task is to generate a comprehensive and accurate technical wiki page in Markdown format about a specific feature, system, or module within a given software project.

You will be given:
1. The "[WIKI_PAGE_TOPIC]" for the page you need to create.
2. A list of "[RELEVANT_SOURCE_FILES]" from the project that you MUST use as the sole basis for the content.

CRITICAL STARTING INSTRUCTION:
The very first thing on the page MUST be a `<details>` block listing ALL the `[RELEVANT_SOURCE_FILES]` you used to generate the content.
Format it exactly like this:
<details>
<summary>Relevant source files</summary>

The following files were used as context for generating this wiki page:

{file_links}
</details>

Immediately after the `<details>` block, the main title of the page should be a H1 Markdown heading: `# {page_title}`.

Based ONLY on the content of the `[RELEVANT_SOURCE_FILES]`:

1.  **Introduction:** Start with a concise introduction explaining the purpose and overview of "{page_title}".
2.  **Detailed Sections:** Break down "{page_title}" into logical sections using H2 and H3 headings.
3.  **Mermaid Diagrams:** Use Mermaid diagrams to visually represent architectures and flows. Use "graph TD" directive.
4.  **Tables:** Use Markdown tables to summarize key information.
5.  **Source Citations:** Cite source files using: `Sources: [filename.ext:start_line-end_line]()`.
6.  **Technical Accuracy:** All information must be derived from the source files.

IMPORTANT: Generate the content in {language_name} language.
"""

    # Call the LLM via the existing RAG infrastructure
    from api.rag import RAG
    from api.config import get_model_config
    from adalflow.core.types import ModelType

    model_to_use = body.custom_model or body.model
    model_config = get_model_config(body.provider, model_to_use)["model_kwargs"]

    # Try to set up RAG for context
    context_text = ""
    try:
        request_rag = RAG(provider=body.provider, model=model_to_use)
        request_rag.prepare_retriever(repo_url, body.repo_type, body.access_token)
        retrieved = request_rag(prompt_content, language=body.language)
        if retrieved and retrieved[0].documents:
            docs_by_file = {}
            for doc in retrieved[0].documents:
                fp = doc.meta_data.get("file_path", "unknown")
                docs_by_file.setdefault(fp, []).append(doc)
            parts = []
            for fp, docs in docs_by_file.items():
                parts.append(f"## File Path: {fp}\n\n" + "\n\n".join(d.text for d in docs))
            context_text = "\n\n----------\n\n".join(parts)
    except Exception as e:
        logger.warning(f"RAG setup/retrieval failed during regeneration: {e}")

    system_prompt = f"""You are an expert technical writer generating wiki documentation for the repository {body.owner}/{body.repo}.
You MUST respond in {language_name} language."""

    full_prompt = f"/no_think {system_prompt}\n\n"
    if context_text.strip():
        full_prompt += f"<START_OF_CONTEXT>\n{context_text}\n<END_OF_CONTEXT>\n\n"
    else:
        full_prompt += "<note>Answering without retrieval augmentation.</note>\n\n"
    full_prompt += f"<query>\n{prompt_content}\n</query>\n\nAssistant: "

    # Call the LLM (non-streaming)
    import google.generativeai as genai_mod
    from adalflow.components.model_client.ollama_client import OllamaClient as OllamaClientLib

    content = ""
    try:
        if body.provider == "google":
            gmodel = genai_mod.GenerativeModel(
                model_name=model_config["model"],
                generation_config={
                    "temperature": model_config["temperature"],
                    "top_p": model_config["top_p"],
                    "top_k": model_config["top_k"],
                },
            )
            response = gmodel.generate_content(full_prompt, stream=False)
            content = response.text
        elif body.provider == "openai":
            from api.openai_client import OpenAIClient as OAI
            client = OAI()
            mk = {"model": model_to_use, "stream": False, "temperature": model_config["temperature"]}
            if "top_p" in model_config:
                mk["top_p"] = model_config["top_p"]
            api_kwargs = client.convert_inputs_to_api_kwargs(input=full_prompt, model_kwargs=mk, model_type=ModelType.LLM)
            resp = await client.acall(api_kwargs=api_kwargs, model_type=ModelType.LLM)
            if hasattr(resp, "choices") and resp.choices:
                content = resp.choices[0].message.content or ""
            else:
                content = str(resp)
        elif body.provider == "openrouter":
            from api.openrouter_client import OpenRouterClient as ORC
            client = ORC()
            mk = {"model": model_to_use, "stream": False, "temperature": model_config["temperature"]}
            if "top_p" in model_config:
                mk["top_p"] = model_config["top_p"]
            api_kwargs = client.convert_inputs_to_api_kwargs(input=full_prompt, model_kwargs=mk, model_type=ModelType.LLM)
            resp = await client.acall(api_kwargs=api_kwargs, model_type=ModelType.LLM)
            if hasattr(resp, "choices") and resp.choices:
                content = resp.choices[0].message.content or ""
            else:
                content = str(resp)
        elif body.provider == "ollama":
            client = OllamaClientLib()
            mk = {"model": model_config["model"], "stream": False, "options": {"temperature": model_config["temperature"], "top_p": model_config["top_p"], "num_ctx": model_config.get("num_ctx", 8192)}}
            api_kwargs = client.convert_inputs_to_api_kwargs(input=full_prompt + " /no_think", model_kwargs=mk, model_type=ModelType.LLM)
            resp = await client.acall(api_kwargs=api_kwargs, model_type=ModelType.LLM)
            content = getattr(resp, "text", None) or getattr(resp, "response", None) or str(resp)
        elif body.provider == "bedrock":
            from api.bedrock_client import BedrockClient as BRC
            client = BRC()
            mk = {"model": model_to_use}
            for k in ["temperature", "top_p"]:
                if k in model_config:
                    mk[k] = model_config[k]
            api_kwargs = client.convert_inputs_to_api_kwargs(input=full_prompt, model_kwargs=mk, model_type=ModelType.LLM)
            resp = await client.acall(api_kwargs=api_kwargs, model_type=ModelType.LLM)
            content = str(resp)
        elif body.provider == "azure":
            from api.azureai_client import AzureAIClient as AZC
            client = AZC()
            mk = {"model": model_to_use, "stream": False, "temperature": model_config["temperature"], "top_p": model_config["top_p"]}
            api_kwargs = client.convert_inputs_to_api_kwargs(input=full_prompt, model_kwargs=mk, model_type=ModelType.LLM)
            resp = await client.acall(api_kwargs=api_kwargs, model_type=ModelType.LLM)
            if hasattr(resp, "choices") and resp.choices:
                content = resp.choices[0].message.content or ""
            else:
                content = str(resp)
        elif body.provider == "dashscope":
            from api.dashscope_client import DashscopeClient as DSC
            client = DSC()
            mk = {"model": model_to_use, "stream": False, "temperature": model_config["temperature"], "top_p": model_config["top_p"]}
            api_kwargs = client.convert_inputs_to_api_kwargs(input=full_prompt, model_kwargs=mk, model_type=ModelType.LLM)
            resp = await client.acall(api_kwargs=api_kwargs, model_type=ModelType.LLM)
            content = str(resp)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported provider: {body.provider}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"LLM call failed during page regeneration: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to regenerate page: {str(e)}")

    # Clean up content
    content = content.replace("```markdown\n", "").rstrip("`").strip()

    if not content:
        raise HTTPException(status_code=500, detail="LLM returned empty content for page regeneration.")

    # Extract diagram data from the new content
    diagram_data = None
    try:
        diagram_data = extract_diagram_data(content)
    except Exception as e:
        logger.warning(f"Failed to extract diagram data for regenerated page {body.page_id}: {e}")

    # Update the cached page
    updated_page = WikiPage(
        id=page_data.id,
        title=page_data.title,
        content=content,
        filePaths=page_data.filePaths,
        importance=page_data.importance,
        relatedPages=page_data.relatedPages,
        diagramData=diagram_data if diagram_data else page_data.diagramData,
    )

    # Update the cache file
    cached.generated_pages[body.page_id] = updated_page

    cache_path = get_wiki_cache_path(body.owner, body.repo, body.repo_type, body.language)
    try:
        cache_dict = cached.model_dump()
        cache_dict["generated_at"] = datetime.now().isoformat()
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(cache_dict, f, indent=2)
        logger.info(f"Cache updated after page regeneration: {cache_path}")
    except Exception as e:
        logger.error(f"Failed to update cache after regeneration: {e}")

    return JSONResponse(content={
        "page": updated_page.model_dump(),
        "generated_at": datetime.now().isoformat(),
    })


@app.get("/health")
async def health_check():
    """Health check endpoint for Docker and monitoring"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "bettercodewiki-api"
    }

@app.get("/")
async def root():
    """Root endpoint to check if the API is running and list available endpoints dynamically."""
    # Collect routes dynamically from the FastAPI app
    endpoints = {}
    for route in app.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            # Skip docs and static routes
            if route.path in ["/openapi.json", "/docs", "/redoc", "/favicon.ico"]:
                continue
            # Group endpoints by first path segment
            path_parts = route.path.strip("/").split("/")
            group = path_parts[0].capitalize() if path_parts[0] else "Root"
            method_list = list(route.methods - {"HEAD", "OPTIONS"})
            for method in method_list:
                endpoints.setdefault(group, []).append(f"{method} {route.path}")

    # Optionally, sort endpoints for readability
    for group in endpoints:
        endpoints[group].sort()

    return {
        "message": "Welcome to Streaming API",
        "version": "1.0.0",
        "endpoints": endpoints
    }

# --- Processed Projects Endpoint --- (New Endpoint)
@app.get("/api/processed_projects", response_model=List[ProcessedProjectEntry])
async def get_processed_projects():
    """
    Lists all processed projects found in the wiki cache directory.
    Projects are identified by files named like: deepwiki_cache_{repo_type}_{owner}_{repo}_{language}.json
    """
    project_entries: List[ProcessedProjectEntry] = []
    # WIKI_CACHE_DIR is already defined globally in the file

    try:
        if not os.path.exists(WIKI_CACHE_DIR):
            logger.info(f"Cache directory {WIKI_CACHE_DIR} not found. Returning empty list.")
            return []

        logger.info(f"Scanning for project cache files in: {WIKI_CACHE_DIR}")
        filenames = await asyncio.to_thread(os.listdir, WIKI_CACHE_DIR) # Use asyncio.to_thread for os.listdir

        for filename in filenames:
            if filename.startswith("deepwiki_cache_") and filename.endswith(".json"):
                file_path = os.path.join(WIKI_CACHE_DIR, filename)
                try:
                    stats = await asyncio.to_thread(os.stat, file_path) # Use asyncio.to_thread for os.stat
                    parts = filename.replace("deepwiki_cache_", "").replace(".json", "").split('_')

                    # Expecting repo_type_owner_repo_language
                    # Example: deepwiki_cache_github_AsyncFuncAI_deepwiki-open_en.json
                    # parts = [github, AsyncFuncAI, deepwiki-open, en]
                    if len(parts) >= 4:
                        repo_type = parts[0]
                        owner = parts[1]
                        language = parts[-1] # language is the last part
                        repo = "_".join(parts[2:-1]) # repo can contain underscores

                        project_entries.append(
                            ProcessedProjectEntry(
                                id=filename,
                                owner=owner,
                                repo=repo,
                                name=f"{owner}/{repo}",
                                repo_type=repo_type,
                                submittedAt=int(stats.st_mtime * 1000), # Convert to milliseconds
                                language=language
                            )
                        )
                    else:
                        logger.warning(f"Could not parse project details from filename: {filename}")
                except Exception as e:
                    logger.error(f"Error processing file {file_path}: {e}")
                    continue # Skip this file on error

        # Sort by most recent first
        project_entries.sort(key=lambda p: p.submittedAt, reverse=True)
        logger.info(f"Found {len(project_entries)} processed project entries.")
        return project_entries

    except Exception as e:
        logger.error(f"Error listing processed projects from {WIKI_CACHE_DIR}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to list processed projects from server cache.")
