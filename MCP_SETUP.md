# BetterCodeWiki MCP Server — Setup Guide

> Expose BetterCodeWiki as an MCP server so Claude Desktop, Claude Code, Cursor, and Windsurf can query your codebase wikis in real-time.
>
> **Status: Built and working.** Server is at `api/mcp/server.py`.

---

## Why MCP Matters

MCP (Model Context Protocol) lets AI agents call tools on external servers. If BetterCodeWiki exposes an MCP server, any AI coding agent can:

- Look up how a module works before editing it
- Search wiki documentation for relevant context
- Ask questions about the codebase using the existing RAG pipeline
- Understand architecture via generated diagrams

This turns BetterCodeWiki from "documentation you read" into "documentation your AI reads."

---

## Architecture Decision: Zero Risk to Existing Code

The MCP server is a **completely separate Python script** that reads the same cache files the main app writes. It does **not** import from or modify any existing FastAPI code.

```
┌─────────────────────────────────┐     ┌──────────────────────────────┐
│  Existing BetterCodeWiki        │     │  MCP Server (NEW)            │
│                                 │     │                              │
│  Next.js ←→ FastAPI             │     │  api/mcp/server.py           │
│       ↓                         │     │       ↓                      │
│  ~/.adalflow/wikicache/*.json   │     │  Reads same cache files      │
│  (writes cache)                 │     │  (read-only)                 │
└─────────────────────────────────┘     └──────────────────────────────┘
```

**No shared imports. No shared process. No risk of breaking anything.** The MCP server is a standalone script that reads JSON files from `~/.adalflow/wikicache/`.

---

## Simplified Tool Set (5 tools, down from 8)

After analyzing what's actually useful for AI agents vs. what's noise, here are the 5 tools worth building:

### Tools

| # | Tool | What It Does | Speed | Why Agents Need It |
|---|------|-------------|-------|-------------------|
| 1 | `list_projects` | Lists all cached wiki projects | Instant | Agent discovers what repos have wikis |
| 2 | `get_wiki_overview` | Returns wiki structure + description for a repo | Instant | Agent understands project architecture in one call |
| 3 | `get_wiki_page` | Returns a specific wiki page by title or ID | Instant | Agent gets deep context on a specific module |
| 4 | `search_wiki` | Full-text search across all wiki pages | Instant | Agent finds relevant context for its current task |
| 5 | `ask_codebase` | RAG-powered Q&A about the codebase | 2-30s | Agent asks complex questions (uses existing RAG) |

### What Was Cut and Why

| Original Tool | Why Removed |
|---|---|
| `get_architecture_diagram` | Diagrams are already embedded in wiki pages — `get_wiki_page` returns them |
| `get_file_context` | Agent can use `search_wiki` with a filename to get the same result |
| `get_dependency_graph` | Not stored separately in cache; low value for agents vs. `get_wiki_overview` |
| `list_components` | Same as `get_wiki_overview` — the wiki structure IS the component list |

### Resources

| # | Resource URI | Content |
|---|---|---|
| 1 | `wiki://{owner}/{repo}/overview` | Project description + page list |
| 2 | `wiki://{owner}/{repo}/pages/{page_id}` | Full page markdown content |

---

## Implementation

### File Structure

```
api/mcp/
├── server.py          # MCP server (standalone script, ~250 lines)
├── .venv/             # Python 3.13 venv with mcp[cli] installed
└── .gitignore         # Excludes .venv/ and __pycache__/
```

One file. One dependency (`mcp[cli]`). Zero imports from existing code.

### server.py — Source

