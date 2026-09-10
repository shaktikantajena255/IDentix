"""
IDentix — Application Configuration
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "IDentix"
    APP_VERSION: str = "1.0.0"

    # Checkpoint identity
    CHECKPOINT_ID: str = "T2-CP-04B"
    CHECKPOINT_NAME: str = "Terminal 2 — Checkpoint Alpha"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/identix_local.db"

    # JWT — MUST be changed in production
    SECRET_KEY: str = "identix-dev-secret-CHANGE-IN-PRODUCTION-min-32-chars"
    ALGORITHM: str = "HS256"
    # Pre-auth token (after password, before face): short-lived
    PRE_AUTH_TOKEN_EXPIRE_MINUTES: int = 5
    # Full access token (after successful face verify): 8-hour officer shift
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # ─── BIOMETRIC BYPASS ────────────────────────────────────────────────────
    # DEVELOPMENT ONLY: Set to true to skip face verification when the
    # InsightFace biometric engine is not yet deployed (Phase 6).
    #
    # WARNING: NEVER set this to true in a production deployment.
    # When true, a visible [DEV MODE — BYPASS ACTIVE] banner is shown in the UI.
    # ─────────────────────────────────────────────────────────────────────────
    BIOMETRIC_BYPASS_ENABLED: bool = True

    # Offline sync
    SYNC_ENDPOINT: str = ""
    WATCHLIST_CACHE_VERSION: str = "v0.0.0"

    # AI/CV — Phase 3+ thresholds
    FACE_SIMILARITY_THRESHOLD: float = 0.65
    LIVENESS_CONFIDENCE_THRESHOLD: float = 0.70

    # Account lockout after N failed password attempts
    MAX_FAILED_ATTEMPTS: int = 5


settings = Settings()
