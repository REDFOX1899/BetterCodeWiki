#!/usr/bin/env python3
"""
ingest.py -- CLI tool that generates a wiki for a single GitHub repo
and publishes it to the production stack (GCS + Supabase).

Usage:
    python scripts/ingest.py --repo https://github.com/facebook/react --tags javascript,ui,frontend
    python scripts/ingest.py --repo facebook/react --tags javascript,ui
    python scripts/ingest.py --repo facebook/react --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import re
import sys
import time
from base64 import b64decode
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from xml.etree import ElementTree as ET

# ---------------------------------------------------------------------------
# Ensure the project root is on sys.path so we can import from `api.*`
# ---------------------------------------------------------------------------
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_SCRIPT_DIR)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)


# ---------------------------------------------------------------------------
# Console helpers (no external deps -- just unicode symbols)
# ---------------------------------------------------------------------------

class _C:
    """Colour / symbol constants for terminal output."""
    RESET  = "\033[0m"
    BOLD   = "\033[1m"
    DIM    = "\033[2m"
    GREEN  = "\033[32m"
    YELLOW = "\033[33m"
    BLUE   = "\033[34m"
    CYAN   = "\033[36m"
    RED    = "\033[31m"
    MAGENTA = "\033[35m"

    CHECK  = "\u2714"   # checkmark
    CROSS  = "\u2718"   # cross
    ARROW  = "\u2192"   # right arrow
    BULLET = "\u2022"   # bullet
    CLOCK  = "\u231B"   # hourglass
    ROCKET = "\u2728"   # sparkles (rocket alternative)
    GLOBE  = "\u25C9"   # circle


def _log(symbol: str, colour: str, msg: str) -> None:
    print(f"  {colour}{symbol}{_C.RESET}  {msg}")


def _info(msg: str) -> None:
    _log(_C.BULLET, _C.BLUE, msg)


def _ok(msg: str) -> None:
    _log(_C.CHECK, _C.GREEN, msg)


def _warn(msg: str) -> None:
    _log("!", _C.YELLOW, msg)


def _err(msg: str) -> None:
    _log(_C.CROSS, _C.RED, msg)


def _step(n: int, total: int, msg: str) -> None:
    print(f"\n{_C.CYAN}{_C.BOLD}[{n}/{total}]{_C.RESET} {msg}")


def _header(msg: str) -> None:
    w = max(len(msg) + 4, 50)
    print(f"\n{_C.MAGENTA}{_C.BOLD}{'=' * w}{_C.RESET}")
    print(f"{_C.MAGENTA}{_C.BOLD}  {msg}{_C.RESET}")
    print(f"{_C.MAGENTA}{_C.BOLD}{'=' * w}{_C.RESET}\n")


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Generate a wiki for a GitHub repo and publish to the production stack.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/ingest.py --repo https://github.com/facebook/react --tags javascript,ui
  python scripts/ingest.py --repo facebook/react --dry-run
  python scripts/ingest.py --repo pallets/flask --provider openai --model gpt-4o
        """,
    )
    p.add_argument(
        "--repo",
        required=True,
        help="Repository (full URL or owner/repo shorthand)",
    )
    p.add_argument(
        "--tags",
        default="",
        help="Comma-separated tags for the Supabase wiki_projects row",
    )
    p.add_argument("--language", default="en", help="Wiki language (default: en)")
    p.add_argument("--provider", default="google", help="AI provider (default: google)")
    p.add_argument("--model", default=None, help="Model name (default: provider default)")
    p.add_argument(
        "--api-url",
        default="http://localhost:8001",
        help="Backend API base URL (default: http://localhost:8001)",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch metadata and print what WOULD be done, without generating",
    )
    p.add_argument(
        "--featured",
        action="store_true",
        help="Mark this project as featured in the library",
    )
    p.add_argument(
        "--skip-supabase",
        action="store_true",
        help="Skip the Supabase upsert step",
    )
    p.add_argument(
        "--max-files",
        type=int,
        default=0,
        help="Limit the number of files sent for embedding (0 = unlimited, default: 0). "
             "When set, only the top N files by priority are included.",
    )
    p.add_argument(
        "--include-dirs",
        default="",
        help="Comma-separated directories to focus on (e.g., 'src,lib,api'). "
             "When set, only files in these directories are embedded.",
    )
    p.add_argument(
        "--exclude-dirs",
        default="",
        help="Comma-separated additional directories to exclude beyond defaults "
             "(e.g., 'vendor,generated,fixtures').",
    )
    p.add_argument(
        "--concurrency",
        type=int,
        default=5,
        help="Max concurrent page generation requests (default: 5)",
    )
    p.add_argument(
        "--timeout",
        type=int,
        default=300,
        help="Per-page WebSocket timeout in seconds (default: 300)",
    )
    p.add_argument(
        "--delay",
        type=float,
        default=2.0,
        help="Seconds to wait between starting each page generation (default: 2.0)",
    )
    p.add_argument(
        "--retry-failed",
        action="store_true",
        help="Automatically retry pages that failed to generate",
    )
    p.add_argument(
        "--max-retries",
        type=int,
        default=2,
        help="Max number of retry rounds for failed pages (default: 2)",
    )
    p.add_argument("-v", "--verbose", action="store_true", help="Verbose logging")
    return p.parse_args()


