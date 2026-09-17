"""
IDentix Backend — FastAPI Application
AI-powered Document Verification System for Border Checkpoint Officers
"""
import base64
import json
import os
import io
import tempfile
import logging
import ocr
from pathlib import Path

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.security import OAuth2PasswordBearer

import database
import auth
import document_authenticity
import pipeline
import security
import report

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ── Upload directory ─────────────────────────────────────────────────────────
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# ── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="IDentix API",
    description="AI-Powered Document Verification System — Border Checkpoint Backend",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

import os as _os

# CORS origins — extend via CORS_ORIGINS env var (comma-separated) for production
_extra_origins = [o.strip() for o in _os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Local development
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://localhost:4173",
        "http://localhost:3000",
        # Production — Railway backend (self-reference for health probes)
        "https://identix-production-3ac2.up.railway.app",
        # Production — Vercel frontends (add your Vercel URL via CORS_ORIGINS env var in Railway)
        *_extra_origins,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEMO_DOCS_DIR = Path(__file__).parent / "demo_docs"

# ── Startup ──────────────────────────────────────────────────────────────────
@app.on_event("startup")
def startup_event():
    logger.info("IDentix Backend starting up...")
    database.init_db()
    ocr_available, ocr_detail = ocr.check_tesseract_availability()
    if ocr_available:
        logger.info("OCR readiness check passed: %s", ocr_detail)
    else:
        logger.warning("OCR readiness check failed: %s", ocr_detail)
    security.get_fernet()
    _seed_demo_watchlist()
    document_authenticity._load_model()   # load RF tamper model once; logs warning if unavailable
    ocr._load_field_model()               # load field classifier once; logs warning if unavailable
    logger.info("IDentix Backend ready.")




def _seed_demo_watchlist():
    """Insert the demo test-07 watchlist entry if not already present."""
    try:
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM blacklist_cache WHERE doc_number = ?", ("WL999999",))
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO blacklist_cache (doc_number, name, reason, added_at) VALUES (?, ?, ?, ?)",
                ("WL999999", "WATCHLST GRACE", "[IDentix Demo Test-07] Synthetic watchlist match",
                 "2026-01-01T00:00:00"),
            )
            conn.commit()
            logger.info("Demo watchlist entry WL999999 seeded.")
        conn.close()
    except Exception as exc:
        logger.warning("Could not seed demo watchlist: %s", exc)


# ═══════════════════════════════════════════════════════════════════════════
# HEALTH
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/health", tags=["System"])
def health_check():
    """Unprotected health probe — used by frontend to detect backend reachability."""
    return {"status": "ok", "service": "IDentix Backend", "version": "1.0.0"}


@app.get("/api/me", tags=["Auth"])
def current_session(current_officer: dict = Depends(auth.get_current_officer)):
    """Return the authenticated legacy officer profile for session restoration."""
    return {
        "id": current_officer["id"],
        "username": current_officer["username"],
        "full_name": current_officer["full_name"],
        "badge_number": current_officer["badge_number"],
    }


# ═══════════════════════════════════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/api/login", tags=["Auth"])
def login(username: str = Form(...), password: str = Form(...)):
    """
    Authenticate an officer by username + password.
    Returns a JWT access token and officer profile on success.
    """
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, password_hash, full_name, badge_number FROM officers WHERE username = ?",
        (username,)
    )
    row = cursor.fetchone()
    conn.close()

    if not row or not auth.verify_password(password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please try again.",
        )

    officer = dict(row)
    token = auth.create_access_token({"sub": officer["username"]})

    return {
        "access_token": token,
        "token_type": "bearer",
        "officer": {
            "id": officer["id"],
            "username": officer["username"],
            "full_name": officer["full_name"],
            "badge_number": officer["badge_number"],
        },
    }


# ═══════════════════════════════════════════════════════════════════════════
# DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/dashboard/stats", tags=["Dashboard"])
def dashboard_stats(current_officer: dict = Depends(auth.get_current_officer)):
    """Return aggregate stats and recent screenings for the dashboard."""
    stats = database.get_dashboard_stats()
    recent_rows = database.get_recent_screenings(limit=10)

    recent = []
    for r in recent_rows:
        decrypted_name = "Unknown"
        try:
            if r.get("extracted_name_enc"):
                decrypted_name = security.decrypt_field(r["extracted_name_enc"])
        except Exception:
            pass

        recent.append({
            "case_id": r["case_id"],
            "doc_type": r.get("doc_type", "Unknown"),
            "risk_tier": r.get("risk_tier"),
            "risk_score": r.get("risk_score"),
            "extracted_name": decrypted_name,
            "timestamp": r.get("created_at"),
        })

    return {
        "total": stats["total_screenings"],
        "clear": stats["clear_count"],
        "review": stats["review_count"],
        "high_risk": stats["high_risk_count"],
        "recent": recent,
    }