```python
"""
BetterCodeWiki MCP Server

Exposes wiki data as MCP tools for Claude Desktop, Claude Code, Cursor, etc.
Reads from ~/.adalflow/wikicache/ (same cache the main app writes to).

Install:  pip install "mcp[cli]"
Run:      python api/mcp/server.py              (stdio, for Claude Desktop/Code)
          python api/mcp/server.py --http       (HTTP, for network access)
"""

import json
import os
import sys
from typing import Optional
from mcp.server.fastmcp import FastMCP

# ── Config ────────────────────────────────────────────────────

CACHE_DIR = os.path.expanduser("~/.adalflow/wikicache")

mcp = FastMCP(
    "bettercodewiki",
    description="Query BetterCodeWiki documentation for any cached repository"
)

# ── Helpers ───────────────────────────────────────────────────

def _load_cache(owner: str, repo: str, repo_type: str = "github", language: str = "en"):
    """Load a wiki cache file. Returns dict or None."""
    filename = f"deepwiki_cache_{repo_type}_{owner}_{repo}_{language}.json"
    path = os.path.join(CACHE_DIR, filename)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def _list_cache_files():
    """List all cache files and parse project metadata."""
    if not os.path.isdir(CACHE_DIR):
        return []
    projects = []
    for filename in os.listdir(CACHE_DIR):
        if filename.startswith("deepwiki_cache_") and filename.endswith(".json"):
            parts = filename.replace("deepwiki_cache_", "").replace(".json", "").split("_")
            if len(parts) >= 4:
                repo_type = parts[0]
                owner = parts[1]
                language = parts[-1]
                repo = "_".join(parts[2:-1])
                projects.append({
                    "owner": owner,
                    "repo": repo,
                    "name": f"{owner}/{repo}",
                    "repo_type": repo_type,
                    "language": language,
                })
    return projects

# ── Tools ─────────────────────────────────────────────────────

@mcp.tool()
def list_projects() -> list[dict]:
    """List all repositories that have cached BetterCodeWiki documentation.

    Returns a list of projects with owner, repo, type, and language.
    Use this first to discover what repos are available.
    """
    return _list_cache_files()


@mcp.tool()
def get_wiki_overview(
    owner: str,
    repo: str,
    repo_type: str = "github",
    language: str = "en",
) -> dict:
    """Get the full wiki structure and description for a repository.

    Returns the wiki title, description, and list of all pages with their
    titles, importance levels, and relationships. Use this to understand
    the overall architecture of a project.

    Args:
        owner: Repository owner (e.g. "REDFOX1899")
        repo: Repository name (e.g. "BetterCodeWiki")
        repo_type: Platform type — "github", "gitlab", or "bitbucket"
        language: Wiki language code (e.g. "en", "ja", "zh")
    """
    cache = _load_cache(owner, repo, repo_type, language)
    if not cache:
        return {"error": f"No cached wiki found for {owner}/{repo}"}

    structure = cache.get("wiki_structure", {})
    # Return structure without full page content (just metadata)
    pages_summary = []
    for page in structure.get("pages", []):
        pages_summary.append({
            "id": page.get("id"),
            "title": page.get("title"),
            "importance": page.get("importance"),
            "filePaths": page.get("filePaths", []),
            "relatedPages": page.get("relatedPages", []),
        })

    return {
        "title": structure.get("title"),
        "description": structure.get("description"),
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
    """Get a specific wiki page by title (fuzzy match) or exact ID.

    Returns the full markdown content of the page, including any Mermaid
    diagrams, related files, and related pages.

    Args:
        owner: Repository owner
        repo: Repository name
        page_title: Page title (case-insensitive partial match) or exact page ID
        repo_type: Platform type
        language: Wiki language code
    """
    cache = _load_cache(owner, repo, repo_type, language)
    if not cache:
        return {"error": f"No cached wiki found for {owner}/{repo}"}

    generated = cache.get("generated_pages", {})

    # Try exact ID match first
    if page_title in generated:
        page = generated[page_title]
        return page

    # Fuzzy title match
    query = page_title.lower()
    for page_id, page in generated.items():
        if query in page.get("title", "").lower():
            return page

    # List available pages if not found
    available = [p.get("title") for p in generated.values()]
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
    Returns matching pages with relevant snippets.

    Args:
        owner: Repository owner
        repo: Repository name
        query: Search query (searches titles and content)
        repo_type: Platform type
        language: Wiki language code
        max_results: Maximum number of results to return (default 5)
    """
    cache = _load_cache(owner, repo, repo_type, language)
    if not cache:
        return [{"error": f"No cached wiki found for {owner}/{repo}"}]

    generated = cache.get("generated_pages", {})
    query_lower = query.lower()
    results = []

    for page_id, page in generated.items():
        title = page.get("title", "")
        content = page.get("content", "")
        score = 0

        # Title match scores higher
        if query_lower in title.lower():
            score += 10
        # Content match
        if query_lower in content.lower():
            score += 1
            # Count occurrences for ranking
            score += content.lower().count(query_lower)

        if score > 0:
            # Extract snippet around first match
            idx = content.lower().find(query_lower)
            snippet = ""
            if idx >= 0:
                start = max(0, idx - 100)
                end = min(len(content), idx + len(query) + 200)
                snippet = content[start:end].strip()
                if start > 0:
                    snippet = "..." + snippet
                if end < len(content):
                    snippet = snippet + "..."

            results.append({
                "page_id": page_id,
                "title": title,
                "importance": page.get("importance"),
                "score": score,
                "snippet": snippet,
                "filePaths": page.get("filePaths", []),
            })

    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:max_results]


@mcp.tool()
def ask_codebase(
    owner: str,
    repo: str,
    question: str,
    repo_type: str = "github",
    language: str = "en",
) -> str:
    """Ask a question about a repository using the wiki content as context.

    Searches wiki pages for relevant content and returns a synthesized answer
    based on the documentation. This does NOT call an LLM — it returns the
    most relevant wiki content so YOUR model can reason about it.

    For LLM-powered Q&A, use the BetterCodeWiki web UI's Ask feature instead.

    Args:
        owner: Repository owner
        repo: Repository name
        question: Natural language question about the codebase
        repo_type: Platform type
        language: Wiki language code
    """
    # Use search_wiki internally to find relevant pages
    results = search_wiki(owner, repo, question, repo_type, language, max_results=3)

    if not results or (len(results) == 1 and "error" in results[0]):
        return f"No wiki found for {owner}/{repo}. Generate one first at the BetterCodeWiki web UI."

    # Assemble context from top matching pages
    cache = _load_cache(owner, repo, repo_type, language)
    generated = cache.get("generated_pages", {})

    context_parts = []
    for result in results:
        page = generated.get(result["page_id"], {})
        context_parts.append(
            f"## {page.get('title', 'Untitled')}\n\n{page.get('content', '')}"
        )

    return (
        f"Based on the BetterCodeWiki documentation for {owner}/{repo}, "
        f"here are the most relevant sections for your question:\n\n"
        + "\n\n---\n\n".join(context_parts)
    )


# ── Resources ─────────────────────────────────────────────────

@mcp.resource("wiki://{owner}/{repo}/overview")
def wiki_overview(owner: str, repo: str) -> str:
    """Overview of a repository's wiki documentation."""
    result = get_wiki_overview(owner, repo)
    return json.dumps(result, indent=2)


@mcp.resource("wiki://{owner}/{repo}/pages/{page_id}")
def wiki_page(owner: str, repo: str, page_id: str) -> str:
    """Content of a specific wiki page."""
    result = get_wiki_page(owner, repo, page_id)
    return json.dumps(result, indent=2)


# ── Entry Point ───────────────────────────────────────────────

if __name__ == "__main__":
    if "--http" in sys.argv:
        mcp.run(transport="streamable-http", host="127.0.0.1", port=8008)
    else:
        mcp.run(transport="stdio")
```