# ---------------------------------------------------------------------------
# Repo URL normalisation
# ---------------------------------------------------------------------------

def normalise_repo(raw: str) -> Tuple[str, str, str]:
    """Return (owner, repo, html_url) from a full URL or owner/repo shorthand."""
    raw = raw.strip().rstrip("/")

    # Full URL: https://github.com/owner/repo or https://github.com/owner/repo.git
    m = re.match(r"https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?$", raw)
    if m:
        owner, repo = m.group(1), m.group(2)
        return owner, repo, f"https://github.com/{owner}/{repo}"

    # Shorthand: owner/repo
    m = re.match(r"^([A-Za-z0-9_.\-]+)/([A-Za-z0-9_.\-]+)$", raw)
    if m:
        owner, repo = m.group(1), m.group(2)
        return owner, repo, f"https://github.com/{owner}/{repo}"

    raise ValueError(
        f"Cannot parse repo: {raw!r}. "
        "Expected https://github.com/owner/repo or owner/repo"
    )


# ---------------------------------------------------------------------------
# GitHub metadata
# ---------------------------------------------------------------------------

async def fetch_github_metadata(owner: str, repo: str) -> Dict[str, Any]:
    """Fetch public metadata from the GitHub REST API (no auth)."""
    import httpx

    url = f"https://api.github.com/repos/{owner}/{repo}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers={"Accept": "application/vnd.github.v3+json"})
        resp.raise_for_status()
        data = resp.json()

    return {
        "description": data.get("description") or "",
        "stargazers_count": data.get("stargazers_count", 0),
        "forks_count": data.get("forks_count", 0),
        "language": data.get("language") or "",
        "topics": data.get("topics") or [],
        "html_url": data.get("html_url", f"https://github.com/{owner}/{repo}"),
        "owner_avatar_url": (data.get("owner") or {}).get("avatar_url", ""),
        "default_branch": data.get("default_branch", "main"),
    }


# ---------------------------------------------------------------------------
# Fetch file tree + README from GitHub API (mirrors frontend behaviour)
# ---------------------------------------------------------------------------

async def fetch_repo_structure(
    owner: str, repo: str, default_branch: str
) -> Tuple[str, str]:
    """Return (file_tree_text, readme_content) by querying the GitHub API."""
    import httpx

    headers = {"Accept": "application/vnd.github.v3+json"}

    async with httpx.AsyncClient(timeout=60) as client:
        # --- File tree via git/trees recursive ---
        branches_to_try = [default_branch, "main", "master"]
        # deduplicate while preserving order
        seen = set()
        branches_to_try = [b for b in branches_to_try if not (b in seen or seen.add(b))]  # type: ignore[func-returns-value]

        tree_data = None
        for branch in branches_to_try:
            url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                tree_data = resp.json()
                break

        if not tree_data or "tree" not in tree_data:
            raise RuntimeError(
                f"Could not fetch file tree for {owner}/{repo}. "
                "The repo may not exist, be empty, or be private."
            )

        file_tree = "\n".join(
            item["path"]
            for item in tree_data["tree"]
            if item.get("type") == "blob"
        )

        # --- README ---
        readme_content = ""
        try:
            resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/readme",
                headers=headers,
            )
            if resp.status_code == 200:
                readme_data = resp.json()
                readme_content = b64decode(readme_data.get("content", "")).decode(
                    "utf-8", errors="replace"
                )
        except Exception:
            pass  # README is nice-to-have

    return file_tree, readme_content


# ---------------------------------------------------------------------------
# WebSocket communication with the backend
# ---------------------------------------------------------------------------

async def ws_generate(
    api_url: str,
    request_body: Dict[str, Any],
    timeout_seconds: int = 300,
    label: str = "",
) -> str:
    """
    Connect to the backend /ws/chat, send *request_body*, and collect the
    streamed text response.  Returns the concatenated response string.
    """
    import websockets

    ws_url = api_url.replace("http://", "ws://").replace("https://", "wss://")
    ws_url = f"{ws_url}/ws/chat"

    response_text = ""

    async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
        await ws.send(json.dumps(request_body))

        try:
            async for message in ws:
                if isinstance(message, bytes):
                    message = message.decode("utf-8", errors="replace")
                response_text += message
        except websockets.exceptions.ConnectionClosedOK:
            pass

    if not response_text:
        raise RuntimeError(f"Empty response from backend for {label or 'request'}")

    return response_text


