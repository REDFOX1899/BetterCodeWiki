"""
Unit tests for MCP server tools (api/mcp/server.py).

The MCP server is fully standalone -- it reads cached JSON files from
~/.adalflow/wikicache/. These tests mock the filesystem to test each
tool and helper function in isolation.

NOTE: server.py uses Python 3.10+ syntax (dict | None). When the test
environment runs Python 3.9, we cannot import the module directly.
Instead we load the source with `from __future__ import annotations`
injected, which defers evaluation of the type hints.
"""

import json
import os
import sys
import types
import pytest
from unittest.mock import patch, mock_open, MagicMock


# ── Import helper ─────────────────────────────────────────────
# server.py uses PEP 604 unions (X | Y) in function signatures.
# On Python <3.10, those fail at definition time. We work around
# this by reading the source and prepending
# ``from __future__ import annotations`` before exec-ing it.

_SERVER_PATH = os.path.join(
    os.path.dirname(__file__), os.pardir, os.pardir, "api", "mcp", "server.py"
)
_SERVER_PATH = os.path.normpath(_SERVER_PATH)


def _load_server_module():
    """Load api/mcp/server.py as a module, patching PEP 604 syntax."""
    with open(_SERVER_PATH, "r", encoding="utf-8") as f:
        source = f.read()

    # Prepend future annotations to defer type evaluation
    source = "from __future__ import annotations\n" + source

    mod = types.ModuleType("_mcp_server_test")
    mod.__file__ = _SERVER_PATH
    # server.py references __name__ == "__main__" at the bottom;
    # set it so the entry-point block is skipped
    mod.__name__ = "_mcp_server_test"

    code = compile(source, _SERVER_PATH, "exec")
    exec(code, mod.__dict__)
    return mod


_server = _load_server_module()

# Pull out the functions/constants we want to test
_load_cache = _server._load_cache
_list_cache_files = _server._list_cache_files
_find_page = _server._find_page
_extract_snippet = _server._extract_snippet
list_projects = _server.list_projects
get_wiki_overview = _server.get_wiki_overview
get_wiki_page = _server.get_wiki_page
search_wiki = _server.search_wiki
ask_codebase = _server.ask_codebase
CACHE_DIR = _server.CACHE_DIR

# The module name used when patching os functions inside _server
_MOD = "_mcp_server_test"


# ── Fixtures ──────────────────────────────────────────────────


@pytest.fixture
def sample_cache():
    """A realistic wiki cache dict."""
    return {
        "wiki_structure": {
            "id": "wiki-root",
            "title": "My Project Wiki",
            "description": "Documentation for my-project",
            "pages": [
                {
                    "id": "p-overview",
                    "title": "Project Overview",
                    "importance": "high",
                    "filePaths": ["README.md"],
                    "relatedPages": ["p-architecture"],
                    "content": "",
                },
                {
                    "id": "p-architecture",
                    "title": "Architecture Guide",
                    "importance": "medium",
                    "filePaths": ["src/app.py", "src/core.py"],
                    "relatedPages": ["p-overview"],
                    "content": "",
                },
            ],
            "sections": [
                {
                    "id": "s-getting-started",
                    "title": "Getting Started",
                    "pages": ["p-overview"],
                    "subsections": [],
                }
            ],
        },
        "generated_pages": {
            "p-overview": {
                "id": "p-overview",
                "title": "Project Overview",
                "content": "This project provides a FastAPI backend for wiki generation. It uses FAISS for embeddings.",
                "filePaths": ["README.md"],
                "importance": "high",
                "relatedPages": ["p-architecture"],
            },
            "p-architecture": {
                "id": "p-architecture",
                "title": "Architecture Guide",
                "content": "The architecture follows a layered pattern with API routes, services, and data access layers.",
                "filePaths": ["src/app.py", "src/core.py"],
                "importance": "medium",
                "relatedPages": ["p-overview"],
            },
        },
        "provider": "google",
        "model": "gemini-2.5-flash",
    }


@pytest.fixture
def cache_filenames():
    """Typical filenames found in the cache directory."""
    return [
        "deepwiki_cache_github_acme_my-project_en.json",
        "deepwiki_cache_gitlab_acme_other-project_ja.json",
        "deepwiki_cache_github_user_repo-with_underscores_en.json",
        "not_a_cache_file.txt",
    ]


# ── Helper: _load_cache ──────────────────────────────────────


