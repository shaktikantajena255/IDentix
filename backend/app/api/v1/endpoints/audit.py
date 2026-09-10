"""
IDentix — Audit Logs API Endpoint
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.screening import AuditLog

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("")
async def list_audit_logs(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """Return recent audit log entries in reverse chronological order."""
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.event_timestamp.desc()).limit(limit)
    )
    logs = result.scalars().all()
    return [
        {
            "id": log.id,
            "timestamp": log.event_timestamp.isoformat(),
            "userId": log.user_id,
            "userName": log.user_name,
            "userRole": log.user_role,
            "action": log.action,
            "targetEntity": log.target_entity,
            "targetId": log.target_id,
            "integrityHash": log.integrity_hash,
        }
        for log in logs
    ]