# ---------------------------------------------------------------------------
# Wiki structure determination
# ---------------------------------------------------------------------------

_STRUCTURE_PROMPT_TEMPLATE = """\
Analyze this GitHub repository {owner}/{repo} and create a wiki structure for it.

1. The complete file tree of the project:
<file_tree>
{file_tree}
</file_tree>

2. The README file of the project:
<readme>
{readme}
</readme>

I want to create a wiki for this repository. Determine the most logical structure \
for a wiki based on the repository's content.

IMPORTANT: The wiki content will be generated in {language_name} language.

When designing the wiki structure, include pages that would benefit from visual \
diagrams, such as:
- Architecture overviews
- Data flow descriptions
- Component relationships
- Process workflows
- State machines
- Class hierarchies

Create a structured wiki with the following main sections:
- Overview (general information about the project)
- System Architecture (how the system is designed)
- Core Features (key functionality)
- Data Management/Flow: If applicable, how data is stored, processed, accessed, and managed.
- Frontend Components (UI elements, if applicable.)
- Backend Systems (server-side components)
- Model Integration (AI model connections)
- Deployment/Infrastructure (how to deploy, what's the infrastructure like)
- Extensibility and Customization

Each section should contain relevant pages.

Return your analysis in the following XML format:

<wiki_structure>
  <title>[Overall title for the wiki]</title>
  <description>[Brief description of the repository]</description>
  <sections>
    <section id="section-1">
      <title>[Section title]</title>
      <pages>
        <page_ref>page-1</page_ref>
        <page_ref>page-2</page_ref>
      </pages>
      <subsections>
        <section_ref>section-2</section_ref>
      </subsections>
    </section>
  </sections>
  <pages>
    <page id="page-1">
      <title>[Page title]</title>
      <description>[Brief description of what this page will cover]</description>
      <importance>high|medium|low</importance>
      <relevant_files>
        <file_path>[Path to a relevant file]</file_path>
      </relevant_files>
      <related_pages>
        <related>page-2</related>
      </related_pages>
      <parent_section>section-1</parent_section>
    </page>
  </pages>
</wiki_structure>

IMPORTANT FORMATTING INSTRUCTIONS:
- Return ONLY the valid XML structure specified above
- DO NOT wrap the XML in markdown code blocks
- DO NOT include any explanation text before or after the XML
- Ensure the XML is properly formatted and valid
- Start directly with <wiki_structure> and end with </wiki_structure>

IMPORTANT:
1. Create 8-12 pages that would make a comprehensive wiki for this repository
2. Each page should focus on a specific aspect of the codebase
3. The relevant_files should be actual files from the repository
4. Return ONLY valid XML with the structure specified above
5. For large repositories (500+ files), create broader architectural pages rather than deep-dive pages on individual components
6. Ensure each page covers a distinct architectural concern — avoid overlapping page topics\
"""


_LANG_NAMES = {
    "en": "English",
    "ja": "Japanese",
    "zh": "Mandarin Chinese",
    "zh-tw": "Traditional Chinese",
    "es": "Spanish",
    "kr": "Korean",
    "vi": "Vietnamese",
    "pt-br": "Brazilian Portuguese",
    "fr": "French",
    "ru": "Russian",
}


async def determine_wiki_structure(
    api_url: str,
    owner: str,
    repo: str,
    repo_url: str,
    file_tree: str,
    readme: str,
    provider: str,
    model: Optional[str],
    language: str,
    timeout: int = 300,
    included_dirs: Optional[List[str]] = None,
    excluded_dirs: Optional[List[str]] = None,
    max_files: int = 0,
) -> Dict[str, Any]:
    """Ask the backend LLM to plan the wiki structure; return parsed dict."""
    language_name = _LANG_NAMES.get(language, "English")

    prompt_content = _STRUCTURE_PROMPT_TEMPLATE.format(
        owner=owner,
        repo=repo,
        file_tree=file_tree,
        readme=readme,
        language_name=language_name,
    )

    request_body: Dict[str, Any] = {
        "repo_url": repo_url,
        "type": "github",
        "messages": [{"role": "user", "content": prompt_content}],
        "provider": provider,
        "language": language,
    }
    if model:
        request_body["model"] = model

    # Pass file filter parameters to the backend (newline-separated strings)
    if included_dirs:
        request_body["included_dirs"] = "\n".join(included_dirs)
    if excluded_dirs:
        request_body["excluded_dirs"] = "\n".join(excluded_dirs)
    if max_files > 0:
        request_body["max_files"] = max_files

    _info(f"Sending structure request to backend via WebSocket...")
    raw_response = await ws_generate(
        api_url, request_body, timeout_seconds=timeout, label="wiki-structure"
    )

    # --- Parse the response ---
    # Try the backend's parser first (it handles malformed XML/JSON gracefully)
    import httpx
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{api_url}/api/parse_wiki_structure",
            json={"raw_text": raw_response, "output_format": "json"},
        )
        if resp.status_code == 200:
            structure = resp.json()
            if structure and structure.get("pages"):
                return structure

    # Fallback: try simple XML extraction locally
    structure = _parse_xml_structure(raw_response)
    if structure and structure.get("pages"):
        return structure

    raise RuntimeError(
        "Failed to parse wiki structure from LLM response. "
        f"Response length: {len(raw_response)} chars."
    )