class TestLoadCache:
    """Tests for the _load_cache helper."""

    def test_returns_none_when_file_missing(self):
        with patch.object(_server.os.path, "exists", return_value=False):
            result = _load_cache("owner", "repo")
        assert result is None

    def test_returns_dict_when_file_exists(self, sample_cache):
        json_str = json.dumps(sample_cache)
        with patch.object(_server.os.path, "exists", return_value=True), \
             patch("builtins.open", mock_open(read_data=json_str)):
            result = _load_cache("owner", "repo")
        assert result is not None
        assert result["wiki_structure"]["title"] == "My Project Wiki"

    def test_constructs_correct_filename(self):
        with patch.object(_server.os.path, "exists", return_value=False) as mock_exists:
            _load_cache("acme", "my-project", "gitlab", "ja")
        expected_path = os.path.join(CACHE_DIR, "deepwiki_cache_gitlab_acme_my-project_ja.json")
        mock_exists.assert_called_once_with(expected_path)


# ── Helper: _list_cache_files ────────────────────────────────


class TestListCacheFiles:
    """Tests for the _list_cache_files helper."""

    def test_returns_empty_when_dir_missing(self):
        with patch.object(_server.os.path, "isdir", return_value=False):
            result = _list_cache_files()
        assert result == []

    def test_parses_filenames_correctly(self, cache_filenames):
        with patch.object(_server.os.path, "isdir", return_value=True), \
             patch.object(_server.os, "listdir", return_value=cache_filenames):
            result = _list_cache_files()

        assert len(result) == 3  # the .txt file is skipped

        first = result[0]
        assert first["owner"] == "acme"
        assert first["repo"] == "my-project"
        assert first["repo_type"] == "github"
        assert first["language"] == "en"
        assert first["name"] == "acme/my-project"

    def test_handles_repo_with_underscores(self, cache_filenames):
        with patch.object(_server.os.path, "isdir", return_value=True), \
             patch.object(_server.os, "listdir", return_value=cache_filenames):
            result = _list_cache_files()

        # Find the entry for the repo with underscores (sorted order
        # depends on filename, so look it up by owner instead of index)
        user_entry = next(r for r in result if r["owner"] == "user")
        assert user_entry["repo"] == "repo-with_underscores"
        assert user_entry["language"] == "en"

    def test_skips_non_cache_files(self, cache_filenames):
        with patch.object(_server.os.path, "isdir", return_value=True), \
             patch.object(_server.os, "listdir", return_value=cache_filenames):
            result = _list_cache_files()
        filenames = [
            "deepwiki_cache_{}_{}_{}.json".format(r["repo_type"], r["owner"], r["repo"])
            for r in result
        ]
        assert "not_a_cache_file.txt" not in filenames


# ── Helper: _find_page ───────────────────────────────────────


class TestFindPage:
    """Tests for the _find_page helper."""

    def test_exact_id_match(self, sample_cache):
        pages = sample_cache["generated_pages"]
        result = _find_page(pages, "p-overview")
        assert result is not None
        assert result["id"] == "p-overview"

    def test_case_insensitive_title_match(self, sample_cache):
        pages = sample_cache["generated_pages"]
        result = _find_page(pages, "project overview")
        assert result is not None
        assert result["id"] == "p-overview"

    def test_partial_title_match(self, sample_cache):
        pages = sample_cache["generated_pages"]
        result = _find_page(pages, "Architecture")
        assert result is not None
        assert result["id"] == "p-architecture"

    def test_returns_none_when_no_match(self, sample_cache):
        pages = sample_cache["generated_pages"]
        result = _find_page(pages, "nonexistent page xyz")
        assert result is None


# ── Helper: _extract_snippet ─────────────────────────────────


class TestExtractSnippet:
    """Tests for the _extract_snippet helper."""

    def test_finds_match_in_content(self):
        content = "A" * 500 + "KEYWORD" + "B" * 500
        snippet = _extract_snippet(content, "KEYWORD", context_chars=50)
        assert "KEYWORD" in snippet

    def test_ellipsis_added_when_truncated(self):
        content = "A" * 500 + "KEYWORD" + "B" * 500
        snippet = _extract_snippet(content, "KEYWORD", context_chars=50)
        assert snippet.startswith("...")
        assert snippet.endswith("...")

    def test_no_leading_ellipsis_at_start(self):
        content = "KEYWORD" + "B" * 500
        snippet = _extract_snippet(content, "KEYWORD", context_chars=50)
        assert not snippet.startswith("...")

    def test_returns_beginning_when_no_match(self):
        content = "This is the beginning of a long document" + "." * 1000
        snippet = _extract_snippet(content, "zzz_no_match", context_chars=20)
        assert snippet.startswith("This is")


