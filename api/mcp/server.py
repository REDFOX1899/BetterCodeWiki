"""
BetterCodeWiki MCP Server

Exposes cached wiki data as MCP tools for Claude Desktop, Claude Code,
Cursor, and Windsurf. Reads from ~/.adalflow/wikicache/ — the same cache
files the main BetterCodeWiki app writes.

This is a standalone script. It does NOT import from or depend on any
existing BetterCodeWiki code.

Install:  pip install "mcp[cli]"
Run:      python server.py                (stdio — for Claude Desktop/Code)
          python server.py --http         (HTTP — for network access on :8008)

Test:     mcp dev server.py               (opens browser-based inspector)
"""

import json
import os
import sys
from mcp.server.fastmcp import FastMCP

# ── Config ────────────────────────────────────────────────────

CACHE_DIR = os.path.expanduser("~/.adalflow/wikicache")

# Max characters of page content to return in search/ask results
# (full pages can be 1MB+; agents don't need all of it)
SNIPPET_MAX = 8000

mcp = FastMCP(
    "bettercodewiki",
    instructions=(
        "Query BetterCodeWiki documentation for any cached repository. "
        "Use list_projects to discover available repos, then get_wiki_overview, "
        "get_wiki_page, or search_wiki to explore documentation."
    ),
)


# ── Helpers ───────────────────────────────────────────────────


def _load_cache(
    owner: str, repo: str, repo_type: str = "github", language: str = "en"
) -> dict | None:
    """Load a wiki cache file. Returns dict or None."""
    filename = f"deepwiki_cache_{repo_type}_{owner}_{repo}_{language}.json"
    path = os.path.join(CACHE_DIR, filename)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _list_cache_files() -> list[dict]:
    """List all cache files and parse project metadata."""
    if not os.path.isdir(CACHE_DIR):
        return []
    projects = []
    for filename in sorted(os.listdir(CACHE_DIR)):
        if not (filename.startswith("deepwiki_cache_") and filename.endswith(".json")):
            continue
        parts = (
            filename.replace("deepwiki_cache_", "").replace(".json", "").split("_")
        )
        if len(parts) >= 4:
            repo_type = parts[0]
            owner = parts[1]
            language = parts[-1]
            repo = "_".join(parts[2:-1])
            projects.append(
                {
                    "owner": owner,
                    "repo": repo,
                    "name": f"{owner}/{repo}",
                    "repo_type": repo_type,
                    "language": language,
                }
            )
    return projects


def _find_page(generated_pages: dict, query: str) -> dict | None:
    """Find a page by exact ID or fuzzy title match."""
    # Exact ID match
    if query in generated_pages:
        return generated_pages[query]

    # Case-insensitive title match
    query_lower = query.lower()
    for page in generated_pages.values():
        if query_lower == page.get("title", "").lower():
            return page

    # Partial title match
    for page in generated_pages.values():
        if query_lower in page.get("title", "").lower():
            return page

    return None


def _extract_snippet(content: str, query: str, context_chars: int = 300) -> str:
    """Extract a snippet around the first match of query in content."""
    idx = content.lower().find(query.lower())
    if idx < 0:
        # No match — return the beginning
        return content[:context_chars * 2].strip() + ("..." if len(content) > context_chars * 2 else "")

    start = max(0, idx - context_chars)
    end = min(len(content), idx + len(query) + context_chars)
    snippet = content[start:end].strip()
    if start > 0:
        snippet = "..." + snippet
    if end < len(content):
        snippet = snippet + "..."
    return snippet


# ── Tools ─────────────────────────────────────────────────────


@mcp.tool()
def list_projects() -> list[dict]:
    """List all repositories that have cached BetterCodeWiki documentation.

    Returns a list of projects with owner, repo, platform type, and language.
    Call this first to discover what documentation is available before using
    other tools.
    """
    projects = _list_cache_files()
    if not projects:
        return [{"message": "No cached wikis found. Generate one through the BetterCodeWiki web UI first."}]
    return projects