def _parse_xml_structure(raw_text: str) -> Optional[Dict[str, Any]]:
    """Best-effort local XML parser for <wiki_structure> blocks."""
    # Strip code fences
    cleaned = re.sub(r"^```(?:xml|json)?\s*", "", raw_text.strip())
    cleaned = re.sub(r"```\s*$", "", cleaned)

    m = re.search(r"<wiki_structure>[\s\S]*?</wiki_structure>", cleaned)
    if not m:
        return None

    xml_text = m.group(0)
    # Remove control chars that break XML parsers
    xml_text = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", xml_text)

    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return None

    title = (root.findtext("title") or "").strip()
    description = (root.findtext("description") or "").strip()

    pages: List[Dict[str, Any]] = []
    for page_el in root.iter("page"):
        page_id = page_el.get("id", f"page-{len(pages) + 1}")
        page_title = (page_el.findtext("title") or "").strip()
        importance = (page_el.findtext("importance") or "medium").strip().lower()
        if importance not in ("high", "medium", "low"):
            importance = "medium"

        file_paths = [
            fp.text.strip()
            for fp in page_el.iter("file_path")
            if fp.text and fp.text.strip()
        ]
        related = [
            r.text.strip()
            for r in page_el.iter("related")
            if r.text and r.text.strip()
        ]

        pages.append({
            "id": page_id,
            "title": page_title,
            "content": "",
            "filePaths": file_paths,
            "importance": importance,
            "relatedPages": related,
        })

    sections: List[Dict[str, Any]] = []
    root_sections: List[str] = []
    for sec_el in root.iter("section"):
        sec_id = sec_el.get("id", f"section-{len(sections) + 1}")
        sec_title = (sec_el.findtext("title") or "").strip()
        sec_pages = [
            pr.text.strip()
            for pr in sec_el.iter("page_ref")
            if pr.text and pr.text.strip()
        ]
        subsections = [
            sr.text.strip()
            for sr in sec_el.iter("section_ref")
            if sr.text and sr.text.strip()
        ]
        sections.append({
            "id": sec_id,
            "title": sec_title,
            "pages": sec_pages,
            "subsections": subsections if subsections else None,
        })

    # Determine root sections (those not referenced as subsections)
    referenced = set()
    for s in sections:
        for sub in (s.get("subsections") or []):
            referenced.add(sub)
    root_sections = [s["id"] for s in sections if s["id"] not in referenced]

    return {
        "title": title,
        "description": description,
        "pages": pages,
        "sections": sections,
        "rootSections": root_sections,
    }


# ---------------------------------------------------------------------------
# Page content generation
# ---------------------------------------------------------------------------

_PAGE_PROMPT_TEMPLATE = """\
You are an expert technical writer and software architect.
Your task is to generate a comprehensive and accurate technical wiki page in \
Markdown format about a specific feature, system, or module within a given \
software project.

You will be given:
1. The "[WIKI_PAGE_TOPIC]" for the page you need to create.
2. A list of "[RELEVANT_SOURCE_FILES]" from the project that you MUST use as \
the sole basis for the content. You have access to the full content of these files. \
You MUST use AT LEAST 5 relevant source files for comprehensive coverage.

CRITICAL STARTING INSTRUCTION:
The very first thing on the page MUST be a `<details>` block listing ALL the \
`[RELEVANT_SOURCE_FILES]` you used to generate the content.
Format it exactly like this:
<details>
<summary>Relevant source files</summary>

The following files were used as context for generating this wiki page:

{file_links}
</details>

Immediately after the `<details>` block, the main title of the page should be \
a H1 Markdown heading: `# {page_title}`.

Based ONLY on the content of the `[RELEVANT_SOURCE_FILES]`:

1. **Introduction:** Start with a concise introduction explaining the purpose and \
scope of "{page_title}" within the context of the overall project.

2. **Detailed Sections:** Break down "{page_title}" into logical sections using \
H2 and H3 headings. Explain architecture, components, data flow, or logic.

3. **Mermaid Diagrams:** EXTENSIVELY use Mermaid diagrams to visually represent \
architectures, flows, relationships. Use "graph TD" (top-down) directive. For \
sequence diagrams, define ALL participants at the beginning.

   **Structured Diagram Data:** When you generate a Mermaid diagram, produce a \
structured JSON block IMMEDIATELY BEFORE the Mermaid code fence:
   ```
   <!-- DIAGRAM_DATA_START -->
   {{
     "nodes": [...],
     "edges": [...],
     "mermaidSource": "...",
     "diagramType": "flowchart"
   }}
   <!-- DIAGRAM_DATA_END -->
   ```

4. **Tables:** Use Markdown tables to summarize key features, API endpoints, etc.

5. **Code Snippets:** Include short, relevant code snippets from the source files.

6. **Source Citations:** Cite specific source file(s) and line numbers. Use: \
`Sources: [filename.ext:start_line-end_line]()`.

7. **Technical Accuracy:** All information must be derived SOLELY from source files.

8. **Clarity and Conciseness:** Use clear, professional technical language.

9. **Large Repo Guidance:** For large codebases, focus on how components interact \
rather than implementation details of individual files. Diagrams should show data \
flow and dependencies between modules, not class hierarchies within a single module.

IMPORTANT: Generate the content in {language_name} language.\
"""