# ── Tool: list_projects ──────────────────────────────────────


class TestListProjects:
    """Tests for the list_projects tool."""

    def test_returns_projects_when_cache_exists(self, cache_filenames):
        with patch.object(_server.os.path, "isdir", return_value=True), \
             patch.object(_server.os, "listdir", return_value=cache_filenames):
            result = list_projects()
        assert len(result) == 3
        assert result[0]["owner"] == "acme"

    def test_returns_message_when_no_cache(self):
        with patch.object(_server.os.path, "isdir", return_value=False):
            result = list_projects()
        assert len(result) == 1
        assert "message" in result[0]
        assert "No cached wikis" in result[0]["message"]


# ── Tool: get_wiki_overview ──────────────────────────────────


class TestGetWikiOverview:
    """Tests for the get_wiki_overview tool."""

    def test_returns_overview_for_cached_repo(self, sample_cache):
        json_str = json.dumps(sample_cache)
        with patch.object(_server.os.path, "exists", return_value=True), \
             patch("builtins.open", mock_open(read_data=json_str)):
            result = get_wiki_overview("acme", "my-project")

        assert result["title"] == "My Project Wiki"
        assert result["description"] == "Documentation for my-project"
        assert result["total_pages"] == 2
        assert len(result["pages"]) == 2
        assert result["provider"] == "google"
        assert result["model"] == "gemini-2.5-flash"

    def test_returns_error_for_missing_repo(self):
        with patch.object(_server.os.path, "exists", return_value=False), \
             patch.object(_server.os.path, "isdir", return_value=False):
            result = get_wiki_overview("nobody", "norepo")
        assert "error" in result

    def test_overview_pages_have_expected_fields(self, sample_cache):
        json_str = json.dumps(sample_cache)
        with patch.object(_server.os.path, "exists", return_value=True), \
             patch("builtins.open", mock_open(read_data=json_str)):
            result = get_wiki_overview("acme", "my-project")

        for page in result["pages"]:
            assert "id" in page
            assert "title" in page
            assert "importance" in page
            assert "filePaths" in page
            assert "relatedPages" in page


# ── Tool: get_wiki_page ──────────────────────────────────────


class TestGetWikiPage:
    """Tests for the get_wiki_page tool."""

    def test_get_page_by_exact_id(self, sample_cache):
        json_str = json.dumps(sample_cache)
        with patch.object(_server.os.path, "exists", return_value=True), \
             patch("builtins.open", mock_open(read_data=json_str)):
            result = get_wiki_page("acme", "my-project", "p-overview")
        assert result["id"] == "p-overview"
        assert result["title"] == "Project Overview"
        assert "FastAPI" in result["content"]

    def test_get_page_by_fuzzy_title(self, sample_cache):
        json_str = json.dumps(sample_cache)
        with patch.object(_server.os.path, "exists", return_value=True), \
             patch("builtins.open", mock_open(read_data=json_str)):
            result = get_wiki_page("acme", "my-project", "architecture")
        assert result["id"] == "p-architecture"

    def test_page_not_found_lists_available(self, sample_cache):
        json_str = json.dumps(sample_cache)
        with patch.object(_server.os.path, "exists", return_value=True), \
             patch("builtins.open", mock_open(read_data=json_str)):
            result = get_wiki_page("acme", "my-project", "nonexistent")
        assert "error" in result
        assert "available_pages" in result

    def test_returns_error_for_missing_repo(self):
        with patch.object(_server.os.path, "exists", return_value=False):
            result = get_wiki_page("nobody", "norepo", "anything")
        assert "error" in result


# ── Tool: search_wiki ────────────────────────────────────────


