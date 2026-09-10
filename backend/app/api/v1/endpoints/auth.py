"""
IDentix — Auth API Endpoints

POST /api/v1/auth/login           → Password authentication → pre-auth token
POST /api/v1/auth/face-verify     → Biometric step → full access token
POST /api/v1/auth/logout          → Audit log + client-side token discard
GET  /api/v1/auth/me              → Validate current access token, return officer profile
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.config import settings
from app.models.officer import Officer
from app.models.screening import AuditLog
from app.schemas.auth_dto import (
    LoginRequest,
    PreAuthTokenResponse,
    FaceVerifyRequest,
    AccessTokenResponse,
    OfficerProfileResponse,
)
from app.services.auth_service import (
    verify_password,
    create_pre_auth_token,
    create_access_token,
    verify_pre_auth_token,
    verify_access_token,
)
from app.utils.audit import create_audit_entry

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    return forwarded.split(",")[0] if forwarded else (request.client.host if request.client else "unknown")


# ─── Helper: extract bearer token ──────────────────────────────────────────────
def _bearer_token(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


# ─── POST /login ───────────────────────────────────────────────────────────────
@router.post("/login", response_model=PreAuthTokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Step 1 of authentication: validate badge_id + password.
    Returns a short-lived pre-auth token (5 min). The client must
    complete face verification to obtain a full access token.

    Security: returns a generic error on failure — does NOT reveal whether
    the badge_id exists in the database (prevents user enumeration).
    """
    ip = _get_client_ip(request)

    # Look up officer
    result = await db.execute(
        select(Officer).where(
            Officer.badge_id == body.badge_id,
            Officer.is_active == True,
        )
    )
    officer = result.scalar_one_or_none()

    # Generic failure — same response for "user not found" and "wrong password"
    GENERIC_ERROR = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication failed. Verify your Badge ID and password.",
    )

    if not officer:
        # Still record a failure attempt for any badge_id tried
        audit = await create_audit_entry(
            db=db, user_id=body.badge_id, user_name="UNKNOWN",
            user_role="OFFICER", action="PASSWORD_AUTH_FAILURE",
            target_entity="AUTH", ip_address=ip,
            details={"reason": "badge_id_not_found"},
        )
        db.add(audit)
        await db.commit()
        raise GENERIC_ERROR

    # Check lockout
    if officer.failed_attempts >= settings.MAX_FAILED_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account locked after {settings.MAX_FAILED_ATTEMPTS} failed attempts. Contact your administrator.",
        )

    # Verify password
    if not verify_password(body.password, officer.password_hash):
        officer.failed_attempts += 1
        await db.commit()

        audit = await create_audit_entry(
            db=db, user_id=officer.id, user_name=officer.full_name,
            user_role=officer.role, action="PASSWORD_AUTH_FAILURE",
            target_entity="AUTH", ip_address=ip,
            details={"reason": "wrong_password", "attempt": officer.failed_attempts},
        )
        db.add(audit)
        await db.commit()
        raise GENERIC_ERROR

    # Password correct — reset failed attempts
    officer.failed_attempts = 0
    await db.flush()

    # Issue pre-auth token
    pre_auth_token = create_pre_auth_token(officer.badge_id, officer.id)

    # Audit log
    audit = await create_audit_entry(
        db=db, user_id=officer.id, user_name=officer.full_name,
        user_role=officer.role, action="PASSWORD_AUTH_SUCCESS",
        target_entity="AUTH", ip_address=ip,
        details={"requires_biometric": True, "bypass": settings.BIOMETRIC_BYPASS_ENABLED},
    )
    db.add(audit)
    await db.commit()

    return PreAuthTokenResponse(
        pre_auth_token=pre_auth_token,
        badge_id=officer.badge_id,
        full_name=officer.full_name,
        role=officer.role,
        requires_biometric=True,
        biometric_bypass_active=settings.BIOMETRIC_BYPASS_ENABLED,
    )


