"""File upload routes for local MP3 files."""

import hashlib
import shutil
from pathlib import Path
from typing import List
import uuid

from fastapi import APIRouter, HTTPException, UploadFile, File, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings

router = APIRouter()
settings = get_settings()
limiter = Limiter(key_func=get_remote_address)

# Ensure upload directory exists
UPLOAD_DIR = settings.cache_dir / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class UploadedTrack(BaseModel):
    """Uploaded track information."""
    id: int
    title: str
    filename: str
    duration: int  # milliseconds (0 until analyzed)
    file_path: str


class TrackListResponse(BaseModel):
    """Response with list of uploaded tracks."""
    tracks: List[UploadedTrack]


# In-memory track database (simple for MVP)
_tracks_db: dict[int, dict] = {}
_next_id: int = 1


def get_next_id() -> int:
    """Get next track ID."""
    global _next_id
    track_id = _next_id
    _next_id += 1
    return track_id


@router.post("/upload")
@limiter.limit("20/minute")
async def upload_track(request: Request, file: UploadFile = File(...)) -> UploadedTrack:
    """
    Upload an MP3 file for mixing.

    Accepts MP3, WAV, and other common audio formats.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Validate file type
    allowed_extensions = {".mp3", ".wav", ".m4a", ".ogg", ".flac"}
    file_ext = Path(file.filename).suffix.lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )

    # Generate unique ID and filename
    track_id = get_next_id()
    safe_filename = f"{track_id}_{uuid.uuid4().hex[:8]}{file_ext}"
    file_path = UPLOAD_DIR / safe_filename

    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Extract title from filename (remove extension)
    title = Path(file.filename).stem

    # Get file size to verify upload
    file_size = file_path.stat().st_size
    print(f"Uploaded track {track_id}: {file.filename} ({file_size} bytes) -> {file_path}")

    # Store in database
    track_data = {
        "id": track_id,
        "title": title,
        "filename": file.filename,
        "duration": 0,  # Will be set after analysis
        "file_path": str(file_path),
    }
    _tracks_db[track_id] = track_data

    return UploadedTrack(**track_data)


@router.post("/upload-multiple")
@limiter.limit("10/minute")
async def upload_multiple_tracks(
    request: Request,
    files: List[UploadFile] = File(...)
) -> TrackListResponse:
    """Upload multiple audio files at once."""
    uploaded_tracks = []

    for file in files:
        try:
            track = await upload_track(request, file)
            uploaded_tracks.append(track)
        except HTTPException as e:
            # Continue with other files if one fails
            print(f"Failed to upload {file.filename}: {e.detail}")

    return TrackListResponse(tracks=uploaded_tracks)


@router.get("/tracks")
async def get_uploaded_tracks() -> TrackListResponse:
    """Get list of all uploaded tracks."""
    tracks = [UploadedTrack(**data) for data in _tracks_db.values()]
    return TrackListResponse(tracks=tracks)


@router.get("/tracks/{track_id}")
async def get_track(track_id: int) -> UploadedTrack:
    """Get a specific uploaded track."""
    if track_id not in _tracks_db:
        raise HTTPException(status_code=404, detail="Track not found")
    return UploadedTrack(**_tracks_db[track_id])


@router.get("/tracks/{track_id}/stream")
async def stream_track(track_id: int):
    """Stream an uploaded track."""
    if track_id not in _tracks_db:
        raise HTTPException(status_code=404, detail="Track not found")

    track = _tracks_db[track_id]
    file_path = Path(track["file_path"])

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    # Determine media type
    ext = file_path.suffix.lower()
    media_types = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
    }
    media_type = media_types.get(ext, "audio/mpeg")

    # Add headers to prevent any caching
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=track["filename"],
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }
    )


@router.delete("/tracks/{track_id}")
async def delete_track(track_id: int):
    """Delete an uploaded track."""
    if track_id not in _tracks_db:
        raise HTTPException(status_code=404, detail="Track not found")

    track = _tracks_db[track_id]
    file_path = Path(track["file_path"])

    # Delete file
    if file_path.exists():
        file_path.unlink()

    # Remove from database
    del _tracks_db[track_id]

    return {"message": "Track deleted"}


@router.post("/tracks/{track_id}/analyze")
@limiter.limit("20/minute")
async def analyze_uploaded_track(request: Request, track_id: int):
    """Analyze an uploaded track for BPM, key, energy."""
    from app.services import analysis as analysis_service

    if track_id not in _tracks_db:
        raise HTTPException(status_code=404, detail="Track not found")

    track = _tracks_db[track_id]
    file_path = Path(track["file_path"])

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    # Check cache first
    cached = analysis_service.get_cached_analysis(track_id)
    if cached:
        # Update duration in track db
        if "duration" in cached.get("beatGrid", {}):
            beats = cached["beatGrid"].get("beats", [])
            if beats:
                duration_sec = beats[-1] if beats else 0
                _tracks_db[track_id]["duration"] = int(duration_sec * 1000)
        return cached

    try:
        # Perform analysis
        result = analysis_service.analyze_audio(track_id, file_path)

        # Update duration in track db
        beats = result.get("beatGrid", {}).get("beats", [])
        if beats:
            duration_sec = beats[-1] if beats else 0
            _tracks_db[track_id]["duration"] = int(duration_sec * 1000)

        # Cache result
        analysis_service.cache_analysis(track_id, result)

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/tracks/{track_id}/stems")
@limiter.limit("5/minute")
async def separate_track_stems(request: Request, track_id: int):
    """Separate track into stems (drums, bass, vocals, other)."""
    from app.services import analysis as analysis_service

    if track_id not in _tracks_db:
        raise HTTPException(status_code=404, detail="Track not found")

    track = _tracks_db[track_id]
    file_path = Path(track["file_path"])

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    # Check if stems already exist
    existing = analysis_service.get_stem_status(track_id)
    if existing and existing.get("status") == "ready":
        return existing

    try:
        result = await analysis_service.separate_stems(track_id, file_path)
        return result
    except Exception as e:
        return {
            "trackId": track_id,
            "status": "error",
            "error": str(e),
        }


@router.get("/tracks/{track_id}/stems/status")
async def get_track_stem_status(track_id: int):
    """Get stem separation status."""
    from app.services import analysis as analysis_service

    status = analysis_service.get_stem_status(track_id)
    if not status:
        return {"trackId": track_id, "status": "pending"}
    return status


@router.get("/tracks/{track_id}/stems/{stem_name}")
async def stream_track_stem(track_id: int, stem_name: str):
    """Stream a specific stem."""
    from app.config import get_settings
    settings = get_settings()

    if stem_name not in ["drums", "bass", "vocals", "other"]:
        raise HTTPException(status_code=400, detail="Invalid stem name")

    stem_path = settings.stems_dir / str(track_id) / f"{stem_name}.wav"

    if not stem_path.exists():
        raise HTTPException(status_code=404, detail="Stem not found. Request separation first.")

    return FileResponse(
        path=stem_path,
        media_type="audio/wav",
        filename=f"{stem_name}_{track_id}.wav",
    )
