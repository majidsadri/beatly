"""Track routes for streaming, analysis, and stem separation."""

import hashlib
import json
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings
from app.services import analysis as analysis_service

router = APIRouter()
settings = get_settings()
limiter = Limiter(key_func=get_remote_address)

SOUNDCLOUD_API_URL = "https://api.soundcloud.com"


class BeatGrid(BaseModel):
    """Beat grid information."""

    bpm: float
    downbeats: list[float]
    beats: list[float]
    barLength: int = 4


class TrackAnalysis(BaseModel):
    """Complete track analysis result."""

    trackId: int
    bpm: float
    key: str
    keyNumber: int
    keyMode: str
    energy: float
    energyCurve: list[float]
    beatGrid: BeatGrid
    drops: list[float]
    peaks: list[float]
    phraseMarkers: list[float]


class StemStatus(BaseModel):
    """Stem separation status."""

    trackId: int
    status: str  # 'pending', 'processing', 'ready', 'error'
    drums: Optional[str] = None
    bass: Optional[str] = None
    vocals: Optional[str] = None
    other: Optional[str] = None
    error: Optional[str] = None


class CompatibilityResult(BaseModel):
    """Mix compatibility result."""

    score: int
    bpmMatch: int
    keyMatch: int
    energyFlow: int
    recommendation: str


def get_token_from_query_or_header(request: Request, token: Optional[str] = None) -> str:
    """Extract token from query param or header."""
    if token:
        return token

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.replace("Bearer ", "")

    raise HTTPException(status_code=401, detail="Missing authorization")


@router.get("/{track_id}/stream")
@limiter.limit("60/minute")
async def stream_track(
    request: Request,
    track_id: int,
    token: Optional[str] = Query(None, description="OAuth token"),
):
    """
    Proxy stream audio from SoundCloud.

    This endpoint proxies the audio stream from SoundCloud to avoid CORS issues
    and handle authentication securely without exposing tokens to the client.
    """
    access_token = get_token_from_query_or_header(request, token)

    async with httpx.AsyncClient(follow_redirects=True) as client:
        try:
            # Get track info to find stream URL
            track_response = await client.get(
                f"{SOUNDCLOUD_API_URL}/tracks/{track_id}",
                headers={"Authorization": f"OAuth {access_token}"},
            )

            if track_response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid or expired token")

            if track_response.status_code == 404:
                raise HTTPException(status_code=404, detail="Track not found")

            if track_response.status_code != 200:
                raise HTTPException(
                    status_code=track_response.status_code,
                    detail="Failed to get track info",
                )

            track_data = track_response.json()

            # Check if track is streamable
            if not track_data.get("streamable", False):
                raise HTTPException(
                    status_code=403,
                    detail="This track is not available for streaming",
                )

            # Get the stream URL
            # SoundCloud v2 API uses different stream endpoint
            stream_url = track_data.get("stream_url")
            if not stream_url:
                # Try alternative method
                stream_url = f"{SOUNDCLOUD_API_URL}/tracks/{track_id}/stream"

            # Stream the audio
            stream_response = await client.get(
                stream_url,
                headers={"Authorization": f"OAuth {access_token}"},
                params={"client_id": settings.soundcloud_client_id},
            )

            if stream_response.status_code != 200:
                # Try with /streams endpoint
                streams_response = await client.get(
                    f"{SOUNDCLOUD_API_URL}/tracks/{track_id}/streams",
                    headers={"Authorization": f"OAuth {access_token}"},
                )

                if streams_response.status_code == 200:
                    streams_data = streams_response.json()
                    # Prefer http_mp3_128_url or progressive stream
                    stream_url = streams_data.get(
                        "http_mp3_128_url",
                        streams_data.get("progressive_url", ""),
                    )

                    if stream_url:
                        stream_response = await client.get(stream_url)

            if stream_response.status_code != 200:
                raise HTTPException(
                    status_code=stream_response.status_code,
                    detail="Failed to stream audio",
                )

            # Return streaming response
            async def audio_stream():
                async for chunk in stream_response.aiter_bytes():
                    yield chunk

            return StreamingResponse(
                audio_stream(),
                media_type="audio/mpeg",
                headers={
                    "Accept-Ranges": "bytes",
                    "Content-Disposition": f'inline; filename="track_{track_id}.mp3"',
                },
            )

        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to stream from SoundCloud: {str(e)}",
            )