async def generate_page_content(
    api_url: str,
    page: Dict[str, Any],
    repo_url: str,
    provider: str,
    model: Optional[str],
    language: str,
    timeout: int = 300,
    included_dirs: Optional[List[str]] = None,
    excluded_dirs: Optional[List[str]] = None,
    max_files: int = 0,
) -> str:
    """Generate content for a single wiki page via the backend WebSocket."""
    language_name = _LANG_NAMES.get(language, "English")

    file_paths = page.get("filePaths", [])
    file_links = "\n".join(f"- [{fp}]()" for fp in file_paths) if file_paths else "- (no specific files)"

    prompt_content = _PAGE_PROMPT_TEMPLATE.format(
        file_links=file_links,
        page_title=page["title"],
        language_name=language_name,
    )

    request_body: Dict[str, Any] = {
        "repo_url": repo_url,
        "type": "github",
        "messages": [{"role": "user", "content": prompt_content}],
        "provider": provider,
        "language": language,
    }
    if model:
        request_body["model"] = model

    # Pass file filter parameters to the backend (newline-separated strings)
    if included_dirs:
        request_body["included_dirs"] = "\n".join(included_dirs)
    if excluded_dirs:
        request_body["excluded_dirs"] = "\n".join(excluded_dirs)
    if max_files > 0:
        request_body["max_files"] = max_files

    raw = await ws_generate(
        api_url, request_body, timeout_seconds=timeout, label=f"page:{page['title']}"
    )

    # Strip wrapping code fences the LLM sometimes adds
    content = re.sub(r"^```(?:markdown)?\s*", "", raw.strip())
    content = re.sub(r"```\s*$", "", content)

    return content


_ERROR_CONTENT_PREFIX = "Error generating content: "


def _is_failed_page(page: Dict[str, Any]) -> bool:
    """Check whether a page has error content instead of real wiki content."""
    content = page.get("content", "")
    return content.startswith(_ERROR_CONTENT_PREFIX) or not content.strip()