@mcp.tool()
def get_wiki_overview(
    owner: str,
    repo: str,
    repo_type: str = "github",
    language: str = "en",
) -> dict:
    """Get the wiki structure, description, and page listing for a repository.

    Returns the wiki title, description, all page titles with their importance
    levels and file associations, and section hierarchy. Use this to understand
    the overall architecture of a project before diving into specific pages.

    Args:
        owner: Repository owner (e.g. "anthropics")
        repo: Repository name (e.g. "claude-code")
        repo_type: Platform — "github", "gitlab", or "bitbucket"
        language: Wiki language code (e.g. "en", "ja", "zh")
    """
    cache = _load_cache(owner, repo, repo_type, language)
    if not cache:
        available = _list_cache_files()
        return {
            "error": f"No cached wiki found for {owner}/{repo} ({repo_type}, {language})",
            "available_projects": available,
        }

    structure = cache.get("wiki_structure", {})
    pages_summary = []
    for page in structure.get("pages", []):
        pages_summary.append(
            {
                "id": page.get("id"),
                "title": page.get("title"),
                "importance": page.get("importance"),
                "filePaths": page.get("filePaths", []),
                "relatedPages": page.get("relatedPages", []),
            }
        )

    return {
        "title": structure.get("title"),
        "description": structure.get("description"),
        "total_pages": len(pages_summary),
        "pages": pages_summary,
        "sections": structure.get("sections"),
        "provider": cache.get("provider"),
        "model": cache.get("model"),
    }


@mcp.tool()
def get_wiki_page(
    owner: str,
    repo: str,
    page_title: str,
    repo_type: str = "github",
    language: str = "en",
) -> dict:
    """Get a specific wiki page by title (fuzzy match) or exact page ID.

    Returns the full markdown content of the page, including any Mermaid
    diagrams, code examples, related files, and related pages. Page content
    can be very long for comprehensive wikis.

    Args:
        owner: Repository owner
        repo: Repository name
        page_title: Page title (case-insensitive, partial match works) or exact page ID (e.g. "p-core-architecture")
        repo_type: Platform type
        language: Wiki language code
    """
    cache = _load_cache(owner, repo, repo_type, language)
    if not cache:
        return {"error": f"No cached wiki found for {owner}/{repo}"}

    generated = cache.get("generated_pages", {})
    page = _find_page(generated, page_title)

    if page:
        return {
            "id": page.get("id"),
            "title": page.get("title"),
            "content": page.get("content", ""),
            "filePaths": page.get("filePaths", []),
            "importance": page.get("importance"),
            "relatedPages": page.get("relatedPages", []),
        }

    # Not found — list available pages
    available = [
        {"id": p.get("id"), "title": p.get("title")}
        for p in generated.values()
    ]
    return {"error": f"Page '{page_title}' not found", "available_pages": available}


@mcp.tool()
def search_wiki(
    owner: str,
    repo: str,
    query: str,
    repo_type: str = "github",
    language: str = "en",
    max_results: int = 5,
) -> list[dict]:
    """Search across all wiki pages for a repository.

    Performs case-insensitive text search across page titles and content.
    Returns matching pages ranked by relevance with text snippets showing
    where the match was found.

    Args:
        owner: Repository owner
        repo: Repository name
        query: Search query — searches both titles and page content
        repo_type: Platform type
        language: Wiki language code
        max_results: Maximum results to return (default 5, max 20)
    """
    cache = _load_cache(owner, repo, repo_type, language)
    if not cache:
        return [{"error": f"No cached wiki found for {owner}/{repo}"}]

    generated = cache.get("generated_pages", {})
    query_lower = query.lower()
    results = []
    max_results = min(max_results, 20)

    for page_id, page in generated.items():
        title = page.get("title", "")
        content = page.get("content", "")
        score = 0

        # Title matches score higher
        if query_lower in title.lower():
            score += 10
        # Content matches
        content_lower = content.lower()
        if query_lower in content_lower:
            score += 1
            # Boost by occurrence count (capped)
            score += min(content_lower.count(query_lower), 10)

        if score > 0:
            snippet = _extract_snippet(content, query)
            results.append(
                {
                    "page_id": page_id,
                    "title": title,
                    "importance": page.get("importance"),
                    "score": score,
                    "snippet": snippet,
                    "filePaths": page.get("filePaths", []),
                }
            )

    results.sort(key=lambda r: r["score"], reverse=True)

    if not results:
        # Show available pages so the agent can try a different query
        available = [p.get("title") for p in generated.values()]
        return [{"message": f"No results for '{query}'", "available_pages": available}]

    return results[:max_results]


