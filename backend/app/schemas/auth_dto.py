"""
IDentix — Auth Pydantic Schemas
"""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    badge_id: str = Field(..., min_length=1, max_length=32)
    password: str = Field(..., min_length=1)


class PreAuthTokenResponse(BaseModel):
    """Issued after successful password check. NOT a full access token.
    The client must complete face verification to obtain an access_token."""
    pre_auth_token: str
    badge_id: str
    full_name: str
    role: str
    requires_biometric: bool = True
    biometric_bypass_active: bool = False


class FaceVerifyRequest(BaseModel):
    pre_auth_token: str
    # Base64-encoded JPEG frame from the officer's webcam
    face_image_b64: str


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    officer_id: str
    badge_id: str
    full_name: str
    role: str
    expires_in_seconds: int
    session_id: str
    biometric_status: str  # VERIFIED | BYPASS_ACTIVE | SERVICE_UNAVAILABLE


class FaceVerifyUnavailableResponse(BaseModel):
    status: str = "BIOMETRIC_SERVICE_UNAVAILABLE"
    message: str


class OfficerProfileResponse(BaseModel):
    officer_id: str
    badge_id: str
    full_name: str
    role: str
    session_id: str
    login_at: str
