"""
Tests for the /health endpoint and other basic read-only API routes.

Uses FastAPI's TestClient so no running server is required.
"""

import pytest
from fastapi.testclient import TestClient

from api.api import app


@pytest.fixture
def client():
    """Create a TestClient for the FastAPI app."""
    return TestClient(app)


# ── Health endpoint ────────────────────────────────────────────


class TestHealthEndpoint:
    """Tests for GET /health."""

    def test_health_returns_200(self, client):
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_has_required_fields(self, client):
        data = client.get("/health").json()
        assert "status" in data
        assert "timestamp" in data
        assert "service" in data

    def test_health_status_is_healthy(self, client):
        data = client.get("/health").json()
        assert data["status"] == "healthy"

    def test_health_service_name(self, client):
        data = client.get("/health").json()
        assert data["service"] == "bettercodewiki-api"

    def test_health_timestamp_is_iso_format(self, client):
        """Timestamp should be a valid ISO-8601 string."""
        from datetime import datetime

        data = client.get("/health").json()
        # Should not raise
        datetime.fromisoformat(data["timestamp"])


# ── Root endpoint ──────────────────────────────────────────────


class TestRootEndpoint:
    """Tests for GET /."""

    def test_root_returns_200(self, client):
        response = client.get("/")
        assert response.status_code == 200

    def test_root_contains_message(self, client):
        data = client.get("/").json()
        assert "message" in data

    def test_root_contains_version(self, client):
        data = client.get("/").json()
        assert "version" in data

    def test_root_contains_endpoints(self, client):
        data = client.get("/").json()
        assert "endpoints" in data
        assert isinstance(data["endpoints"], dict)


# ── Auth status endpoint ───────────────────────────────────────


class TestAuthStatusEndpoint:
    """Tests for GET /auth/status."""

    def test_auth_status_returns_200(self, client):
        response = client.get("/auth/status")
        assert response.status_code == 200

    def test_auth_status_has_auth_required_field(self, client):
        data = client.get("/auth/status").json()
        assert "auth_required" in data
        assert isinstance(data["auth_required"], bool)


# ── Models config endpoint ─────────────────────────────────────


class TestModelsConfigEndpoint:
    """Tests for GET /models/config."""

    def test_models_config_returns_200(self, client):
        response = client.get("/models/config")
        assert response.status_code == 200

    def test_models_config_has_providers(self, client):
        data = client.get("/models/config").json()
        assert "providers" in data
        assert isinstance(data["providers"], list)

    def test_models_config_has_default_provider(self, client):
        data = client.get("/models/config").json()
        assert "defaultProvider" in data
        assert isinstance(data["defaultProvider"], str)