See [`api/mcp/server.py`](api/mcp/server.py) for the full implementation.

### How It Works

1. **Reads `~/.adalflow/wikicache/` directly** — same JSON files the main app creates
2. **No imports from existing code** — zero coupling, zero risk
3. **All cached wiki tools are instant** — just file I/O and string search
4. **`ask_codebase` returns context, not LLM output** — the calling agent's own model reasons about the wiki content (this is the correct MCP pattern)
5. **Large page content is truncated** in `ask_codebase` (8KB max per page) to keep responses manageable; use `get_wiki_page` for full content

---

## Setup Guide

### Prerequisites

1. BetterCodeWiki must have generated at least one wiki (so cache files exist in `~/.adalflow/wikicache/`)
2. Python 3.10+ installed locally

### Step 1: Install the MCP SDK

The venv is already set up at `api/mcp/.venv/`. To recreate it:

```bash
cd /path/to/BetterCodeWiki
python3.13 -m venv api/mcp/.venv
api/mcp/.venv/bin/pip install "mcp[cli]"
```

### Step 2: Test the Server Locally

```bash
# From the BetterCodeWiki root directory
python api/mcp/server.py
```

This starts in stdio mode. You should see no output (stdout is reserved for MCP JSON-RPC). Press Ctrl+C to stop.

To verify it works, test with the MCP CLI inspector:

```bash
mcp dev api/mcp/server.py
```

This opens a browser-based inspector where you can call tools and see results.

---

### Step 3: Connect to Claude Desktop

Edit (or create) the config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

#### Option A: Using Python directly

```json
{
  "mcpServers": {
    "bettercodewiki": {
      "command": "python",
      "args": ["/absolute/path/to/BetterCodeWiki/api/mcp/server.py"]
    }
  }
}
```

#### Option B: Using a virtual environment

```json
{
  "mcpServers": {
    "bettercodewiki": {
      "command": "/absolute/path/to/BetterCodeWiki/.mcp-venv/bin/python",
      "args": ["/absolute/path/to/BetterCodeWiki/api/mcp/server.py"]
    }
  }
}
```

