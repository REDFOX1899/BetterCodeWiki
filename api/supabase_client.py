"""
Supabase database client for GitUnderstand.

Provides typed helper methods for all database operations across the
application's tables.  Uses the **service-role key** so that Row Level
Security (RLS) is bypassed — this module is intended for server-side use
only.

Configuration is read from two environment variables:

- ``SUPABASE_URL``              — e.g. ``https://bsrbibfxtqhphmadcuhk.supabase.co``
- ``SUPABASE_SERVICE_ROLE_KEY`` — the service-role secret

If either variable is missing the module still imports cleanly (for local
dev / tests), but calling any method will raise a clear error.

Usage::

    from api.supabase_client import db

    user = db.get_user_by_clerk_id("clerk_abc123")
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy client initialisation
# ---------------------------------------------------------------------------

_SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
_SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

_client = None  # Will be initialised on first use


def _get_client():
    """Return the singleton Supabase client, creating it on first call."""
    global _client
    if _client is not None:
        return _client

    if not _SUPABASE_URL or not _SUPABASE_KEY:
        raise RuntimeError(
            "Supabase is not configured. Set SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY environment variables."
        )

    try:
        from supabase import create_client, Client
    except ImportError:
        raise RuntimeError(
            "The 'supabase' package is required. "
            "Install it with: pip install supabase"
        )

    _client: Client = create_client(_SUPABASE_URL, _SUPABASE_KEY)
    logger.info(f"Supabase client initialised for {_SUPABASE_URL}")
    return _client


# ---------------------------------------------------------------------------
# Table names (centralised so typos become import errors)
# ---------------------------------------------------------------------------

_T_USERS = "users"
_T_WAITLIST = "waitlist"
_T_WIKI_PROJECTS = "wiki_projects"
_T_PAGE_VIEWS = "page_views"
_T_FEATURE_ACCESS = "feature_access"
_T_USAGE_EVENTS = "usage_events"


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _first_or_none(response) -> Optional[Dict[str, Any]]:
    """Extract the first row from a Supabase response, or ``None``."""
    data = response.data
    if data and len(data) > 0:
        return data[0]
    return None


# ===================================================================
# Public API — organised by table
# ===================================================================


class SupabaseDB:
    """Thin wrapper providing typed helpers for every table."""

    # ---------------------------------------------------------------
    # Users
    # ---------------------------------------------------------------

    def create_user(
        self,
        clerk_id: str,
        email: str,
        name: Optional[str] = None,
        avatar_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Insert a new user row. Returns the created row."""
        client = _get_client()
        payload: Dict[str, Any] = {
            "clerk_id": clerk_id,
            "email": email,
        }
        if name is not None:
            payload["name"] = name
        if avatar_url is not None:
            payload["avatar_url"] = avatar_url

        response = client.table(_T_USERS).insert(payload).execute()
        logger.info(f"Created user: clerk_id={clerk_id}")
        return response.data[0]

    def get_user_by_clerk_id(self, clerk_id: str) -> Optional[Dict[str, Any]]:
        """Lookup a user by their Clerk ID."""
        client = _get_client()
        response = (
            client.table(_T_USERS)
            .select("*")
            .eq("clerk_id", clerk_id)
            .maybe_single()
            .execute()
        )
        return response.data

    def update_user(self, clerk_id: str, **fields) -> Optional[Dict[str, Any]]:
        """Update arbitrary columns for a user identified by *clerk_id*.

        Example::

            db.update_user("clerk_abc", name="New Name", avatar_url="https://...")
        """
        if not fields:
            return None
        client = _get_client()
        fields["updated_at"] = _utcnow_iso()
        response = (
            client.table(_T_USERS)
            .update(fields)
            .eq("clerk_id", clerk_id)
            .execute()
        )
        return _first_or_none(response)

    def delete_user(self, clerk_id: str) -> bool:
        """Delete a user by Clerk ID. Returns ``True`` if a row was deleted."""
        client = _get_client()
        response = (
            client.table(_T_USERS)
            .delete()
            .eq("clerk_id", clerk_id)
            .execute()
        )
        deleted = bool(response.data and len(response.data) > 0)
        if deleted:
            logger.info(f"Deleted user: clerk_id={clerk_id}")
        return deleted

    # ---------------------------------------------------------------
    # Waitlist
    # ---------------------------------------------------------------

    def create_waitlist_entry(
        self,
        email: str,
        name: Optional[str] = None,
        clerk_id: Optional[str] = None,
        use_case: Optional[str] = None,
        willing_to_pay: Optional[bool] = None,
        **extra,
    ) -> Dict[str, Any]:
        """Add a new waitlist entry."""
        client = _get_client()
        payload: Dict[str, Any] = {"email": email}
        if name is not None:
            payload["name"] = name
        if clerk_id is not None:
            payload["clerk_id"] = clerk_id
        if use_case is not None:
            payload["use_case"] = use_case
        if willing_to_pay is not None:
            payload["willing_to_pay"] = willing_to_pay
        payload.update(extra)

        response = client.table(_T_WAITLIST).insert(payload).execute()
        logger.info(f"Created waitlist entry: email={email}")
        return response.data[0]

    def get_waitlist_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Find a waitlist entry by email."""
        client = _get_client()
        response = (
            client.table(_T_WAITLIST)
            .select("*")
            .eq("email", email)
            .maybe_single()
            .execute()
        )
        return response.data

    def get_waitlist_by_clerk_id(self, clerk_id: str) -> Optional[Dict[str, Any]]:
        """Find a waitlist entry by Clerk ID."""
        client = _get_client()
        response = (
            client.table(_T_WAITLIST)
            .select("*")
            .eq("clerk_id", clerk_id)
            .maybe_single()
            .execute()
        )
        return response.data

    # ---------------------------------------------------------------
    # Wiki Projects
    # ---------------------------------------------------------------

    def upsert_wiki_project(
        self,
        owner: str,
        repo: str,
        repo_type: str,
        language: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        **extra,
    ) -> Dict[str, Any]:
        """Create or update a wiki project entry.

        The unique key is ``(owner, repo, repo_type, language)``.
        """
        client = _get_client()
        payload: Dict[str, Any] = {
            "owner": owner,
            "repo": repo,
            "repo_type": repo_type,
            "language": language,
        }
        if title is not None:
            payload["title"] = title
        if description is not None:
            payload["description"] = description
        if tags is not None:
            payload["tags"] = tags
        payload.update(extra)

        response = (
            client.table(_T_WIKI_PROJECTS)
            .upsert(payload, on_conflict="owner,repo,repo_type,language")
            .execute()
        )
        logger.info(f"Upserted wiki project: {owner}/{repo} ({repo_type}, {language})")
        return response.data[0]

    def get_wiki_project(
        self,
        owner: str,
        repo: str,
        repo_type: str,
        language: str,
    ) -> Optional[Dict[str, Any]]:
        """Fetch a single wiki project by its natural key."""
        client = _get_client()
        response = (
            client.table(_T_WIKI_PROJECTS)
            .select("*")
            .eq("owner", owner)
            .eq("repo", repo)
            .eq("repo_type", repo_type)
            .eq("language", language)
            .maybe_single()
            .execute()
        )
        return response.data

    def list_published_projects(
        self,
        featured_only: bool = False,
    ) -> List[Dict[str, Any]]:
        """Return published wiki projects, optionally filtered to featured ones."""
        client = _get_client()
        query = (
            client.table(_T_WIKI_PROJECTS)
            .select("*")
            .eq("is_published", True)
        )
        if featured_only:
            query = query.eq("is_featured", True)
        response = query.order("view_count", desc=True).execute()
        return response.data or []

    def increment_view_count(self, project_id: str) -> None:
        """Increment the view counter for a project via RPC.

        Falls back to a read-modify-write if the RPC does not exist.
        """
        client = _get_client()
        try:
            client.rpc(
                "increment_view_count",
                {"p_project_id": project_id},
            ).execute()
        except Exception:
            # Fallback: manual increment
            try:
                row = (
                    client.table(_T_WIKI_PROJECTS)
                    .select("view_count")
                    .eq("id", project_id)
                    .maybe_single()
                    .execute()
                )
                current = (row.data or {}).get("view_count", 0) or 0
                (
                    client.table(_T_WIKI_PROJECTS)
                    .update({"view_count": current + 1})
                    .eq("id", project_id)
                    .execute()
                )
            except Exception as exc:
                logger.warning(f"Failed to increment view count for {project_id}: {exc}")

    # ---------------------------------------------------------------
    # Page Views
    # ---------------------------------------------------------------

    def log_page_view(
        self,
        project_id: str,
        page_title: str,
        clerk_id: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> None:
        """Record a page view event."""
        client = _get_client()
        payload: Dict[str, Any] = {
            "project_id": project_id,
            "page_title": page_title,
        }
        if clerk_id is not None:
            payload["clerk_id"] = clerk_id
        if session_id is not None:
            payload["session_id"] = session_id

        try:
            client.table(_T_PAGE_VIEWS).insert(payload).execute()
        except Exception as exc:
            logger.warning(f"Failed to log page view: {exc}")

    # ---------------------------------------------------------------
    # Feature Access
    # ---------------------------------------------------------------

    def get_user_features(self, user_id: str) -> List[str]:
        """Return a list of feature slugs granted to *user_id*."""
        client = _get_client()
        response = (
            client.table(_T_FEATURE_ACCESS)
            .select("feature")
            .eq("user_id", user_id)
            .execute()
        )
        return [row["feature"] for row in (response.data or [])]

    def grant_feature(
        self,
        user_id: str,
        feature: str,
        granted_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Grant a feature to a user. Returns the created row."""
        client = _get_client()
        payload: Dict[str, Any] = {
            "user_id": user_id,
            "feature": feature,
        }
        if granted_by is not None:
            payload["granted_by"] = granted_by

        response = client.table(_T_FEATURE_ACCESS).insert(payload).execute()
        logger.info(f"Granted feature '{feature}' to user {user_id}")
        return response.data[0]

    # ---------------------------------------------------------------
    # Usage Events
    # ---------------------------------------------------------------

    def log_usage(
        self,
        user_id: str,
        feature: str,
        project_id: Optional[str] = None,
        tokens_used: Optional[int] = None,
        **extra,
    ) -> None:
        """Record a usage event (e.g. wiki generation, chat query)."""
        client = _get_client()
        payload: Dict[str, Any] = {
            "user_id": user_id,
            "feature": feature,
        }
        if project_id is not None:
            payload["project_id"] = project_id
        if tokens_used is not None:
            payload["tokens_used"] = tokens_used
        payload.update(extra)

        try:
            client.table(_T_USAGE_EVENTS).insert(payload).execute()
        except Exception as exc:
            logger.warning(f"Failed to log usage event: {exc}")

    def get_monthly_usage(self, user_id: str) -> Dict[str, Any]:
        """Return aggregated usage for the current calendar month.

        Attempts to call a Supabase RPC ``get_monthly_usage`` first.
        Falls back to a client-side query + aggregation if the RPC is
        not deployed.

        Returns a dict with at least:
        ``total_events``, ``total_tokens``, ``by_feature``.
        """
        client = _get_client()

        # Try RPC first
        try:
            response = client.rpc(
                "get_monthly_usage",
                {"p_user_id": user_id},
            ).execute()
            if response.data:
                return response.data if isinstance(response.data, dict) else response.data[0]
        except Exception:
            pass

        # Fallback: manual aggregation for the current month
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        try:
            response = (
                client.table(_T_USAGE_EVENTS)
                .select("feature, tokens_used")
                .eq("user_id", user_id)
                .gte("created_at", month_start.isoformat())
                .execute()
            )
            rows = response.data or []
        except Exception as exc:
            logger.warning(f"Failed to fetch monthly usage for {user_id}: {exc}")
            rows = []

        total_tokens = 0
        by_feature: Dict[str, int] = {}
        for row in rows:
            tokens = row.get("tokens_used") or 0
            total_tokens += tokens
            feat = row.get("feature", "unknown")
            by_feature[feat] = by_feature.get(feat, 0) + 1

        return {
            "total_events": len(rows),
            "total_tokens": total_tokens,
            "by_feature": by_feature,
            "period_start": month_start.isoformat(),
            "period_end": now.isoformat(),
        }


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

db = SupabaseDB()

# ---------------------------------------------------------------------------
# Module-level convenience aliases (used by api.routes.*)
# ---------------------------------------------------------------------------

create_user = db.create_user
get_user_by_clerk_id = db.get_user_by_clerk_id
update_user = db.update_user
delete_user = db.delete_user
create_waitlist_entry = db.create_waitlist_entry
get_waitlist_by_email = db.get_waitlist_by_email
get_waitlist_by_clerk_id = db.get_waitlist_by_clerk_id
upsert_wiki_project = db.upsert_wiki_project
get_wiki_project = db.get_wiki_project
list_published_projects = db.list_published_projects
increment_view_count = db.increment_view_count
log_page_view = db.log_page_view
get_user_features = db.get_user_features
grant_feature = db.grant_feature
log_usage = db.log_usage
get_monthly_usage = db.get_monthly_usage
