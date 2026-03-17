"""
Authentication stubs (Clerk removed).

All auth dependencies now pass through without verification.
"""

import logging
from typing import Optional, Dict, Any

from fastapi import Request, HTTPException, Depends

logger = logging.getLogger(__name__)


def _auth_not_configured() -> bool:
    """Auth is always 'not configured' since Clerk has been removed."""
    return True


async def _verify_token(token: str) -> Dict[str, Any]:
    """No-op token verification. Returns a dummy claims dict."""
    return {"sub": "anonymous", "iat": 0, "exp": 0, "iss": "none"}


async def require_auth(request: Request) -> Dict[str, Any]:
    """
    FastAPI dependency: previously required a valid Clerk JWT.
    Now always returns a dummy claims dict (auth disabled).
    """
    return {"sub": "anonymous", "iat": 0, "exp": 0, "iss": "none"}


async def optional_auth(request: Request) -> Optional[Dict[str, Any]]:
    """
    FastAPI dependency: previously optionally verified a Clerk JWT.
    Now always returns None (auth disabled).
    """
    return None


async def require_admin(
    claims: Dict[str, Any] = Depends(require_auth),
) -> Dict[str, Any]:
    """
    FastAPI dependency: previously required admin Clerk user.
    Now always passes through (auth disabled).
    """
    return claims
