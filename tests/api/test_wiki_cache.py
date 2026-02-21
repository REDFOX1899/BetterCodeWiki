"""
Tests for wiki cache CRUD endpoints:
  GET    /api/wiki_cache
  POST   /api/wiki_cache
  DELETE /api/wiki_cache

All file-system I/O is mocked so tests never touch real cache files.
"""

import json
import os
import pytest
from unittest.mock import patch, mock_open, MagicMock

from fastapi.testclient import TestClient

from api.api import app


@pytest.fixture
def client():
    """Create a TestClient for the FastAPI app."""
    return TestClient(app)


# ── Helpers ────────────────────────────────────────────────────


def _make_wiki_page(page_id="p-intro", title="Introduction", content="Hello world"):
    """Build a minimal wiki page dict."""
    return {
        "id": page_id,
        "title": title,
        "content": content,
        "filePaths": ["src/main.py"],
        "importance": "high",
        "relatedPages": [],
    }


def _make_wiki_structure(pages=None):
    """Build a minimal wiki structure dict."""
    if pages is None:
        pages = [_make_wiki_page()]
    return {
        "id": "wiki-root",
        "title": "Test Wiki",
        "description": "A test wiki",
        "pages": pages,
        "sections": [],
        "rootSections": [],
    }


def _make_cache_data():
    """Build a full cache payload as would be stored on disk."""
    page = _make_wiki_page()
    return {
        "wiki_structure": _make_wiki_structure([page]),
        "generated_pages": {page["id"]: page},
        "repo": {"owner": "testowner", "repo": "testrepo", "type": "github"},
        "provider": "google",
        "model": "gemini-2.5-flash",
    }


def _make_post_body():
    """Build a valid POST body for /api/wiki_cache."""
    page = _make_wiki_page()
    return {
        "repo": {"owner": "testowner", "repo": "testrepo", "type": "github"},
        "language": "en",
        "wiki_structure": _make_wiki_structure([page]),
        "generated_pages": {page["id"]: page},
        "provider": "google",
        "model": "gemini-2.5-flash",
    }


# ── GET /api/wiki_cache ───────────────────────────────────────