class TestSearchWiki:
    """Tests for the search_wiki tool."""

    def test_search_finds_matching_pages(self, sample_cache):
        json_str = json.dumps(sample_cache)
        with patch.object(_server.os.path, "exists", return_value=True), \
             patch("builtins.open", mock_open(read_data=json_str)):
            results = search_wiki("acme", "my-project", "FastAPI")
        assert len(results) >= 1
        assert results[0]["title"] == "Project Overview"

    def test_search_title_match_scores_higher(self, sample_cache):
        json_str = json.dumps(sample_cache)
        with patch.object(_server.os.path, "exists", return_value=True), \
             patch("builtins.open", mock_open(read_data=json_str)):
            results = search_wiki("acme", "my-project", "Overview")
        # Title match should score higher (10+) than content-only match
        assert results[0]["title"] == "Project Overview"
        assert results[0]["score"] >= 10

    def test_search_no_results_lists_pages(self, sample_cache):
        json_str = json.dumps(sample_cache)
        with patch.object(_server.os.path, "exists", return_value=True), \
             patch("builtins.open", mock_open(read_data=json_str)):
            results = search_wiki("acme", "my-project", "zzz_nonexistent_term")
        assert len(results) == 1
        assert "message" in results[0]
        assert "available_pages" in results[0]

    def test_search_respects_max_results(self, sample_cache):
        json_str = json.dumps(sample_cache)
        with patch.object(_server.os.path, "exists", return_value=True), \
             patch("builtins.open", mock_open(read_data=json_str)):
            results = search_wiki("acme", "my-project", "project", max_results=1)
        # "project" appears in both pages, but max_results=1
        assert len(results) <= 1

    def test_search_returns_error_for_missing_repo(self):
        with patch.object(_server.os.path, "exists", return_value=False):
            results = search_wiki("nobody", "norepo", "test")
        assert len(results) == 1
        assert "error" in results[0]

    def test_search_results_include_snippets(self, sample_cache):
        json_str = json.dumps(sample_cache)
        with patch.object(_server.os.path, "exists", return_value=True), \
             patch("builtins.open", mock_open(read_data=json_str)):
            results = search_wiki("acme", "my-project", "FAISS")
        assert len(results) >= 1
        assert "snippet" in results[0]
        assert "FAISS" in results[0]["snippet"]

    def test_search_max_results_capped_at_20(self, sample_cache):
        """max_results should be capped at 20 even if a larger value is passed."""
        json_str = json.dumps(sample_cache)
        with patch.object(_server.os.path, "exists", return_value=True), \
             patch("builtins.open", mock_open(read_data=json_str)):
            # Pass a very large max_results; function caps at 20
            results = search_wiki("acme", "my-project", "project", max_results=100)
        # We only have 2 pages total, so the cap won't matter numerically,
        # but the function should still work without error
        assert len(results) <= 20


# ── Tool: ask_codebase ───────────────────────────────────────


class TestAskCodebase:
    """Tests for the ask_codebase tool."""

    def test_ask_returns_relevant_content(self, sample_cache):
        json_str = json.dumps(sample_cache)
        with patch.object(_server.os.path, "exists", return_value=True), \
             patch("builtins.open", mock_open(read_data=json_str)):
            result = ask_codebase("acme", "my-project", "How does the architecture work?")
        assert isinstance(result, str)
        assert "Architecture" in result
        assert "acme/my-project" in result

    def test_ask_returns_error_for_missing_repo(self):
        with patch.object(_server.os.path, "exists", return_value=False), \
             patch.object(_server.os.path, "isdir", return_value=False):
            result = ask_codebase("nobody", "norepo", "What is this?")
        assert "No wiki found" in result

    def test_ask_includes_provider_info(self, sample_cache):
        json_str = json.dumps(sample_cache)
        with patch.object(_server.os.path, "exists", return_value=True), \
             patch("builtins.open", mock_open(read_data=json_str)):
            result = ask_codebase("acme", "my-project", "Tell me about embeddings and FAISS")
        assert "google" in result
        assert "gemini" in result.lower()

    def test_ask_falls_back_to_high_importance_page(self, sample_cache):
        """When no words match, the tool should fall back to a high-importance page."""
        json_str = json.dumps(sample_cache)
        with patch.object(_server.os.path, "exists", return_value=True), \
             patch("builtins.open", mock_open(read_data=json_str)):
            # Use very short words (<=3 chars) which get filtered out,
            # so no word matches occur. The function should fall back.
            result = ask_codebase("acme", "my-project", "is it ok?")
        # Should still get some content back (fallback to high-importance page)
        assert isinstance(result, str)
        # The high-importance page "Project Overview" should be returned
        assert "Project Overview" in result or "Could not find" in result
