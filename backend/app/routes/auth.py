"""SoundCloud OAuth authentication routes."""

from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings

router = APIRouter()
settings = get_settings()
limiter = Limiter(key_func=get_remote_address)

# SoundCloud API endpoints
SOUNDCLOUD_AUTH_URL = "https://api.soundcloud.com/connect"
SOUNDCLOUD_TOKEN_URL = "https://api.soundcloud.com/oauth2/token"
SOUNDCLOUD_API_URL = "https://api.soundcloud.com"


class OAuthCallback(BaseModel):
    """OAuth callback request body."""

    code: str


class TokenResponse(BaseModel):
    """Token response from SoundCloud."""

    access_token: str
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None
    scope: Optional[str] = None


class UserResponse(BaseModel):
    """User info response."""

    id: int
    username: str
    avatar_url: Optional[str] = None
    permalink_url: str


@router.get("/soundcloud/url")
async def get_auth_url():
    """
    Get the SoundCloud OAuth authorization URL.

    Returns the URL that the frontend should redirect to for user authentication.
    """
    if not settings.soundcloud_client_id:
        raise HTTPException(
            status_code=500,
            detail="SoundCloud client ID not configured. Please set SOUNDCLOUD_CLIENT_ID.",
        )

    params = {
        "client_id": settings.soundcloud_client_id,
        "redirect_uri": settings.soundcloud_redirect_uri,
        "response_type": "code",
        "scope": "non-expiring",  # Request long-lived token
    }

    url = f"{SOUNDCLOUD_AUTH_URL}?{urlencode(params)}"
    return {"url": url}


@router.post("/soundcloud/callback")
@limiter.limit("10/minute")
async def oauth_callback(request: Request, body: OAuthCallback):
    """
    Exchange OAuth code for access token.

    Called by the frontend after user authorizes the app on SoundCloud.
    """
    if not settings.soundcloud_client_id or not settings.soundcloud_client_secret:
        raise HTTPException(
            status_code=500,
            detail="SoundCloud credentials not configured",
        )

    # Exchange code for token
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                SOUNDCLOUD_TOKEN_URL,
                data={
                    "client_id": settings.soundcloud_client_id,
                    "client_secret": settings.soundcloud_client_secret,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.soundcloud_redirect_uri,
                    "code": body.code,
                },
            )

            if response.status_code != 200:
                error_detail = response.json() if response.text else "Unknown error"
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"SoundCloud OAuth failed: {error_detail}",
                )

            token_data = response.json()

            # Get user info
            user_response = await client.get(
                f"{SOUNDCLOUD_API_URL}/me",
                headers={"Authorization": f"OAuth {token_data['access_token']}"},
            )

            if user_response.status_code != 200:
                raise HTTPException(
                    status_code=user_response.status_code,
                    detail="Failed to get user info",
                )

            user_data = user_response.json()

            return {
                "access_token": token_data["access_token"],
                "refresh_token": token_data.get("refresh_token"),
                "user": {
                    "id": user_data["id"],
                    "username": user_data["username"],
                    "avatar_url": user_data.get("avatar_url"),
                    "permalink_url": user_data.get("permalink_url", ""),
                },
            }

        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to connect to SoundCloud: {str(e)}",
            )


@router.post("/soundcloud/refresh")
@limiter.limit("5/minute")
async def refresh_token(request: Request):
    """
    Refresh the access token using the refresh token.
    """
    # Get refresh token from request
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    refresh_token = request.headers.get("X-Refresh-Token")
    if not refresh_token:
        raise HTTPException(status_code=400, detail="Missing refresh token")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                SOUNDCLOUD_TOKEN_URL,
                data={
                    "client_id": settings.soundcloud_client_id,
                    "client_secret": settings.soundcloud_client_secret,
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                },
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to refresh token",
                )

            token_data = response.json()
            return {"access_token": token_data["access_token"]}

        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to connect to SoundCloud: {str(e)}",
            )


@router.get("/soundcloud/me")
@limiter.limit("30/minute")
async def get_current_user(request: Request):
    """
    Get current authenticated user info.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = auth_header.replace("Bearer ", "")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{SOUNDCLOUD_API_URL}/me",
                headers={"Authorization": f"OAuth {token}"},
            )

            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid or expired token")

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to get user info",
                )

            user_data = response.json()
            return {
                "id": user_data["id"],
                "username": user_data["username"],
                "avatar_url": user_data.get("avatar_url"),
                "permalink_url": user_data.get("permalink_url", ""),
            }

        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to connect to SoundCloud: {str(e)}",
            )