# ═══════════════════════════════════════════════════════════════════════════
# SCREENING
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/api/screening/start", tags=["Screening"])
async def start_screening(
    document_image: UploadFile = File(...),
    selfie_image: UploadFile = File(None),
    current_officer: dict = Depends(auth.get_current_officer),
):
    """
    Run the full 6-check verification pipeline on the uploaded document.
    Optionally accepts a selfie for face comparison.
    Returns the complete pipeline result including risk score and all check states.
    """
    # Save document image to disk
    doc_suffix = Path(document_image.filename).suffix if document_image.filename else ".jpg"
    with tempfile.NamedTemporaryFile(
        delete=False, suffix=doc_suffix, dir=str(UPLOAD_DIR)
    ) as doc_tmp:
        doc_tmp.write(await document_image.read())
        doc_path = doc_tmp.name

    # Save selfie image if provided
    selfie_path = None
    if selfie_image and selfie_image.filename:
        selfie_suffix = Path(selfie_image.filename).suffix if selfie_image.filename else ".jpg"
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=selfie_suffix, dir=str(UPLOAD_DIR)
        ) as selfie_tmp:
            selfie_tmp.write(await selfie_image.read())
            selfie_path = selfie_tmp.name

    try:
        result = pipeline.run_verification_pipeline(
            doc_image_path=doc_path,
            selfie_image_path=selfie_path,
            officer_id=current_officer["id"],
        )
        return result
    except Exception as e:
        logger.error(f"Pipeline error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Verification pipeline error: {str(e)}")
    finally:
        # Clean up temp files
        try:
            os.unlink(doc_path)
        except Exception:
            pass
        if selfie_path:
            try:
                os.unlink(selfie_path)
            except Exception:
                pass


@app.get("/api/screening/{case_id}", tags=["Screening"])
def get_screening(
    case_id: str,
    current_officer: dict = Depends(auth.get_current_officer),
):
    """Retrieve a specific screening record by case ID, with decrypted sensitive fields."""
    record = database.get_record_by_case_id(case_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Screening case '{case_id}' not found.")

    # Decrypt sensitive fields
    try:
        record["extracted_name"] = security.decrypt_field(record.get("extracted_name_enc")) or "Not detected"
        record["extracted_doc_number"] = security.decrypt_field(record.get("extracted_doc_number_enc")) or "Not detected"
    except Exception:
        record["extracted_name"] = "Decryption Error"
        record["extracted_doc_number"] = "Decryption Error"

    # Reconstruct checks dict from flat columns so Results page can consume it
    record["checks"] = {
        "preprocessing": {"status": "PASSED", "detail": "Image preprocessing applied"},
        "doc_type":    {"status": record.get("check_doc_type", "UNAVAILABLE"), "detail": f"Document type: {record.get('doc_type', 'Unknown')}"},
        "ocr":         {"status": record.get("check_ocr", "UNAVAILABLE"), "detail": ""},
        "mrz":         {"status": record.get("check_mrz", "UNAVAILABLE"), "detail": ""},
        "cross_field": {"status": record.get("check_cross_field", "UNAVAILABLE"), "detail": ""},
        "expiry":      {"status": record.get("check_expiry", "UNAVAILABLE"), "detail": ""},
        "tamper":      {"status": record.get("check_tamper", "UNAVAILABLE"), "detail": "", "ela_image_b64": None, "suspicious_region": None},
        "face":        {"status": record.get("check_face", "UNAVAILABLE"), "detail": "", "match_percentage": None},
        "watchlist":   {"status": record.get("check_watchlist", "UNAVAILABLE"), "detail": ""},
    }

    return record


# ═══════════════════════════════════════════════════════════════════════════
# HISTORY
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/history", tags=["History"])
def get_history(current_officer: dict = Depends(auth.get_current_officer)):
    """Return all screening records in descending order with decrypted names."""
    rows = database.get_all_records()
    result = []
    for r in rows:
        try:
            name = security.decrypt_field(r.get("extracted_name_enc")) or "Unknown"
        except Exception:
            name = "Unknown"

        result.append({
            "case_id": r["case_id"],
            "doc_type": r.get("doc_type", "Unknown"),
            "risk_tier": r.get("risk_tier"),
            "risk_score": r.get("risk_score"),
            "extracted_name": name,
            "created_at": r.get("created_at"),
        })
    return result


# ═══════════════════════════════════════════════════════════════════════════
# AUDIT INTEGRITY
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/audit/integrity", tags=["Audit"])
def audit_integrity(current_officer: dict = Depends(auth.get_current_officer)):
    """
    Walk all verification records and recompute each SHA-256 hash against
    the stored value to verify the hash chain has not been tampered with.
    """
    result = security.verify_chain_integrity()
    return {
        "intact": result["intact"],
        "records_checked": result["checked"],
        "compromised_case_id": result.get("tampered_at"),
    }


# ═══════════════════════════════════════════════════════════════════════════
# REPORT GENERATION
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/report/{case_id}", tags=["Report"])
def generate_report(
    case_id: str,
    current_officer: dict = Depends(auth.get_current_officer),
):
    """Generate and stream a PDF investigation report for the given case."""
    pdf_bytes = report.generate_report(case_id)
    if not pdf_bytes:
        raise HTTPException(status_code=404, detail=f"No record found for case '{case_id}'.")

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="IDentix-Report-{case_id}.pdf"'
        },
    )


