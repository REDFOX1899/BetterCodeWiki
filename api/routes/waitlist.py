"""
Waitlist API router.

Provides a single endpoint for users to join the GitUnderstand waitlist.
Data is persisted to Supabase via the supabase_client module.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, EmailStr

from api.supabase_client import create_waitlist_entry, get_waitlist_by_email

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class WaitlistRequest(BaseModel):
    """Request body for the waitlist signup endpoint."""

    email: EmailStr = Field(..., description="User's email address")
    name: Optional[str] = Field(None, description="User's full name")
    clerk_id: Optional[str] = Field(None, description="Clerk user ID if authenticated")
    use_case: Optional[str] = Field(None, description="How the user plans to use GitUnderstand")
    willing_to_pay: Optional[str] = Field(
        None,
        description="Pricing preference: 'free', '$5/mo', '$10/mo', '$20/mo', 'other'",
    )
    price_other: Optional[str] = Field(
        None,
        description="Custom pricing preference when willing_to_pay is 'other'",
    )
    features_interested: Optional[List[str]] = Field(
        None,
        description="List of feature IDs the user is interested in",
    )
    company: Optional[str] = Field(None, description="User's company or organization")
    role: Optional[str] = Field(None, description="User's role or job title")


class WaitlistResponse(BaseModel):
    """Response body for a successful waitlist signup."""

    success: bool
    message: str
    already_registered: bool = False


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/api/waitlist",
    response_model=WaitlistResponse,
    summary="Join the waitlist",
    responses={
        200: {"description": "Successfully joined or already registered"},
        422: {"description": "Validation error (e.g. invalid email)"},
        500: {"description": "Internal server error"},
    },
)
async def join_waitlist(body: WaitlistRequest) -> JSONResponse:
    """
    Add a user to the GitUnderstand waitlist.

    Handles duplicate emails gracefully by returning a success response
    with `already_registered: true` rather than an error.
    """
    try:
        # Check if this email is already on the waitlist
        existing = await get_waitlist_by_email(body.email)
        if existing:
            logger.info(f"Waitlist duplicate: {body.email}")
            return JSONResponse(
                status_code=200,
                content=WaitlistResponse(
                    success=True,
                    message="You're already on the waitlist! We'll be in touch.",
                    already_registered=True,
                ).model_dump(),
            )

        # Build the entry data dict, omitting None values
        entry_data = body.model_dump(exclude_none=True)

        await create_waitlist_entry(entry_data)

        logger.info(f"Waitlist signup: {body.email}")
        return JSONResponse(
            status_code=200,
            content=WaitlistResponse(
                success=True,
                message="You've been added to the waitlist! We'll be in touch soon.",
                already_registered=False,
            ).model_dump(),
        )

    except HTTPException:
        # Re-raise FastAPI HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Waitlist signup error for {body.email}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An error occurred while processing your waitlist signup. Please try again later.",
        )
