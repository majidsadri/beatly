"""Main FastAPI application for Beatly backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import get_settings
from app.routes import auth, playlists, tracks, uploads

settings = get_settings()

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# Create FastAPI app
app = FastAPI(
    title="Beatly API",
    description="DJ-style mixing backend with SoundCloud integration",
    version="1.0.0",
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(playlists.router, prefix="/api/playlists", tags=["playlists"])
app.include_router(tracks.router, prefix="/api/tracks", tags=["tracks"])
app.include_router(uploads.router, prefix="/api/uploads", tags=["uploads"])


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "beatly-api"}


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    # Ensure cache directories exist
    settings.cache_dir.mkdir(parents=True, exist_ok=True)
    settings.stems_dir.mkdir(parents=True, exist_ok=True)
    settings.analysis_dir.mkdir(parents=True, exist_ok=True)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
    )