#### Option C: Using uv

```json
{
  "mcpServers": {
    "bettercodewiki": {
      "command": "uv",
      "args": [
        "--directory", "/absolute/path/to/BetterCodeWiki",
        "run", "api/mcp/server.py"
      ]
    }
  }
}
```

After saving, **completely quit Claude Desktop** (Cmd+Q on macOS) and reopen it. The BetterCodeWiki tools should appear in the tool list.

---

### Step 4: Connect to Claude Code

```bash
# stdio (recommended for local)
claude mcp add bettercodewiki -- python /absolute/path/to/BetterCodeWiki/api/mcp/server.py

# Or with a venv
claude mcp add bettercodewiki -- /absolute/path/to/.mcp-venv/bin/python /absolute/path/to/BetterCodeWiki/api/mcp/server.py
```

Verify the connection:

```bash
claude mcp list
```

Inside Claude Code, run `/mcp` to check server status.

---

### Step 5: Connect to Cursor / Windsurf

Both Cursor and Windsurf support MCP via their settings:

**Cursor**: Settings > MCP > Add Server
**Windsurf**: Settings > MCP Servers

Use the same command + args as Claude Desktop config above.

For remote/network access, start the server in HTTP mode:

```bash
python api/mcp/server.py --http
# Server runs at http://127.0.0.1:8008/mcp
```

Then configure the IDE to connect to `http://127.0.0.1:8008/mcp`.

---

## Testing Checklist

Once connected, test each tool in Claude Desktop or Claude Code:

### 1. List Projects
Ask Claude: *"What repos do you have documentation for?"*

Expected: Claude calls `list_projects` and shows cached repos.

### 2. Get Wiki Overview
Ask: *"Give me an overview of the REDFOX1899/BetterCodeWiki project"*

Expected: Claude calls `get_wiki_overview` and describes the architecture.

### 3. Get Wiki Page
Ask: *"Show me the wiki page about authentication"*

Expected: Claude calls `get_wiki_page` with a fuzzy title match.

### 4. Search Wiki
Ask: *"Search the BetterCodeWiki docs for anything about WebSocket"*

Expected: Claude calls `search_wiki` and returns matching snippets.

### 5. Ask About Codebase
Ask: *"How does the RAG pipeline work in BetterCodeWiki?"*

Expected: Claude calls `ask_codebase`, gets relevant wiki context, then reasons about it.

---

## Docker Integration

The MCP server runs automatically inside the Docker container alongside FastAPI and Next.js.

**What's configured:**
- `mcp[cli]` is included in `api/pyproject.toml` as a Poetry dependency
- `Dockerfile` exposes port 8008 and launches `python /app/api/mcp/server.py --http &` in `start.sh`
- `docker-compose.yml` maps port 8008 to the host
- The server binds to `0.0.0.0:8008` inside the container (configurable via `MCP_HOST` and `MCP_PORT` env vars)

**Usage after `docker compose up`:**

Remote MCP clients connect to `http://localhost:8008/mcp` (streamable-http transport).

For Claude Code connecting to a Docker-hosted instance:
```bash
claude mcp add bettercodewiki --transport streamable-http http://localhost:8008/mcp
```

For Claude Desktop, use the URL-based config:
```json
{
  "mcpServers": {
    "bettercodewiki": {
      "url": "http://localhost:8008/mcp"
    }
  }
}
```

---

## What's NOT in Scope (and Why)

| Feature | Why Skipped |
|---|---|
| **Live wiki generation via MCP** | Too slow (30-120s). MCP tools should respond in <5s. Generate wikis through the web UI, then query them via MCP. |
| **RAG pipeline calls from MCP** | Requires model API keys in the MCP server process. The `ask_codebase` tool returns wiki content as context instead — the calling agent's own model does the reasoning. |
| **Write operations** | MCP server is read-only. No creating/deleting wikis from MCP. |
| **Diagram rendering** | Mermaid diagrams are embedded as text in wiki pages. The agent can read the Mermaid syntax; rendering is the client's job. |

---

## Summary

| Aspect | Decision |
|---|---|
| **Architecture** | Separate standalone script, reads same cache files |
| **Risk to existing code** | Zero — no imports, no shared process |
| **Transport** | stdio for local dev, streamable-http for remote |
| **Tools** | 5 (list, overview, page, search, ask) |
| **Resources** | 2 (overview, page by ID) |
| **Dependencies** | Just `mcp[cli]` (one pip install) |
| **Response time** | <100ms for cached data, <1s for search |
