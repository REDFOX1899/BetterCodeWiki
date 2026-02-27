"""
Admin API router.

Provides endpoints for administrative operations such as ingesting
(registering) wiki projects in Supabase and listing all projects.

All endpoints require authentication via Clerk JWT.
"""

import logging
import os
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.auth import require_auth
from api.supabase_client import _get_client

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# GitHub API helper
# ---------------------------------------------------------------------------

GITHUB_API_BASE = "https://api.github.com"


async def _fetch_github_metadata(owner: str, repo: str) -> Dict[str, Any]:
    """Fetch repository metadata from the GitHub API.

    Returns a dict with ``stars``, ``description``, and ``topics``.
    Falls back to empty/zero values if the request fails (e.g. private repo,
    rate-limited, or non-GitHub repo).
    """
    url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}"
    headers: Dict[str, str] = {"Accept": "application/vnd.github.v3+json"}

    # Use a GitHub token if available to avoid rate-limiting
    gh_token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GITHUB_API_KEY")
    if gh_token:
        headers["Authorization"] = f"Bearer {gh_token}"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return {
                "stars": data.get("stargazers_count", 0),
                "description": data.get("description") or "",
                "topics": data.get("topics") or [],
            }
    except httpx.HTTPStatusError as exc:
        logger.warning(
            f"GitHub API returned {exc.response.status_code} for {owner}/{repo}: "
            f"{exc.response.text[:200]}"
        )
        return {"stars": 0, "description": "", "topics": []}
    except Exception as exc:
        logger.warning(f"Failed to fetch GitHub metadata for {owner}/{repo}: {exc}")
        return {"stars": 0, "description": "", "topics": []}


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class IngestRequest(BaseModel):
    """Request body for the admin ingest endpoint."""

    owner: str = Field(..., description="Repository owner (e.g. 'facebook')")
    repo: str = Field(..., description="Repository name (e.g. 'react')")
    repo_type: str = Field(
        "github",
        description="Repository hosting type: github, gitlab, or bitbucket",
    )
    language: str = Field("en", description="Wiki language code")
    tags: Optional[List[str]] = Field(None, description="Categorisation tags")
    is_featured: bool = Field(False, description="Whether to feature this project")
    provider: Optional[str] = Field(
        None, description="AI provider override (e.g. 'google', 'openai')"
    )
    model: Optional[str] = Field(None, description="AI model override")


class IngestResponse(BaseModel):
    """Response body for a successful ingest registration."""

    status: str = "ok"
    project: Dict[str, Any]
    github_metadata: Dict[str, Any]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/api/admin/ingest",
    response_model=IngestResponse,
    summary="Register a wiki project in Supabase",
    responses={
        200: {"description": "Project upserted successfully"},
        401: {"description": "Authentication required"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
async def ingest_project(
    body: IngestRequest,
    claims: dict = Depends(require_auth),
) -> IngestResponse:
    """Register (upsert) a wiki project in Supabase with GitHub metadata.

    This endpoint does NOT generate the wiki itself — that is a long-running
    process handled by the CLI ingest scripts.  It only creates or updates
    the project row in the ``wiki_projects`` table so that it appears in the
    project directory.
    """
    try:
        # 1. Fetch GitHub metadata (best-effort)
        github_metadata = await _fetch_github_metadata(body.owner, body.repo)

        # 2. Build the upsert payload
        extra: Dict[str, Any] = {
            "is_published": True,
            "is_featured": body.is_featured,
            "stars": github_metadata["stars"],
        }
        if body.provider:
            extra["provider"] = body.provider
        if body.model:
            extra["model"] = body.model

        # Merge GitHub topics with user-supplied tags (deduplicated)
        merged_tags: List[str] = list(
            dict.fromkeys((body.tags or []) + github_metadata.get("topics", []))
        )

        client = _get_client()
        payload: Dict[str, Any] = {
            "owner": body.owner,
            "repo": body.repo,
            "repo_type": body.repo_type,
            "language": body.language,
            "title": f"{body.owner}/{body.repo}",
            "description": github_metadata["description"],
            "tags": merged_tags,
            **extra,
        }

        response = (
            client.table("wiki_projects")
            .upsert(payload, on_conflict="owner,repo,repo_type,language")
            .execute()
        )
        project = response.data[0] if response.data else payload

        logger.info(
            f"Admin ingest: upserted {body.owner}/{body.repo} "
            f"(featured={body.is_featured}, tags={merged_tags})"
        )

        return IngestResponse(
            status="ok",
            project=project,
            github_metadata=github_metadata,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            f"Admin ingest error for {body.owner}/{body.repo}: {exc}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to ingest project: {exc}",
        )


@router.get(
    "/api/admin/projects",
    summary="List all wiki projects (admin view)",
    responses={
        200: {"description": "List of all wiki projects"},
        401: {"description": "Authentication required"},
        500: {"description": "Internal server error"},
    },
)
async def list_all_projects(
    claims: dict = Depends(require_auth),
) -> List[Dict[str, Any]]:
    """List all wiki projects including unpublished ones.

    Unlike the public project listing, this returns every row in the
    ``wiki_projects`` table regardless of ``is_published`` status.
    """
    try:
        client = _get_client()
        response = (
            client.table("wiki_projects")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []
    except Exception as exc:
        logger.error(f"Admin list projects error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list projects: {exc}",
        )
