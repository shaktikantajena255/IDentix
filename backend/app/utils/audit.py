"""
IDentix — Audit Entry Helper
Creates a tamper-evident audit log record with a chained SHA256 hash.
"""
import json
import hashlib
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.screening import AuditLog


async def create_audit_entry(
    db: AsyncSession,
    user_id: str,
    user_name: str,
    user_role: str,
    action: str,
    target_entity: str,
    target_id: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """
    Create a new audit log entry with a chained integrity hash.
    The hash includes the previous entry's hash, creating a tamper-evident chain.
    """
    # Get the most recent audit log hash for chain continuity
    result = await db.execute(
        select(AuditLog.integrity_hash)
        .order_by(AuditLog.event_timestamp.desc())
        .limit(1)
    )
    prev_hash_row = result.scalar_one_or_none()
    prev_hash = prev_hash_row if prev_hash_row else "GENESIS_BLOCK"

    # Build deterministic payload for hashing
    timestamp = datetime.utcnow()
    entry_id = str(uuid.uuid4())
    payload = {
        "id": entry_id,
        "timestamp": timestamp.isoformat(),
        "user_id": user_id,
        "action": action,
        "target_entity": target_entity,
        "target_id": target_id,
        "prev_hash": prev_hash,
    }
    raw = json.dumps(payload, sort_keys=True)
    integrity_hash = "SHA256:" + hashlib.sha256(raw.encode()).hexdigest()

    return AuditLog(
        id=entry_id,
        event_timestamp=timestamp,
        user_id=user_id,
        user_name=user_name,
        user_role=user_role,
        action=action,
        target_entity=target_entity,
        target_id=target_id,
        ip_address=ip_address,
        details_json=json.dumps(details or {}),
        integrity_hash=integrity_hash,
    )