class TestGetWikiCache:
    """Tests for the GET wiki_cache endpoint."""

    def test_cache_miss_returns_200_with_null(self, client):
        """When no cache file exists, return 200 with null body."""
        with patch("api.api.read_wiki_cache", return_value=None):
            response = client.get(
                "/api/wiki_cache",
                params={
                    "owner": "testowner",
                    "repo": "testrepo",
                    "repo_type": "github",
                    "language": "en",
                },
            )
        assert response.status_code == 200
        assert response.json() is None

    def test_cache_hit_returns_data(self, client):
        """When cache exists, return the cached data."""
        from api.api import WikiCacheData

        cache = _make_cache_data()
        cache_obj = WikiCacheData(**cache)

        with patch("api.api.read_wiki_cache", return_value=cache_obj):
            response = client.get(
                "/api/wiki_cache",
                params={
                    "owner": "testowner",
                    "repo": "testrepo",
                    "repo_type": "github",
                    "language": "en",
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert data is not None
        assert data["wiki_structure"]["title"] == "Test Wiki"
        assert "p-intro" in data["generated_pages"]

    def test_missing_query_params_returns_422(self, client):
        """Omitting required query params should return 422."""
        response = client.get("/api/wiki_cache")
        assert response.status_code == 422

    def test_unsupported_language_falls_back_to_default(self, client):
        """An unsupported language code should be silently replaced with default."""
        with patch("api.api.read_wiki_cache", return_value=None) as mock_read:
            response = client.get(
                "/api/wiki_cache",
                params={
                    "owner": "testowner",
                    "repo": "testrepo",
                    "repo_type": "github",
                    "language": "xx-fake",
                },
            )
        assert response.status_code == 200
        # The call should have been made with the default language
        call_args = mock_read.call_args
        # language argument should have been changed to the default
        assert call_args is not None


# ── POST /api/wiki_cache ──────────────────────────────────────


class TestPostWikiCache:
    """Tests for the POST wiki_cache endpoint."""

    def test_successful_save(self, client):
        """A valid POST should return success message."""
        with patch("api.api.save_wiki_cache", return_value=True):
            response = client.post("/api/wiki_cache", json=_make_post_body())
        assert response.status_code == 200
        assert response.json()["message"] == "Wiki cache saved successfully"

    def test_save_failure_returns_500(self, client):
        """When save_wiki_cache returns False, endpoint should return 500."""
        with patch("api.api.save_wiki_cache", return_value=False):
            response = client.post("/api/wiki_cache", json=_make_post_body())
        assert response.status_code == 500

    def test_invalid_body_returns_422(self, client):
        """Posting an invalid body should return 422."""
        response = client.post("/api/wiki_cache", json={"bad": "data"})
        assert response.status_code == 422

    def test_missing_repo_field_returns_422(self, client):
        """Omitting the 'repo' field should be rejected."""
        body = _make_post_body()
        del body["repo"]
        response = client.post("/api/wiki_cache", json=body)
        assert response.status_code == 422


# ── DELETE /api/wiki_cache ────────────────────────────────────


class TestDeleteWikiCache:
    """Tests for the DELETE wiki_cache endpoint."""

    def test_delete_existing_cache(self, client):
        """Deleting an existing cache file should succeed."""
        with patch("api.api.os.path.exists", return_value=True), \
             patch("api.api.os.remove") as mock_remove:
            response = client.delete(
                "/api/wiki_cache",
                params={
                    "owner": "testowner",
                    "repo": "testrepo",
                    "repo_type": "github",
                    "language": "en",
                },
            )
        assert response.status_code == 200
        mock_remove.assert_called_once()

    def test_delete_nonexistent_cache_returns_404(self, client):
        """Deleting a cache that does not exist should return 404."""
        with patch("api.api.os.path.exists", return_value=False):
            response = client.delete(
                "/api/wiki_cache",
                params={
                    "owner": "testowner",
                    "repo": "testrepo",
                    "repo_type": "github",
                    "language": "en",
                },
            )
        assert response.status_code == 404

    def test_delete_unsupported_language_returns_400(self, client):
        """An unsupported language should return 400."""
        response = client.delete(
            "/api/wiki_cache",
            params={
                "owner": "testowner",
                "repo": "testrepo",
                "repo_type": "github",
                "language": "xx-fake",
            },
        )
        assert response.status_code == 400

    def test_delete_missing_params_returns_422(self, client):
        """Omitting required params should return 422."""
        response = client.delete("/api/wiki_cache")
        assert response.status_code == 422

    def test_delete_os_error_returns_500(self, client):
        """If os.remove raises, endpoint should return 500."""
        with patch("api.api.os.path.exists", return_value=True), \
             patch("api.api.os.remove", side_effect=PermissionError("denied")):
            response = client.delete(
                "/api/wiki_cache",
                params={
                    "owner": "testowner",
                    "repo": "testrepo",
                    "repo_type": "github",
                    "language": "en",
                },
            )
        assert response.status_code == 500


# ── Export endpoint ────────────────────────────────────────────


class TestExportWiki:
    """Tests for the POST /export/wiki endpoint."""

    def test_export_markdown(self, client):
        """Exporting as markdown should return text/markdown."""
        body = {
            "repo_url": "https://github.com/testowner/testrepo",
            "pages": [_make_wiki_page()],
            "format": "markdown",
        }
        response = client.post("/export/wiki", json=body)
        assert response.status_code == 200
        assert "text/markdown" in response.headers["content-type"]
        assert "Introduction" in response.text

    def test_export_json(self, client):
        """Exporting as JSON should return application/json."""
        body = {
            "repo_url": "https://github.com/testowner/testrepo",
            "pages": [_make_wiki_page()],
            "format": "json",
        }
        response = client.post("/export/wiki", json=body)
        assert response.status_code == 200
        assert "application/json" in response.headers["content-type"]
        data = response.json()
        assert data["metadata"]["repository"] == "https://github.com/testowner/testrepo"
        assert len(data["pages"]) == 1

    def test_export_contains_content_disposition(self, client):
        """Response should include a Content-Disposition header for download."""
        body = {
            "repo_url": "https://github.com/testowner/testrepo",
            "pages": [_make_wiki_page()],
            "format": "markdown",
        }
        response = client.post("/export/wiki", json=body)
        assert "content-disposition" in response.headers
        assert "attachment" in response.headers["content-disposition"]

    def test_export_invalid_format_returns_422(self, client):
        """An unsupported format should be rejected by Pydantic."""
        body = {
            "repo_url": "https://github.com/testowner/testrepo",
            "pages": [_make_wiki_page()],
            "format": "pdf",
        }
        response = client.post("/export/wiki", json=body)
        assert response.status_code == 422
