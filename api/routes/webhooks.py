"""
Clerk webhook router.

Handles Clerk webhook events for user lifecycle management.
Clerk uses Svix for webhook delivery and signature verification.

Environment Variables:
    CLERK_WEBHOOK_SECRET: Svix signing secret from the Clerk dashboard.
        When not set, signature verification is skipped (local dev only).

Supported Events:
    - user.created  -> inserts a new user record into Supabase
    - user.updated  -> updates the existing user record in Supabase
    - user.deleted  -> deletes the user record from Supabase
"""

import os
import json
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from api.supabase_client import create_user, update_user, delete_user

logger = logging.getLogger(__name__)

router = APIRouter()

CLERK_WEBHOOK_SECRET = os.environ.get("CLERK_WEBHOOK_SECRET", "")

# Try to import svix for webhook verification; allow graceful degradation
_svix_available = False
try:
    from svix.webhooks import Webhook, WebhookVerificationError

    _svix_available = True
except ImportError:
    logger.warning(
        "svix package not installed. Clerk webhook signature verification "
        "will be skipped. Install svix to enable verification: pip install svix"
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _verify_webhook(headers: Dict[str, str], body: bytes) -> Optional[Dict[str, Any]]:
    """
    Verify the Clerk webhook signature using Svix.

    Returns the parsed payload dict on success, or None if verification
    is skipped (no secret configured or svix not available).

    Raises:
        HTTPException(400) if the signature is invalid.
    """
    if not CLERK_WEBHOOK_SECRET:
        logger.warning(
            "CLERK_WEBHOOK_SECRET not set — skipping webhook signature verification. "
            "This is acceptable for local development only."
        )
        return None

    if not _svix_available:
        logger.warning(
            "svix not available — skipping webhook signature verification."
        )
        return None

    # Svix expects these specific headers
    svix_id = headers.get("svix-id", "")
    svix_timestamp = headers.get("svix-timestamp", "")
    svix_signature = headers.get("svix-signature", "")

    if not svix_id or not svix_timestamp or not svix_signature:
        raise HTTPException(
            status_code=400,
            detail="Missing Svix webhook verification headers",
        )

    try:
        wh = Webhook(CLERK_WEBHOOK_SECRET)
        payload = wh.verify(body, {
            "svix-id": svix_id,
            "svix-timestamp": svix_timestamp,
            "svix-signature": svix_signature,
        })
        return payload
    except WebhookVerificationError as e:
        logger.warning(f"Webhook signature verification failed: {e}")
        raise HTTPException(
            status_code=400,
            detail="Invalid webhook signature",
        )


def _extract_user_data(event_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract a normalized user record from Clerk's webhook event data.

    Clerk sends rich user objects; we extract only what we need for our
    Supabase users table.
    """
    # Clerk sends email addresses as a list of objects
    email_addresses = event_data.get("email_addresses", [])
    primary_email_id = event_data.get("primary_email_address_id", "")

    # Find the primary email
    email = ""
    for addr in email_addresses:
        if addr.get("id") == primary_email_id:
            email = addr.get("email_address", "")
            break
    # Fallback: use the first email if primary not found
    if not email and email_addresses:
        email = email_addresses[0].get("email_address", "")

    return {
        "clerk_id": event_data.get("id", ""),
        "email": email,
        "first_name": event_data.get("first_name", ""),
        "last_name": event_data.get("last_name", ""),
        "username": event_data.get("username", ""),
        "image_url": event_data.get("image_url", ""),
        "created_at_clerk": event_data.get("created_at"),
        "updated_at_clerk": event_data.get("updated_at"),
    }


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/webhooks/clerk",
    summary="Clerk webhook receiver",
    responses={
        200: {"description": "Webhook processed successfully"},
        400: {"description": "Invalid signature or malformed payload"},
        500: {"description": "Internal server error"},
    },
)
async def clerk_webhook(request: Request) -> JSONResponse:
    """
    Receive and process Clerk webhook events.

    Verifies the Svix signature (when configured), then dispatches
    to the appropriate handler based on the event type.
    """
    body = await request.body()
    headers = dict(request.headers)

    # Verify signature (returns parsed payload or None if skipped)
    verified_payload = _verify_webhook(headers, body)

    # Parse the body — use verified payload if available, otherwise parse raw
    if verified_payload is not None:
        payload = verified_payload
    else:
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = payload.get("type", "")
    event_data = payload.get("data", {})

    if not event_type:
        raise HTTPException(status_code=400, detail="Missing event type in payload")

    logger.info(f"Clerk webhook received: {event_type}")

    try:
        if event_type == "user.created":
            user_data = _extract_user_data(event_data)
            await create_user(user_data)
            logger.info(f"User created via webhook: {user_data.get('clerk_id')}")

        elif event_type == "user.updated":
            user_data = _extract_user_data(event_data)
            await update_user(user_data["clerk_id"], user_data)
            logger.info(f"User updated via webhook: {user_data.get('clerk_id')}")

        elif event_type == "user.deleted":
            clerk_id = event_data.get("id", "")
            if clerk_id:
                await delete_user(clerk_id)
                logger.info(f"User deleted via webhook: {clerk_id}")
            else:
                logger.warning("user.deleted event missing user ID")

        else:
            # Unhandled event type — log and acknowledge
            logger.debug(f"Ignoring unhandled Clerk webhook event: {event_type}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error processing Clerk webhook event '{event_type}': {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail="Internal error processing webhook event",
        )

    return JSONResponse(
        status_code=200,
        content={"success": True, "event": event_type},
    )