async def generate_all_pages(
    api_url: str,
    pages: List[Dict[str, Any]],
    repo_url: str,
    provider: str,
    model: Optional[str],
    language: str,
    concurrency: int = 5,
    timeout: int = 300,
    delay: float = 0.0,
    retry_failed: bool = False,
    max_retries: int = 2,
    included_dirs: Optional[List[str]] = None,
    excluded_dirs: Optional[List[str]] = None,
    max_files: int = 0,
) -> Dict[str, Dict[str, Any]]:
    """Generate content for all pages with bounded concurrency.

    Returns a dict mapping page_id -> full page dict (with content populated).

    Args:
        delay: Seconds to wait between starting each page generation request.
            Helps avoid API rate limits on large repos.
        retry_failed: When True, automatically retry pages whose content starts
            with ``_ERROR_CONTENT_PREFIX`` (up to *max_retries* rounds).
        max_retries: Maximum number of retry rounds for failed pages.
    """
    sem = asyncio.Semaphore(concurrency)
    generated: Dict[str, Dict[str, Any]] = {}
    total = len(pages)
    completed = 0
    failed = 0
    lock = asyncio.Lock()

    # Track the page dispatch index so we can stagger starts by *delay*.
    dispatch_index = 0
    dispatch_lock = asyncio.Lock()

    async def _gen_one(page: Dict[str, Any]) -> None:
        nonlocal completed, failed, dispatch_index
        async with sem:
            # Stagger page starts by *delay* seconds.
            if delay > 0:
                async with dispatch_lock:
                    my_index = dispatch_index
                    dispatch_index += 1
                if my_index > 0:
                    await asyncio.sleep(delay * my_index)

            page_id = page["id"]
            page_title = page["title"]
            try:
                content = await generate_page_content(
                    api_url, page, repo_url, provider, model, language, timeout,
                    included_dirs=included_dirs, excluded_dirs=excluded_dirs,
                    max_files=max_files,
                )
                full_page = {**page, "content": content}
                async with lock:
                    generated[page_id] = full_page
                    completed += 1
                _ok(f"[{completed}/{total}] {page_title} ({len(content):,} chars)")
            except Exception as exc:
                async with lock:
                    # Store page with error content so it's not silently lost
                    generated[page_id] = {
                        **page,
                        "content": f"{_ERROR_CONTENT_PREFIX}{exc}",
                    }
                    completed += 1
                    failed += 1
                _err(f"[{completed}/{total}] {page_title}: {exc}")

    tasks = [asyncio.create_task(_gen_one(p)) for p in pages]
    await asyncio.gather(*tasks)

    if failed:
        _warn(f"{failed}/{total} pages failed to generate")

    # ---- Retry logic for failed pages ----
    if retry_failed and failed > 0:
        for retry_round in range(1, max_retries + 1):
            failed_pages = [
                generated[pid] for pid in generated if _is_failed_page(generated[pid])
            ]
            if not failed_pages:
                break

            _info(
                f"Retry round {retry_round}/{max_retries}: "
                f"retrying {len(failed_pages)} failed page(s) ..."
            )

            # Reset counters for the retry round
            retry_completed = 0
            retry_failed_count = 0
            retry_total = len(failed_pages)
            # Reset dispatch index for the retry round
            dispatch_index = 0

            async def _retry_one(page: Dict[str, Any]) -> None:
                nonlocal retry_completed, retry_failed_count, dispatch_index
                async with sem:
                    # Stagger retries the same way
                    if delay > 0:
                        async with dispatch_lock:
                            my_index = dispatch_index
                            dispatch_index += 1
                        if my_index > 0:
                            await asyncio.sleep(delay * my_index)

                    page_id = page["id"]
                    page_title = page["title"]
                    try:
                        content = await generate_page_content(
                            api_url, page, repo_url, provider, model, language, timeout,
                            included_dirs=included_dirs, excluded_dirs=excluded_dirs,
                            max_files=max_files,
                        )
                        full_page = {**page, "content": content}
                        async with lock:
                            generated[page_id] = full_page
                            retry_completed += 1
                        _ok(
                            f"  [retry {retry_round}] [{retry_completed}/{retry_total}] "
                            f"{page_title} ({len(content):,} chars)"
                        )
                    except Exception as exc:
                        async with lock:
                            generated[page_id] = {
                                **page,
                                "content": f"{_ERROR_CONTENT_PREFIX}{exc}",
                            }
                            retry_completed += 1
                            retry_failed_count += 1
                        _err(
                            f"  [retry {retry_round}] [{retry_completed}/{retry_total}] "
                            f"{page_title}: {exc}"
                        )

            retry_tasks = [asyncio.create_task(_retry_one(p)) for p in failed_pages]
            await asyncio.gather(*retry_tasks)

            if retry_failed_count == 0:
                _ok(f"Retry round {retry_round}: all {retry_total} page(s) recovered!")
                break
            else:
                _warn(
                    f"Retry round {retry_round}: "
                    f"{retry_failed_count}/{retry_total} page(s) still failed"
                )

    return generated


# ---------------------------------------------------------------------------
# Save to backend wiki cache (POST /api/wiki_cache)
# ---------------------------------------------------------------------------

async def save_wiki_cache(
    api_url: str,
    owner: str,
    repo: str,
    language: str,
    wiki_structure: Dict[str, Any],
    generated_pages: Dict[str, Dict[str, Any]],
    provider: str,
    model: Optional[str],
    repo_url: str,
) -> bool:
    """Save generated wiki data.

    First tries the backend HTTP endpoint (POST /api/wiki_cache).  If that
    fails (e.g. because of auth requirements), falls back to using the
    ``api.storage`` layer directly (works when this script runs on the same
    machine with the same env vars as the backend).
    """
    import httpx

    payload = {
        "repo": {
            "owner": owner,
            "repo": repo,
            "type": "github",
            "repoUrl": repo_url,
        },
        "language": language,
        "wiki_structure": wiki_structure,
        "generated_pages": generated_pages,
        "provider": provider,
        "model": model or "",
        "template": "comprehensive",
    }

    # --- Strategy 1: POST to the running backend ---
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{api_url}/api/wiki_cache",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code == 200:
                return True
            elif resp.status_code in (401, 403, 503):
                _warn(
                    f"HTTP endpoint returned {resp.status_code} (auth issue) "
                    f"-- falling back to direct storage write"
                )
            else:
                _warn(
                    f"HTTP endpoint returned {resp.status_code} "
                    f"-- falling back to direct storage write"
                )
    except Exception as exc:
        _warn(f"HTTP endpoint unreachable ({exc}) -- falling back to direct storage write")

    # --- Strategy 2: Direct storage write (same machine) ---
    try:
        from api.storage import get_storage

        storage = get_storage()
        success = await storage.save_wiki_cache(
            owner, repo, "github", language, payload
        )
        if success:
            _info("Saved via direct storage backend")
            return True
        else:
            _err("Direct storage write returned False")
            return False
    except Exception as exc:
        _err(f"Direct storage write failed: {exc}")
        return False


