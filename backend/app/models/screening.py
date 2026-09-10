"""
IDentix — SQLAlchemy ORM Models
Phase 1: Foundation models — all screening, audit, and watchlist entities.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Float, Boolean, Integer, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.utcnow()


class Screening(Base):
    __tablename__ = "screenings"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    checkpoint_id: Mapped[str] = mapped_column(String(32), nullable=False)
    officer_id: Mapped[str] = mapped_column(String(64), nullable=False)
    officer_name: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20),
        default="IN_PROGRESS",
        nullable=False
    )  # IN_PROGRESS, COMPLETED, REFERRED
    risk_level: Mapped[str] = mapped_column(
        String(20),
        default="CLEAR",
        nullable=False
    )  # CLEAR, REVIEW, HIGH_RISK
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    officer_decision: Mapped[str] = mapped_column(String(30), default="PENDING")
    officer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_synced: Mapped[bool] = mapped_column(Boolean, default=False)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    documents: Mapped[list["ScreeningDocument"]] = relationship(
        "ScreeningDocument", back_populates="screening", cascade="all, delete-orphan"
    )
    evidence: Mapped[list["EvidenceItem"]] = relationship(
        "EvidenceItem", back_populates="screening", cascade="all, delete-orphan"
    )


class ScreeningDocument(Base):
    __tablename__ = "screening_documents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    screening_id: Mapped[str] = mapped_column(ForeignKey("screenings.id"), nullable=False)
    document_type: Mapped[str] = mapped_column(String(30), nullable=False)
    acquisition_mode: Mapped[str] = mapped_column(String(30), nullable=False)
    file_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    image_uri: Mapped[str | None] = mapped_column(String(512), nullable=True)
    mrz_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    mrz_checksum_valid: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    extracted_fields_json: Mapped[str] = mapped_column(Text, default="[]")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    screening: Mapped["Screening"] = relationship("Screening", back_populates="documents")


class EvidenceItem(Base):
    __tablename__ = "evidence_items"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    screening_id: Mapped[str] = mapped_column(ForeignKey("screenings.id"), nullable=False)
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)   # PASSED, FAILED, INCONCLUSIVE, UNAVAILABLE
    severity: Mapped[str] = mapped_column(String(20), nullable=False)  # INFO, WARNING, CRITICAL
    source_module: Mapped[str] = mapped_column(String(64), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=_now)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    screening: Mapped["Screening"] = relationship("Screening", back_populates="evidence")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    event_timestamp: Mapped[datetime] = mapped_column(DateTime, default=_now)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False)
    user_name: Mapped[str] = mapped_column(String(128), nullable=False)
    user_role: Mapped[str] = mapped_column(String(20), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    target_entity: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    details_json: Mapped[str] = mapped_column(Text, default="{}")
    integrity_hash: Mapped[str] = mapped_column(String(128), nullable=False)


class WatchlistRecord(Base):
    __tablename__ = "watchlist_records"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    document_number: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    issuing_country: Mapped[str] = mapped_column(String(3), nullable=False, index=True)
    document_type: Mapped[str] = mapped_column(String(30), nullable=False)
    holder_name: Mapped[str] = mapped_column(String(256), nullable=False)
    date_of_birth: Mapped[str | None] = mapped_column(String(10), nullable=True)
    reason: Mapped[str] = mapped_column(String(20), nullable=False)  # STOLEN, LOST, REVOKED, WANTED
    source_list: Mapped[str] = mapped_column(String(64), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)
