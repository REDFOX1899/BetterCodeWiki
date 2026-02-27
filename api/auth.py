"""
Clerk JWT verification for FastAPI.

Provides FastAPI dependencies for authenticating requests via Clerk-issued JWTs.
Uses PyJWT with RS256 verification against Clerk's JWKS endpoint.

Environment Variables:
    CLERK_PUBLISHABLE_KEY: Clerk publishable key (pk_test_... or pk_live_...)
        Used to derive the JWKS endpoint URL.
    CLERK_SECRET_KEY: Clerk secret key (optional, reserved for future server-side API calls).
    ADMIN_USER_IDS: Comma-separated list of Clerk user IDs that have admin access.

When CLERK_PUBLISHABLE_KEY is not set, auth dependencies degrade gracefully:
    - require_auth raises 503 Service Unavailable
    - optional_auth returns None
    - require_admin raises 503 Service Unavailable
"""

import os
import time
import base64
import logging
from typing import Optional, Dict, Any

import httpx
import jwt
from jwt import PyJWKClient, PyJWKClientError
from fastapi import Request, HTTPException, Depends

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CLERK_PUBLISHABLE_KEY = os.environ.get("CLERK_PUBLISHABLE_KEY", "")
CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY", "")
ADMIN_USER_IDS: set[str] = set(
    uid.strip()
    for uid in os.environ.get("ADMIN_USER_IDS", "").split(",")
    if uid.strip()
)

# ---------------------------------------------------------------------------
# Derive the JWKS URL from the publishable key
# ---------------------------------------------------------------------------

_jwks_url: Optional[str] = None
_clerk_issuer: Optional[str] = None


def _derive_clerk_frontend_api(publishable_key: str) -> Optional[str]:
    """
    Extract the Clerk frontend-API domain from a publishable key.

    Clerk publishable keys are formatted as:
        pk_test_<base64-encoded-domain>
        pk_live_<base64-encoded-domain>

    The base64 payload decodes to something like:
        eminent-lionfish-21.clerk.accounts.dev$
    (with a trailing '$' that we strip).
    """
    if not publishable_key:
        return None

    parts = publishable_key.split("_")
    if len(parts) < 3:
        logger.warning("CLERK_PUBLISHABLE_KEY has unexpected format")
        return None

    # Everything after "pk_test_" or "pk_live_"
    encoded = "_".join(parts[2:])
    try:
        # Add padding if needed
        padding = 4 - len(encoded) % 4
        if padding != 4:
            encoded += "=" * padding
        decoded = base64.b64decode(encoded).decode("utf-8").rstrip("$")
        return decoded
    except Exception as e:
        logger.warning(f"Failed to decode CLERK_PUBLISHABLE_KEY: {e}")
        return None


_clerk_frontend_api = _derive_clerk_frontend_api(CLERK_PUBLISHABLE_KEY)

if _clerk_frontend_api:
    _jwks_url = f"https://{_clerk_frontend_api}/.well-known/jwks.json"
    _clerk_issuer = f"https://{_clerk_frontend_api}"
    logger.info(f"Clerk auth configured — JWKS URL: {_jwks_url}")
else:
    logger.warning(
        "CLERK_PUBLISHABLE_KEY not set or invalid. "
        "Clerk JWT verification is disabled. "
        "Set CLERK_PUBLISHABLE_KEY to enable authentication."
    )

# ---------------------------------------------------------------------------
# JWKS client (cached, thread-safe via PyJWKClient's built-in caching)
# ---------------------------------------------------------------------------

_jwks_client: Optional[PyJWKClient] = None

if _jwks_url:
    try:
        _jwks_client = PyJWKClient(
            _jwks_url,
            cache_keys=True,
            # PyJWKClient caches keys for 5 minutes by default; Clerk
            # rotates keys very infrequently so this is fine.
            lifespan=600,  # 10 minute cache
        )
    except Exception as e:
        logger.error(f"Failed to initialize JWKS client: {e}")
        _jwks_client = None


