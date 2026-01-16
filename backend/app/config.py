"""Configuration settings for Beatly backend."""

from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # SoundCloud OAuth
    soundcloud_client_id: str = ""
    soundcloud_client_secret: str = ""
    soundcloud_redirect_uri: str = "http://localhost:5173/callback"

    # API settings
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    # Allow all origins for development (mobile testing)
    cors_origins: list[str] = ["*"]

    # Rate limiting
    rate_limit_requests: int = 100
    rate_limit_period: int = 60  # seconds

    # Analysis cache
    cache_dir: Path = Path("./cache")
    stems_dir: Path = Path("./cache/stems")
    analysis_dir: Path = Path("./cache/analysis")

    # Stem separation
    demucs_model: str = "htdemucs"
    demucs_device: str = "cpu"  # "cuda" for GPU

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    settings = Settings()
    # Ensure cache directories exist
    settings.cache_dir.mkdir(parents=True, exist_ok=True)
    settings.stems_dir.mkdir(parents=True, exist_ok=True)
    settings.analysis_dir.mkdir(parents=True, exist_ok=True)
    return settings
