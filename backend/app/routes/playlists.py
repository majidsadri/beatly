"""Playlist routes for fetching user playlists from SoundCloud."""

from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings

router = APIRouter()
settings = get_settings()
limiter = Limiter(key_func=get_remote_address)

SOUNDCLOUD_API_URL = "https://api.soundcloud.com"


class UserInfo(BaseModel):
    """User information subset."""

    id: int
    username: str
    avatar_url: Optional[str] = None
    permalink_url: str = ""


class TrackInfo(BaseModel):
    """Track information from SoundCloud."""

    id: int
    title: str
    user: UserInfo
    artwork_url: Optional[str] = None
    duration: int  # milliseconds
    waveform_url: str = ""
    permalink_url: str = ""


class PlaylistInfo(BaseModel):
    """Playlist information from SoundCloud."""

    id: int
    title: str
    user: UserInfo
    artwork_url: Optional[str] = None
    track_count: int
    tracks: Optional[List[TrackInfo]] = None


def extract_token(request: Request) -> str:
    """Extract OAuth token from request headers."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    return auth_header.replace("Bearer ", "")


@router.get("")
@limiter.limit("30/minute")
async def get_playlists(request: Request) -> List[PlaylistInfo]:
    """
    Get all playlists for the authenticated user.

    Returns a list of playlists with basic info (no tracks included).
    """
    token = extract_token(request)

    async with httpx.AsyncClient() as client:
        try:
            # Get user's playlists
            response = await client.get(
                f"{SOUNDCLOUD_API_URL}/me/playlists",
                headers={"Authorization": f"OAuth {token}"},
                params={"limit": 50},
            )

            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid or expired token")

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to fetch playlists",
                )

            playlists_data = response.json()
            playlists = []

            for playlist in playlists_data:
                playlists.append(
                    PlaylistInfo(
                        id=playlist["id"],
                        title=playlist["title"],
                        user=UserInfo(
                            id=playlist["user"]["id"],
                            username=playlist["user"]["username"],
                            avatar_url=playlist["user"].get("avatar_url"),
                            permalink_url=playlist["user"].get("permalink_url", ""),
                        ),
                        artwork_url=playlist.get("artwork_url"),
                        track_count=playlist.get("track_count", 0),
                    )
                )

            return playlists

        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to connect to SoundCloud: {str(e)}",
            )


@router.get("/{playlist_id}/tracks")
@limiter.limit("30/minute")
async def get_playlist_tracks(request: Request, playlist_id: int) -> List[TrackInfo]:
    """
    Get all tracks in a specific playlist.

    Returns full track information including artwork and duration.
    """
    token = extract_token(request)

    async with httpx.AsyncClient() as client:
        try:
            # Get playlist with tracks
            response = await client.get(
                f"{SOUNDCLOUD_API_URL}/playlists/{playlist_id}",
                headers={"Authorization": f"OAuth {token}"},
            )

            if response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid or expired token")

            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Playlist not found")

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to fetch playlist tracks",
                )

            playlist_data = response.json()
            tracks_data = playlist_data.get("tracks", [])
            tracks = []

            for track in tracks_data:
                # Skip tracks that aren't streamable
                if not track.get("streamable", True):
                    continue

                tracks.append(
                    TrackInfo(
                        id=track["id"],
                        title=track["title"],
                        user=UserInfo(
                            id=track["user"]["id"],
                            username=track["user"]["username"],
                            avatar_url=track["user"].get("avatar_url"),
                            permalink_url=track["user"].get("permalink_url", ""),
                        ),
                        artwork_url=track.get("artwork_url"),
                        duration=track.get("duration", 0),
                        waveform_url=track.get("waveform_url", ""),
                        permalink_url=track.get("permalink_url", ""),
                    )
                )

            return tracks

        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to connect to SoundCloud: {str(e)}",
            )


@router.get("/{playlist_id}/smart-order")
@limiter.limit("10/minute")
async def get_smart_order(request: Request, playlist_id: int):
    """
    Get smart ordering for playlist tracks based on compatibility scoring.

    This endpoint calculates the optimal playback order by analyzing
    BPM, key, and energy compatibility between adjacent tracks.
    """
    from app.services.analysis import calculate_compatibility_score, get_cached_analysis

    token = extract_token(request)

    # First get all tracks
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SOUNDCLOUD_API_URL}/playlists/{playlist_id}",
            headers={"Authorization": f"OAuth {token}"},
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail="Failed to fetch playlist",
            )

        playlist_data = response.json()
        tracks = playlist_data.get("tracks", [])

    # Get analyses for all tracks (if available)
    track_analyses = []
    for track in tracks:
        analysis = get_cached_analysis(track["id"])
        if analysis:
            track_analyses.append({"track_id": track["id"], "analysis": analysis})

    if len(track_analyses) < 2:
        # Not enough analyzed tracks, return original order
        return {
            "order": [t["id"] for t in tracks],
            "scores": {},
            "message": "Not enough tracks analyzed for smart ordering",
        }

    # Greedy algorithm: start with first track, pick best next each time
    order = []
    scores = {}
    remaining = track_analyses.copy()

    # Start with the first analyzed track
    current = remaining.pop(0)
    order.append(current["track_id"])

    while remaining:
        best_score = -1
        best_index = 0

        for i, candidate in enumerate(remaining):
            score = calculate_compatibility_score(
                current["analysis"], candidate["analysis"]
            )
            if score > best_score:
                best_score = score
                best_index = i

        next_track = remaining.pop(best_index)
        scores[f"{current['track_id']}->{next_track['track_id']}"] = best_score
        order.append(next_track["track_id"])
        current = next_track

    return {"order": order, "scores": scores}
