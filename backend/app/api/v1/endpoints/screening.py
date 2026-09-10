"""
IDentix — Screening API Endpoint
Phase 1: Case initialization and basic management.
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.screening import Screening, AuditLog
from app.schemas.screening_dto import ScreeningCreateRequest, ScreeningResponse, OfficerDecisionRequest
from app.core.config import settings
from app.utils.audit import create_audit_entry

router = APIRouter(prefix="/screening", tags=["Screening"])


@router.post("", response_model=ScreeningResponse, status_code=status.HTTP_201_CREATED)
async def create_screening_case(
    body: ScreeningCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Initialize a new screening case. Records an audit log event.
    The officer ID, name, and checkpoint are bound to this session.
    """
    screening = Screening(
        id=f"SCR-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:5].upper()}",
        checkpoint_id=body.checkpoint_id,
        officer_id=body.officer_id,
        officer_name=body.officer_name,
        status="IN_PROGRESS",
        risk_level="CLEAR",
        confidence_score=0.0,
        officer_decision="PENDING",
        is_synced=False,
    )
    db.add(screening)
    await db.flush()

    # Create audit log entry
    audit = await create_audit_entry(
        db=db,
        user_id=body.officer_id,
        user_name=body.officer_name,
        user_role="OFFICER",
        action="SCREENING_INITIATED",
        target_entity="SCREENING",
        target_id=screening.id,
        details={"checkpoint_id": body.checkpoint_id},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(screening)
    return screening


@router.get("", response_model=list[ScreeningResponse])
async def list_screenings(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Return the most recent screening cases."""
    result = await db.execute(
        select(Screening).order_by(Screening.created_at.desc()).limit(limit)
    )
    return result.scalars().all()


@router.get("/{screening_id}", response_model=ScreeningResponse)
async def get_screening(
    screening_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve a specific screening case by ID."""
    result = await db.execute(
        select(Screening).where(Screening.id == screening_id)
    )
    screening = result.scalar_one_or_none()
    if not screening:
        raise HTTPException(status_code=404, detail="Screening case not found.")
    return screening


@router.post("/{screening_id}/decision", response_model=ScreeningResponse)
async def submit_officer_decision(
    screening_id: str,
    body: OfficerDecisionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Record the officer's final verdict on a screening case."""
    result = await db.execute(
        select(Screening).where(Screening.id == screening_id)
    )
    screening = result.scalar_one_or_none()
    if not screening:
        raise HTTPException(status_code=404, detail="Screening case not found.")

    valid_decisions = {"ACCEPTED", "REFERRED_TO_SECONDARY", "REJECTED"}
    if body.decision not in valid_decisions:
        raise HTTPException(status_code=422, detail=f"Invalid decision. Must be one of: {valid_decisions}")

    screening.officer_decision = body.decision
    screening.officer_notes = body.notes
    screening.status = "COMPLETED"
    screening.completed_at = datetime.utcnow()

    audit = await create_audit_entry(
        db=db,
        user_id=screening.officer_id,
        user_name=screening.officer_name,
        user_role="OFFICER",
        action="OFFICER_DECISION_SUBMITTED",
        target_entity="SCREENING",
        target_id=screening.id,
        details={"decision": body.decision},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(screening)
    return screening