def _auth_not_configured() -> bool:
    """Return True when Clerk auth is not configured."""
    return _jwks_client is None


# ---------------------------------------------------------------------------
# Token verification
# ---------------------------------------------------------------------------


async def _verify_token(token: str) -> Dict[str, Any]:
    """
    Verify a Clerk JWT and return the decoded claims.

    Raises:
        HTTPException(401) on any verification failure.
    """
    if _auth_not_configured():
        raise HTTPException(
            status_code=503,
            detail="Authentication service not configured",
        )

    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
    except PyJWKClientError as e:
        logger.warning(f"JWKS key lookup failed: {e}")
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
        )
    except Exception as e:
        logger.error(f"Unexpected error fetching JWKS signing key: {e}")
        raise HTTPException(
            status_code=401,
            detail="Authentication verification failed",
        )

    try:
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=_clerk_issuer,
            options={
                "verify_exp": True,
                "verify_iat": True,
                "verify_iss": True,
                "require": ["sub", "iat", "exp", "iss"],
            },
        )
        return claims
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Authentication token has expired",
        )
    except jwt.InvalidIssuerError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token issuer",
        )
    except jwt.InvalidTokenError as e:
        logger.warning(f"JWT validation failed: {e}")
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token",
        )


def _extract_bearer_token(request: Request) -> Optional[str]:
    """
    Extract a Bearer token from the Authorization header.

    Returns None if no Authorization header is present or it doesn't
    use the Bearer scheme.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header:
        return None

    parts = auth_header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    return parts[1].strip() or None


# ---------------------------------------------------------------------------
# FastAPI Dependencies
# ---------------------------------------------------------------------------


async def require_auth(request: Request) -> Dict[str, Any]:
    """
    FastAPI dependency: require a valid Clerk JWT.

    Returns the decoded JWT claims dict containing at minimum:
        - sub: Clerk user ID (e.g. "user_2abc...")
        - iat: issued-at timestamp
        - exp: expiration timestamp
        - iss: issuer URL

    May also contain (depending on Clerk configuration):
        - email: user's email address
        - azp: authorized party (your application URL)

    Raises:
        HTTPException(401) if no token or token is invalid.
        HTTPException(503) if Clerk auth is not configured.
    """
    token = _extract_bearer_token(request)
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authorization header with Bearer token is required",
        )

    return await _verify_token(token)


async def optional_auth(request: Request) -> Optional[Dict[str, Any]]:
    """
    FastAPI dependency: optionally verify a Clerk JWT.

    Returns the decoded JWT claims if a valid token is present,
    or None if no token is provided or auth is not configured.

    Unlike require_auth, this never raises on missing tokens.
    It will still raise HTTPException(401) if a token IS present
    but is invalid (to prevent confusion about auth state).
    """
    if _auth_not_configured():
        return None

    token = _extract_bearer_token(request)
    if not token:
        return None

    return await _verify_token(token)


async def require_admin(
    claims: Dict[str, Any] = Depends(require_auth),
) -> Dict[str, Any]:
    """
    FastAPI dependency: require the authenticated user to be an admin.

    Admin status is determined by checking the user's Clerk ID (sub claim)
    against the ADMIN_USER_IDS environment variable. A future enhancement
    could check a Supabase `users` table role column instead.

    Returns the decoded JWT claims if the user is an admin.

    Raises:
        HTTPException(403) if the user is authenticated but not an admin.
        HTTPException(401) if the user is not authenticated (via require_auth).
        HTTPException(503) if auth is not configured (via require_auth).
    """
    user_id = claims.get("sub", "")

    if not ADMIN_USER_IDS:
        # No admin users configured — deny all
        logger.warning(
            "require_admin called but ADMIN_USER_IDS is not configured. "
            "Denying access."
        )
        raise HTTPException(
            status_code=403,
            detail="Admin access is not configured",
        )

    if user_id not in ADMIN_USER_IDS:
        logger.info(f"Admin access denied for user {user_id}")
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    return claims
