"""
IDentix — Authentication Service
Handles password hashing, JWT issuance, and token verification.
Uses bcrypt directly (compatible with bcrypt>=4.0 on Python 3.14).
"""
import uuid
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt

from app.core.config import settings


# ─── Password Utilities ────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Hash a plain-text password with bcrypt. Returns a UTF-8 string."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(plain.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Constant-time bcrypt comparison. Returns True if passwords match."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ─── JWT Utilities ─────────────────────────────────────────────────────────────

def _create_token(data: dict, expires_in_minutes: int) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)
    payload.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_pre_auth_token(badge_id: str, officer_id: str) -> str:
    """
    Issued after successful password authentication.
    Short-lived (5 minutes). Scope is 'password_only' — does NOT grant
    access to protected officer routes. Must be upgraded via face verify.
    """
    return _create_token(
        {
            "sub": officer_id,
            "badge_id": badge_id,
            "scope": "password_only",
            "jti": str(uuid.uuid4()),
        },
        expires_in_minutes=settings.PRE_AUTH_TOKEN_EXPIRE_MINUTES,
    )


def create_access_token(
    badge_id: str,
    officer_id: str,
    full_name: str,
    role: str,
    session_id: str,
    biometric_status: str,
) -> str:
    """
    Full access token. Issued only after biometric verification (or bypass).
    Grants access to officer/admin routes for the duration of the shift.
    """
    return _create_token(
        {
            "sub": officer_id,
            "badge_id": badge_id,
            "full_name": full_name,
            "role": role,
            "scope": "full_access",
            "session_id": session_id,
            "biometric_status": biometric_status,
            "checkpoint_id": settings.CHECKPOINT_ID,
            "jti": str(uuid.uuid4()),
        },
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
    )


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT. Returns payload or None on failure."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


def verify_pre_auth_token(token: str) -> Optional[dict]:
    """Verify a pre-auth token (scope must be 'password_only')."""
    payload = decode_token(token)
    if payload and payload.get("scope") == "password_only":
        return payload
    return None


def verify_access_token(token: str) -> Optional[dict]:
    """Verify a full access token (scope must be 'full_access')."""
    payload = decode_token(token)
    if payload and payload.get("scope") == "full_access":
        return payload
    return None