@mcp.tool()
def ask_codebase(
    owner: str,
    repo: str,
    question: str,
    repo_type: str = "github",
    language: str = "en",
) -> str:
    """Ask a question about a repository using wiki documentation as context.

    Searches wiki pages for content relevant to your question and returns
    the most relevant documentation sections. This does NOT call an LLM —
    it returns wiki content so YOUR model can reason about it.

    For LLM-powered deep research, use the BetterCodeWiki web UI instead.

    Args:
        owner: Repository owner
        repo: Repository name
        question: Natural language question about the codebase
        repo_type: Platform type
        language: Wiki language code
    """
    cache = _load_cache(owner, repo, repo_type, language)
    if not cache:
        available = _list_cache_files()
        names = [p["name"] for p in available]
        return (
            f"No wiki found for {owner}/{repo}. "
            f"Available projects: {', '.join(names) if names else 'none'}. "
            f"Generate a wiki through the BetterCodeWiki web UI first."
        )

    generated = cache.get("generated_pages", {})
    question_lower = question.lower()

    # Score each page by relevance to the question
    scored = []
    for page_id, page in generated.items():
        title = page.get("title", "")
        content = page.get("content", "")
        score = 0

        # Split question into words for broader matching
        words = [w for w in question_lower.split() if len(w) > 3]
        for word in words:
            if word in title.lower():
                score += 5
            if word in content.lower():
                score += 1
                score += min(content.lower().count(word), 5)

        if score > 0:
            scored.append((score, page_id, page))

    scored.sort(key=lambda x: x[0], reverse=True)

    if not scored:
        # Fall back to returning the overview page
        for page in generated.values():
            if page.get("importance") == "high":
                scored.append((1, page.get("id"), page))
                break

    if not scored:
        return f"Could not find relevant documentation for: {question}"

    # Return top 3 pages, truncated to keep response manageable
    context_parts = []
    for _, page_id, page in scored[:3]:
        content = page.get("content", "")
        if len(content) > SNIPPET_MAX:
            content = content[:SNIPPET_MAX] + f"\n\n... [truncated — full page has {len(content)} chars, use get_wiki_page with page_id='{page_id}' for complete content]"
        context_parts.append(
            f"## {page.get('title', 'Untitled')}\n"
            f"Page ID: {page_id} | Importance: {page.get('importance', 'unknown')} | "
            f"Files: {', '.join(page.get('filePaths', []))}\n\n"
            f"{content}"
        )

    header = (
        f"Wiki documentation for {owner}/{repo} "
        f"(generated by {cache.get('provider', '?')}/{cache.get('model', '?')}).\n"
        f"Showing {len(context_parts)} most relevant pages for: \"{question}\"\n\n"
    )
    return header + "\n\n---\n\n".join(context_parts)


# ── Resources ─────────────────────────────────────────────────


@mcp.resource("wiki://{owner}/{repo}/overview")
def wiki_overview_resource(owner: str, repo: str) -> str:
    """Overview of a repository's wiki documentation."""
    result = get_wiki_overview(owner, repo)
    return json.dumps(result, indent=2, default=str)


@mcp.resource("wiki://{owner}/{repo}/pages/{page_id}")
def wiki_page_resource(owner: str, repo: str, page_id: str) -> str:
    """Full content of a specific wiki page."""
    result = get_wiki_page(owner, repo, page_id)
    return json.dumps(result, indent=2, default=str)


# ── Entry Point ───────────────────────────────────────────────

if __name__ == "__main__":
    if "--http" in sys.argv:
        print("Starting BetterCodeWiki MCP server on http://127.0.0.1:8008/mcp", file=sys.stderr)
        mcp.run(transport="streamable-http", host="127.0.0.1", port=8008)
    else:
        mcp.run(transport="stdio")