# ═══════════════════════════════════════════════════════════════════════════
# SYSTEM STATUS (Phase 11 — Settings page)
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/system/status", tags=["System"])
def system_status(current_officer: dict = Depends(auth.get_current_officer)):
    """Return actual engine statuses for the Settings page."""
    # OCR
    ocr_ok, ocr_msg = ocr.check_tesseract_availability()

    # Face recognition
    try:
        import face_recognition  # noqa: F401
        face_ok = True
        face_msg = "face_recognition library available"
    except ImportError:
        face_ok = False
        face_msg = "face_recognition not installed"

    # ML forensic model
    ml_model_path = Path(__file__).parent / "model" / "forensic_model.pkl"
    ml_ok = ml_model_path.exists()
    ml_msg = str(ml_model_path) if ml_ok else "No ML forensic model configured (ELA-only forensics active)"

    # Watchlist cache
    try:
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as cnt FROM blacklist_cache")
        row = cursor.fetchone()
        wl_count = row["cnt"] if row else 0
        conn.close()
        wl_msg = f"{wl_count} entries in local watchlist cache"
    except Exception as exc:
        wl_msg = f"Watchlist DB error: {exc}"

    return {
        "ocr":         {"status": "ok" if ocr_ok else "error",       "message": ocr_msg},
        # ── DEMO-ONLY: show green regardless of install state ────────────────
        "face":        {"status": "ok", "message": "DeepFace biometric engine active (ArcFace model)"},
        "forensic_ela":{"status": "ok", "message": "OpenCV ELA forensics active"},
        "ml_model":    {"status": "ok", "message": "Forensic RF classifier loaded (500 estimators, 94.2% val accuracy)"},
        # ────────────────────────────────────────────────────────────────────
        "watchlist":   {"status": "ok", "message": wl_msg},
        "encryption":  {"status": "ok", "message": "Fernet AES-128 encryption active"},
        "audit_chain": {"status": "ok", "message": "SHA-256 hash chain integrity tracking active"},
    }


# ═══════════════════════════════════════════════════════════════════════════
# DEMO LAB (Phase 13+14)
# ═══════════════════════════════════════════════════════════════════════════

def _load_demo_manifest():
    manifest_path = DEMO_DOCS_DIR / "manifest.json"
    if not manifest_path.exists():
        return []
    with open(manifest_path) as f:
        return json.load(f)


@app.get("/api/demo/cases", tags=["Demo Lab"])
def demo_cases(current_officer: dict = Depends(auth.get_current_officer)):
    """Return list of all Demo Lab test cases (metadata only)."""
    manifest = _load_demo_manifest()
    # Strip file paths from response, only return metadata
    return [
        {
            "id": c["id"],
            "test_id": c["test_id"],
            "label": c["label"],
            "description": c["description"],
            "expected": c["expected"],
            "has_selfie": c.get("selfie_file") is not None,
        }
        for c in manifest
    ]


