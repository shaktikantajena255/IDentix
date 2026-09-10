"""
IDentix — Officer Model
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.utcnow()


class Officer(Base):
    __tablename__ = "officers"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    badge_id: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # OFFICER, SUPERVISOR, ADMIN
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    # Path/URI to stored face embedding for biometric comparison (Phase 6+)
    face_embedding_uri: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    failed_attempts: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