# ---------------------------------------------------------------------------
# Supabase upsert
# ---------------------------------------------------------------------------

def upsert_supabase(
    owner: str,
    repo: str,
    language: str,
    description: str,
    tags: List[str],
    stars: int,
    github_url: str,
    page_count: int,
    is_featured: bool = False,
) -> Optional[Dict[str, Any]]:
    """Upsert the wiki_projects row in Supabase. Returns the row or None."""
    try:
        from api.supabase_client import db

        cache_key = f"deepwiki_cache_github_{owner}_{repo}_{language}.json"
        result = db.upsert_wiki_project(
            owner=owner,
            repo=repo,
            repo_type="github",
            language=language,
            title=f"{owner}/{repo}",
            description=description,
            tags=tags,
            is_published=True,
            is_featured=is_featured,
            star_count=stars,
            page_count=page_count,
            gcs_cache_path=cache_key,
        )
        return result
    except RuntimeError as exc:
        _warn(f"Supabase not configured: {exc}")
        return None
    except Exception as exc:
        _err(f"Supabase upsert failed: {exc}")
        return None


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------

TOTAL_STEPS = 6


async def main() -> None:
    args = parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.WARNING)

    _header("BetterCodeWiki Ingest")

    # --- Step 1: Parse repo ---
    _step(1, TOTAL_STEPS, "Parsing repository identifier")

    try:
        owner, repo, repo_url = normalise_repo(args.repo)
    except ValueError as exc:
        _err(str(exc))
        sys.exit(1)

    tags = [t.strip() for t in args.tags.split(",") if t.strip()] if args.tags else []
    _ok(f"Repository: {_C.BOLD}{owner}/{repo}{_C.RESET}")
    _info(f"URL: {repo_url}")
    if tags:
        _info(f"Tags: {', '.join(tags)}")
    # Parse file filter CLI args into lists
    include_dirs = [d.strip() for d in args.include_dirs.split(",") if d.strip()] if args.include_dirs else []
    exclude_dirs = [d.strip() for d in args.exclude_dirs.split(",") if d.strip()] if args.exclude_dirs else []
    max_files = args.max_files

    _info(f"Provider: {args.provider}  Model: {args.model or '(default)'}")
    _info(f"Language: {args.language}")
    _info(f"API URL: {args.api_url}")
    if include_dirs:
        _info(f"Include dirs: {', '.join(include_dirs)}")
    if exclude_dirs:
        _info(f"Exclude dirs: {', '.join(exclude_dirs)}")
    if max_files > 0:
        _info(f"Max files: {max_files}")

    # --- Step 2: Fetch GitHub metadata ---
    _step(2, TOTAL_STEPS, "Fetching GitHub metadata")

    try:
        meta = await fetch_github_metadata(owner, repo)
    except Exception as exc:
        _err(f"Failed to fetch GitHub metadata: {exc}")
        sys.exit(1)

    _ok(f"Description: {meta['description'][:100] or '(none)'}{'...' if len(meta['description']) > 100 else ''}")
    _info(f"Stars: {meta['stargazers_count']:,}  Forks: {meta['forks_count']:,}  Language: {meta['language'] or 'N/A'}")
    if meta["topics"]:
        _info(f"Topics: {', '.join(meta['topics'][:10])}")

    # --- Dry run exit ---
    if args.dry_run:
        print(f"\n{_C.YELLOW}{_C.BOLD}DRY RUN{_C.RESET} -- would proceed with:\n")
        print(f"  {_C.ARROW} Generate wiki structure via {args.api_url}/ws/chat")
        print(f"  {_C.ARROW} Generate 8-12 page contents via WebSocket")
        print(f"  {_C.ARROW} Save wiki cache via POST {args.api_url}/api/wiki_cache")
        if not args.skip_supabase:
            print(f"  {_C.ARROW} Upsert Supabase wiki_projects row")
        print(f"\n  Exiting (--dry-run).\n")
        sys.exit(0)

    # --- Step 3: Fetch repo structure (file tree + README) ---
    _step(3, TOTAL_STEPS, "Fetching repository file tree and README")

    try:
        file_tree, readme = await fetch_repo_structure(
            owner, repo, meta["default_branch"]
        )
    except Exception as exc:
        _err(f"Failed to fetch repo structure: {exc}")
        sys.exit(1)

    file_count = len(file_tree.strip().splitlines()) if file_tree.strip() else 0
    _ok(f"File tree: {file_count:,} files")
    _info(f"README: {len(readme):,} chars")

    # --- Step 4: Determine wiki structure ---
    _step(4, TOTAL_STEPS, "Determining wiki structure via LLM")

    t0 = time.monotonic()
    try:
        wiki_structure = await determine_wiki_structure(
            api_url=args.api_url,
            owner=owner,
            repo=repo,
            repo_url=repo_url,
            file_tree=file_tree,
            readme=readme,
            provider=args.provider,
            model=args.model,
            language=args.language,
            timeout=args.timeout,
            included_dirs=include_dirs or None,
            excluded_dirs=exclude_dirs or None,
            max_files=max_files,
        )
    except Exception as exc:
        _err(f"Failed to determine wiki structure: {exc}")
        sys.exit(1)

    elapsed_structure = time.monotonic() - t0
    pages = wiki_structure.get("pages", [])
    sections = wiki_structure.get("sections", [])
    _ok(
        f"Wiki structure: {_C.BOLD}{len(pages)} pages{_C.RESET}, "
        f"{len(sections)} sections  ({elapsed_structure:.1f}s)"
    )
    _info(f"Title: {wiki_structure.get('title', '(untitled)')}")
    for p in pages:
        _info(f"  {_C.ARROW} [{p.get('importance', '?'):>6}] {p['title']}")

    # --- Step 5: Generate page content ---
    delay_info = f", delay={args.delay}s" if args.delay > 0 else ""
    retry_info = f", retry-failed (max {args.max_retries})" if args.retry_failed else ""
    _step(
        5, TOTAL_STEPS,
        f"Generating content for {len(pages)} pages "
        f"(concurrency={args.concurrency}{delay_info}{retry_info})",
    )

    t0 = time.monotonic()
    generated_pages = await generate_all_pages(
        api_url=args.api_url,
        pages=pages,
        repo_url=repo_url,
        provider=args.provider,
        model=args.model,
        language=args.language,
        concurrency=args.concurrency,
        timeout=args.timeout,
        delay=args.delay,
        retry_failed=args.retry_failed,
        max_retries=args.max_retries,
        included_dirs=include_dirs or None,
        excluded_dirs=exclude_dirs or None,
        max_files=max_files,
    )
    elapsed_pages = time.monotonic() - t0

    total_chars = sum(len(p.get("content", "")) for p in generated_pages.values())
    _ok(f"Generated {len(generated_pages)} pages in {elapsed_pages:.1f}s ({total_chars:,} total chars)")

    # --- Step 6: Publish ---
    _step(6, TOTAL_STEPS, "Publishing to production stack")

    # 6a. Save via wiki cache endpoint
    _info(f"Saving wiki cache via POST {args.api_url}/api/wiki_cache ...")
    cache_ok = await save_wiki_cache(
        api_url=args.api_url,
        owner=owner,
        repo=repo,
        language=args.language,
        wiki_structure=wiki_structure,
        generated_pages=generated_pages,
        provider=args.provider,
        model=args.model,
        repo_url=repo_url,
    )
    if cache_ok:
        _ok("Wiki cache saved successfully")
    else:
        _err("Wiki cache save failed (see error above)")

    # 6b. Supabase upsert
    supabase_row = None
    if not args.skip_supabase:
        _info("Upserting Supabase wiki_projects row ...")
        supabase_row = upsert_supabase(
            owner=owner,
            repo=repo,
            language=args.language,
            description=meta["description"],
            tags=tags,
            stars=meta["stargazers_count"],
            github_url=meta["html_url"],
            page_count=len(generated_pages),
            is_featured=args.featured,
        )
        if supabase_row:
            _ok(f"Supabase upserted (id: {supabase_row.get('id', 'N/A')})")
    else:
        _info("Skipping Supabase upsert (--skip-supabase)")

    # --- Summary ---
    _header("Ingest Complete")

    cache_filename = f"deepwiki_cache_github_{owner}_{repo}_{args.language}.json"
    print(f"  Repository:   {_C.BOLD}{owner}/{repo}{_C.RESET}")
    print(f"  Pages:        {len(generated_pages)}")
    print(f"  Total chars:  {total_chars:,}")
    print(f"  Cache key:    {cache_filename}")
    print(f"  Cache saved:  {'yes' if cache_ok else 'FAILED'}")
    if supabase_row:
        print(f"  Supabase id:  {supabase_row.get('id', 'N/A')}")
    elif args.skip_supabase:
        print(f"  Supabase:     skipped")
    else:
        print(f"  Supabase:     not configured or failed")
    print(f"  Time:         {elapsed_structure + elapsed_pages:.1f}s total")
    print()


if __name__ == "__main__":
    asyncio.run(main())