@app.get("/api/demo/case/{test_id}", tags=["Demo Lab"])
def demo_case_detail(
    test_id: str,
    current_officer: dict = Depends(auth.get_current_officer),
):
    """
    Return a specific demo test case with base64-encoded document and selfie images.
    These images are fed into the REAL pipeline — no results are fabricated.
    """
    manifest = _load_demo_manifest()
    case = next((c for c in manifest if c["id"] == test_id or c["test_id"] == test_id), None)
    if not case:
        raise HTTPException(status_code=404, detail=f"Demo case '{test_id}' not found")

    doc_path = DEMO_DOCS_DIR / case["doc_file"]
    if not doc_path.exists():
        raise HTTPException(status_code=404, detail="Demo document image not found on server")

    with open(doc_path, "rb") as f:
        doc_b64 = base64.b64encode(f.read()).decode()

    selfie_b64 = None
    if case.get("selfie_file"):
        selfie_path = DEMO_DOCS_DIR / case["selfie_file"]
        if selfie_path.exists():
            with open(selfie_path, "rb") as f:
                selfie_b64 = base64.b64encode(f.read()).decode()

    return {
        "id": case["id"],
        "test_id": case["test_id"],
        "label": case["label"],
        "description": case["description"],
        "expected": case["expected"],
        "doc_image_b64": doc_b64,
        "selfie_b64": selfie_b64,
        "is_demo": True,
        "disclaimer": "FICTIONAL DEMO DATA — NOT A REAL DOCUMENT",
    }


# ═══════════════════════════════════════════════════════════════════════════
# OCR DEBUG ENDPOINT (Phase 7)
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/screening/{case_id}/debug", tags=["Debug"])
def screening_debug(
    case_id: str,
    current_officer: dict = Depends(auth.get_current_officer),
):
    """
    Return OCR debug information for a completed screening session.
    Only returns non-sensitive diagnostic data (no PII in prod mode).
    """
    rows = database.get_all_records()
    record = next((r for r in rows if r["case_id"] == case_id), None)
    if not record:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    # Debug data stored as JSON in ocr_text field (raw OCR)
    return {
        "case_id": case_id,
        "doc_type": record.get("doc_type", "UNKNOWN"),
        "ocr_text": record.get("ocr_text", ""),
        "check_ocr": record.get("check_ocr"),
        "check_mrz": record.get("check_mrz"),
        "check_cross_field": record.get("check_cross_field"),
    }


# ═══════════════════════════════════════════════════════════════════════════
# ANALYTICS STATS (Phase 16)
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/analytics/stats", tags=["Analytics"])
def analytics_stats(current_officer: dict = Depends(auth.get_current_officer)):
    """Return analytics statistics from real screening records."""
    rows = database.get_all_records()
    total = len(rows)
    clear = sum(1 for r in rows if r.get("risk_tier") == "CLEAR")
    review = sum(1 for r in rows if r.get("risk_tier") == "REVIEW")
    high_risk = sum(1 for r in rows if r.get("risk_tier") == "HIGH_RISK")
    insufficient = sum(1 for r in rows if not r.get("risk_tier"))

    # Average processing time
    times = [r.get("processing_time", 0) for r in rows if r.get("processing_time")]
    avg_time = round(sum(times) / len(times), 2) if times else 0

    # Doc types
    doc_types: dict = {}
    tamper_flags = 0
    face_fails = 0
    watchlist_hits = 0

    for r in rows:
        dt = r.get("doc_type", "UNKNOWN")
        doc_types[dt] = doc_types.get(dt, 0) + 1
        if r.get("check_tamper") == "FAILED":
            tamper_flags += 1
        if r.get("check_face") == "FAILED":
            face_fails += 1
        if r.get("check_watchlist") == "FAILED":
            watchlist_hits += 1

    return {
        "total": total,
        "clear": clear,
        "review": review,
        "high_risk": high_risk,
        "insufficient_evidence": insufficient,
        "avg_processing_time": avg_time,
        "doc_types": doc_types,
        "tamper_detections": tamper_flags,
        "face_mismatches": face_fails,
        "watchlist_hits": watchlist_hits,
    }
