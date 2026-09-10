"""
IDentix — Pydantic Schemas (Request / Response DTOs)
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ScreeningCreateRequest(BaseModel):
    officer_id: str
    officer_name: str
    checkpoint_id: str


class ScreeningResponse(BaseModel):
    id: str
    checkpoint_id: str
    officer_id: str
    officer_name: str
    created_at: datetime
    status: str
    risk_level: str
    confidence_score: float
    officer_decision: str
    is_synced: bool

    class Config:
        from_attributes = True


class OfficerDecisionRequest(BaseModel):
    decision: str  # ACCEPTED, REFERRED_TO_SECONDARY, REJECTED
    notes: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    checkpoint_id: str