# ─── POST /face-verify ─────────────────────────────────────────────────────────
@router.post("/face-verify", response_model=AccessTokenResponse)
async def face_verify(
    body: FaceVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Step 2 of authentication: biometric face verification.

    Validates the pre_auth_token from step 1, then:
    - If BIOMETRIC_BYPASS_ENABLED=true: issues access token with BYPASS_ACTIVE status
    - If biometric backend is available: performs real face comparison
    - If biometric backend unavailable: returns 503 (does NOT grant access)

    IMPORTANT: This endpoint will NEVER grant access silently.
    The biometric_status field in the token makes bypass explicit and auditable.
    """
    ip = _get_client_ip(request)

    # Validate pre-auth token
    payload = verify_pre_auth_token(body.pre_auth_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired pre-authentication token. Please log in again.",
        )

    officer_id = payload["sub"]
    result = await db.execute(select(Officer).where(Officer.id == officer_id, Officer.is_active == True))
    officer = result.scalar_one_or_none()
    if not officer:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Officer account not found.")

    session_id = str(uuid.uuid4())

    # ── BYPASS MODE (development only) ─────────────────────────────────────────
    if settings.BIOMETRIC_BYPASS_ENABLED:
        biometric_status = "BYPASS_ACTIVE"
        access_token = create_access_token(
            badge_id=officer.badge_id,
            officer_id=officer.id,
            full_name=officer.full_name,
            role=officer.role,
            session_id=session_id,
            biometric_status=biometric_status,
        )
        officer.last_login = datetime.now(timezone.utc)
        audit = await create_audit_entry(
            db=db, user_id=officer.id, user_name=officer.full_name,
            user_role=officer.role, action="BIOMETRIC_BYPASS_USED",
            target_entity="AUTH", ip_address=ip,
            details={"session_id": session_id, "warning": "DEV_MODE_BYPASS"},
        )
        db.add(audit)
        await db.commit()
        return AccessTokenResponse(
            access_token=access_token,
            officer_id=officer.id,
            badge_id=officer.badge_id,
            full_name=officer.full_name,
            role=officer.role,
            expires_in_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            session_id=session_id,
            biometric_status=biometric_status,
        )

    # ── REAL BIOMETRIC VERIFICATION ────────────────────────────────────────────
    # Phase 6 will implement the InsightFace ONNX comparison here.
    # Until then, we honestly report service unavailability rather than faking success.
    #
    # The face image (body.face_image_b64) IS received and its size is checked
    # to confirm a frame was actually captured, but no inference is performed yet.
    if not body.face_image_b64 or len(body.face_image_b64) < 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No face image received or image too small. Ensure the camera is active.",
        )

    audit = await create_audit_entry(
        db=db, user_id=officer.id, user_name=officer.full_name,
        user_role=officer.role, action="BIOMETRIC_SERVICE_UNAVAILABLE",
        target_entity="AUTH", ip_address=ip,
        details={"session_id": session_id, "phase": "Phase 6 required"},
    )
    db.add(audit)
    await db.commit()

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail={
            "status": "BIOMETRIC_SERVICE_UNAVAILABLE",
            "message": (
                "Officer biometric verification engine is not yet deployed. "
                "This requires Phase 6 (InsightFace ONNX) integration. "
                "To enable development access, set BIOMETRIC_BYPASS_ENABLED=true in .env."
            ),
        },
    )


# ─── POST /logout ──────────────────────────────────────────────────────────────
@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Record a logout event. The actual token is invalidated client-side
    (removed from sessionStorage). In Phase 11, a token blocklist will be
    maintained for immediate server-side revocation.
    """
    ip = _get_client_ip(request)
    token = _bearer_token(request)
    officer_id = "UNKNOWN"
    officer_name = "UNKNOWN"
    role = "OFFICER"
    session_id = None

    if token:
        payload = verify_access_token(token)
        if payload:
            officer_id = payload.get("sub", "UNKNOWN")
            officer_name = payload.get("badge_id", "UNKNOWN")
            role = payload.get("role", "OFFICER")
            session_id = payload.get("session_id")

    audit = await create_audit_entry(
        db=db, user_id=officer_id, user_name=officer_name,
        user_role=role, action="OFFICER_LOGOUT",
        target_entity="AUTH", ip_address=ip,
        details={"session_id": session_id},
    )
    db.add(audit)
    await db.commit()


# ─── GET /me ───────────────────────────────────────────────────────────────────
@router.get("/me", response_model=OfficerProfileResponse)
async def get_me(request: Request):
    """
    Validate the current access token and return officer identity.
    Used by the frontend on page load to restore an existing session.
    """
    token = _bearer_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No token provided.")

    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or has expired. Please log in again.",
        )

    return OfficerProfileResponse(
        officer_id=payload["sub"],
        badge_id=payload["badge_id"],
        full_name=payload.get("full_name", payload["badge_id"]),
        role=payload["role"],
        session_id=payload["session_id"],
        login_at=str(payload.get("iat", "")),
    )