@router.post("/{track_id}/analyze")
@limiter.limit("20/minute")
async def analyze_track(request: Request, track_id: int) -> TrackAnalysis:
    """
    Analyze a track for BPM, key, energy, and beat grid.

    This endpoint downloads the track audio (if not cached) and performs
    ML-based analysis using librosa. Results are cached to disk.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")

    token = auth_header.replace("Bearer ", "")

    # Check cache first
    cached = analysis_service.get_cached_analysis(track_id)
    if cached:
        return TrackAnalysis(**cached)

    # Download audio for analysis
    audio_path = await analysis_service.download_audio_for_analysis(track_id, token)

    if not audio_path:
        raise HTTPException(
            status_code=500,
            detail="Failed to download audio for analysis",
        )

    try:
        # Perform analysis
        result = analysis_service.analyze_audio(track_id, audio_path)

        # Cache result
        analysis_service.cache_analysis(track_id, result)

        return TrackAnalysis(**result)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}",
        )


@router.get("/{track_id}/analysis")
@limiter.limit("60/minute")
async def get_analysis(request: Request, track_id: int) -> TrackAnalysis:
    """
    Get cached analysis for a track.

    Returns 404 if analysis hasn't been performed yet.
    """
    cached = analysis_service.get_cached_analysis(track_id)
    if not cached:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found. Call POST /tracks/{id}/analyze first.",
        )

    return TrackAnalysis(**cached)


@router.post("/{track_id}/stems")
@limiter.limit("5/minute")
async def request_stems(request: Request, track_id: int) -> StemStatus:
    """
    Request stem separation for a track.

    This endpoint initiates stem separation using Demucs. The process
    runs asynchronously and results are cached to disk.

    Note: Stem separation is CPU-intensive and may take several minutes.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")

    token = auth_header.replace("Bearer ", "")

    # Check if stems already exist
    existing = analysis_service.get_stem_status(track_id)
    if existing and existing["status"] == "ready":
        return StemStatus(**existing)

    # Check if already processing
    if existing and existing["status"] == "processing":
        return StemStatus(**existing)

    # Download audio if needed
    audio_path = await analysis_service.download_audio_for_analysis(track_id, token)

    if not audio_path:
        raise HTTPException(
            status_code=500,
            detail="Failed to download audio for stem separation",
        )

    # Start stem separation (this is blocking for MVP, ideally use background task)
    try:
        result = await analysis_service.separate_stems(track_id, audio_path)
        return StemStatus(**result)
    except Exception as e:
        return StemStatus(
            trackId=track_id,
            status="error",
            error=str(e),
        )


@router.get("/{track_id}/stems/status")
@limiter.limit("60/minute")
async def get_stem_status(request: Request, track_id: int) -> StemStatus:
    """Get the status of stem separation for a track."""
    status = analysis_service.get_stem_status(track_id)
    if not status:
        return StemStatus(trackId=track_id, status="pending")
    return StemStatus(**status)


@router.get("/{track_id}/stems/{stem_name}")
@limiter.limit("60/minute")
async def get_stem(request: Request, track_id: int, stem_name: str):
    """
    Stream a specific stem (drums, bass, vocals, other).

    Returns 404 if stems haven't been separated yet.
    """
    if stem_name not in ["drums", "bass", "vocals", "other"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid stem name. Use: drums, bass, vocals, other",
        )

    stem_path = settings.stems_dir / str(track_id) / f"{stem_name}.wav"

    if not stem_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Stem not found. Request stem separation first.",
        )

    def iter_file():
        with open(stem_path, "rb") as f:
            while chunk := f.read(65536):
                yield chunk

    return StreamingResponse(
        iter_file(),
        media_type="audio/wav",
        headers={
            "Content-Disposition": f'inline; filename="{stem_name}_{track_id}.wav"',
        },
    )


@router.get("/compatibility")
@limiter.limit("60/minute")
async def get_compatibility(
    request: Request,
    track_a: int = Query(..., description="First track ID"),
    track_b: int = Query(..., description="Second track ID"),
) -> CompatibilityResult:
    """
    Calculate mix compatibility between two tracks.

    Both tracks must have been analyzed first.
    """
    analysis_a = analysis_service.get_cached_analysis(track_a)
    analysis_b = analysis_service.get_cached_analysis(track_b)

    if not analysis_a:
        raise HTTPException(
            status_code=404,
            detail=f"Track {track_a} has not been analyzed",
        )

    if not analysis_b:
        raise HTTPException(
            status_code=404,
            detail=f"Track {track_b} has not been analyzed",
        )

    result = analysis_service.calculate_mix_compatibility(analysis_a, analysis_b)
    return CompatibilityResult(**result)
