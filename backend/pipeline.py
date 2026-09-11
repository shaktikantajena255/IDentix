"""
IDentix Verification Pipeline
Sequential 10-stage document verification pipeline.

Stage order (ICAO-aligned):
  1. Image Preprocessing       → always runs inside OCR module
  2. Document Type Detection   → from OCR result
  3. OCR + MRZ Extraction      → ocr.extract_document_info()
  4. MRZ Checksum Validation   → ocr.validate_mrz_checksum()
  5. Cross-Field Validation    → compare OCR visible fields vs MRZ fields
  6. Document Validity (Expiry)→ compare expiry vs today
  7. Forensic / Tamper (ELA)   → tamper.run_ela()
  8. Face Verification         → face.compare_faces()
  9. Watchlist Check           → local blacklist_cache + online flag
 10. Explainable Risk Engine   → deterministic formula:
        Face 40 % | Tamper 35 % | OCR/Cross-field 25 %
     Hard overrides:
        MRZ FAILED        → clamp to 90+
        Watchlist FAILED  → clamp to 95+
        2+ INCONCLUSIVE/UNAVAILABLE → Insufficient Evidence

Every stage returns one of: PASSED | FAILED | INCONCLUSIVE | UNAVAILABLE

Risk tiers: 0-25 = CLEAR | 26-65 = REVIEW | 66-100 = HIGH_RISK
"""
import time
import string
import random
import socket
import logging
import re
from datetime import datetime, date

import database
import ocr
import tamper
import face
import security

logger = logging.getLogger(__name__)


# ─── Utilities ─────────────────────────────────────────────────────────────────

def generate_case_id() -> str:
    date_str = datetime.now().strftime("%Y%m%d")
    random_hex = "".join(random.choices(string.digits + "ABCDEF", k=6))
    return f"IDX-{date_str}-{random_hex}"


# Cache online status for 60 s — avoids a ~1.5s socket probe on every screening.
_online_cache: dict = {"result": None, "ts": 0.0}

def _is_online() -> bool:
    """
    Fast connectivity probe — max 0.5 s, result cached 60 s.
    Never hangs the pipeline more than once per minute.
    """
    now = time.time()
    if _online_cache["result"] is not None and now - _online_cache["ts"] < 60:
        return _online_cache["result"]
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.5)
        s.connect(("8.8.8.8", 53))
        s.close()
        result = True
    except Exception:
        result = False
    finally:
        socket.setdefaulttimeout(None)
    _online_cache["result"] = result
    _online_cache["ts"] = now
    return result


# ─── Stage 5: Cross-Field Validation ───────────────────────────────────────────

def _cross_field_validation(ocr_result: dict) -> dict:
    """
    Compare visible VIZ fields against MRZ-decoded fields wherever both exist.

    VIZ fields are read from viz_* keys in ocr_result — these are the values
    extracted purely from visible label text, BEFORE MRZ overwrites them for
    passport documents.  This ensures we compare VIZ vs MRZ genuinely instead
    of MRZ vs MRZ (which would always trivially pass).

    Falls back to extracted_* when viz_* is absent (e.g. non-passport docs
    where no MRZ overwrite occurred, so both keys carry the same value).

    MRZ fields are extracted from mrz_lines via _extract_passport_from_mrz.
    Only passport MRZ (TD3 P< prefix) is compared; for other doc types
    MRZ comparison is INCONCLUSIVE.

    Returns status: PASSED | FAILED | INCONCLUSIVE | UNAVAILABLE
    """
    mrz_lines = ocr_result.get("mrz_lines", [])
    doc_type = ocr_result.get("doc_type", "UNKNOWN")
    mismatches = []
    comparisons_made = 0

    # If no MRZ, we cannot compare
    if not mrz_lines or len(mrz_lines) < 2:
        return {
            "status": "INCONCLUSIVE",
            "detail": "No MRZ lines available for cross-field comparison",
            "mismatches": [],
        }

    # Only validate passport MRZ (TD3: line1 starts with P<)
    line1 = mrz_lines[0] if mrz_lines else ""
    if not line1.startswith("P<"):
        return {
            "status": "INCONCLUSIVE",
            "detail": f"MRZ format is not TD3 passport (doc type: {doc_type}). Cross-field comparison skipped.",
            "mismatches": [],
        }

    # Get MRZ-decoded fields
    from ocr import _extract_passport_from_mrz, _normalize_mrz_line
    mrz_info = _extract_passport_from_mrz(mrz_lines)

    # Helper: prefer viz_* (VIZ-only) over extracted_* (may be MRZ-overwritten).
    def _viz(viz_key: str, fallback_key: str) -> str:
        val = ocr_result.get(viz_key, "Not detected")
        if not val or val == "Not detected":
            val = ocr_result.get(fallback_key, "Not detected")
        return val or "Not detected"

    # ── DOB comparison ─────────────────────────────────────────────────────────
    visible_dob = _viz("viz_dob", "extracted_dob")
    mrz_dob = mrz_info.get("dob", "Not detected")  # YYMMDD

    if visible_dob != "Not detected" and mrz_dob != "Not detected":
        comparisons_made += 1
        # Normalise visible DOB to YYMMDD for comparison
        normalised = _normalise_date_to_yymmdd(visible_dob)
        if normalised and normalised != mrz_dob:
            mismatches.append(
                f"Date of birth mismatch — VIZ: '{visible_dob}' vs MRZ: '{mrz_dob}'"
            )

    # ── Expiry comparison ──────────────────────────────────────────────────────
    visible_expiry = _viz("viz_expiry", "extracted_expiry")
    mrz_expiry = mrz_info.get("expiry", "Not detected")  # YYMMDD

    if visible_expiry != "Not detected" and mrz_expiry != "Not detected":
        comparisons_made += 1
        normalised = _normalise_date_to_yymmdd(visible_expiry)
        if normalised and normalised != mrz_expiry:
            mismatches.append(
                f"Expiry date mismatch — VIZ: '{visible_expiry}' vs MRZ: '{mrz_expiry}'"
            )

    # ── Document number comparison ─────────────────────────────────────────────
    visible_doc_num = _viz("viz_doc_number", "extracted_doc_number")
    mrz_doc_num = mrz_info.get("doc_number", "Not detected")

    if visible_doc_num != "Not detected" and mrz_doc_num != "Not detected":
        comparisons_made += 1
        # Strip filler characters
        v = re.sub(r"[^A-Z0-9]", "", visible_doc_num.upper())
        m = re.sub(r"[^A-Z0-9]", "", mrz_doc_num.upper())
        if v != m:
            mismatches.append(
                f"Document number mismatch — VIZ: '{visible_doc_num}' vs MRZ: '{mrz_doc_num}'"
            )

    # ── Name comparison ────────────────────────────────────────────────────────
    visible_name = _viz("viz_name", "extracted_name")
    mrz_name = mrz_info.get("name", "Not detected")

    if visible_name != "Not detected" and mrz_name != "Not detected":
        comparisons_made += 1
        # Loose comparison: normalise and check overlap
        v_tokens = set(re.sub(r"[^A-Z ]", "", visible_name.upper()).split())
        m_tokens = set(re.sub(r"[^A-Z ]", "", mrz_name.upper()).split())
        if v_tokens and m_tokens and not v_tokens.intersection(m_tokens):
            mismatches.append(
                f"Name mismatch — VIZ: '{visible_name}' vs MRZ: '{mrz_name}'"
            )

    # ── Result ─────────────────────────────────────────────────────────────────
    if comparisons_made == 0:
        return {
            "status": "INCONCLUSIVE",
            "detail": "Insufficient VIZ + MRZ field overlap for cross-field comparison",
            "mismatches": [],
        }

    if mismatches:
        return {
            "status": "FAILED",
            "detail": "; ".join(mismatches),
            "mismatches": mismatches,
        }

    return {
        "status": "PASSED",
        "detail": f"All {comparisons_made} available VIZ vs MRZ cross-field comparison(s) passed",
        "mismatches": [],
    }




def _normalise_date_to_yymmdd(date_str: str) -> str | None:
    """
    Try to convert a visible date string to YYMMDD for MRZ comparison.
    Returns None if conversion fails (do not crash).
    """
    date_str = date_str.strip().upper()

    MONTHS = {
        "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04",
        "MAY": "05", "JUN": "06", "JUL": "07", "AUG": "08",
        "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12",
    }

    # DD MMM YYYY  e.g. 15 AUG 2005
    m = re.match(r"(\d{1,2})\s*([A-Z]{3})\s*(\d{4})", date_str)
    if m:
        day, mon, year = m.group(1).zfill(2), MONTHS.get(m.group(2), ""), m.group(3)
        if mon:
            return year[2:] + mon + day  # YYMMDD

    # DD/MM/YYYY or DD-MM-YYYY
    m = re.match(r"(\d{2})[/\-](\d{2})[/\-](\d{4})", date_str)
    if m:
        return m.group(3)[2:] + m.group(2) + m.group(1)

    # YYYY-MM-DD
    m = re.match(r"(\d{4})[/\-](\d{2})[/\-](\d{2})", date_str)
    if m:
        return m.group(1)[2:] + m.group(2) + m.group(3)

    return None


# ─── Stage 6: Document Validity (Expiry) ───────────────────────────────────────

def _check_document_expiry(ocr_result: dict) -> dict:
    """
    Compare extracted_expiry against today's date.

    IMPORTANT: Expired does NOT mean fake. It is an administrative status.

    Returns status: PASSED | FAILED | INCONCLUSIVE | UNAVAILABLE
    """
    expiry_raw = ocr_result.get("extracted_expiry", "Not detected")

    if expiry_raw == "Not detected":
        return {
            "status": "INCONCLUSIVE",
            "detail": "Expiry date not detected — cannot verify document validity period",
        }

    today = date.today()

    # Try YYMMDD (MRZ format)
    expiry_date = None
    m = re.fullmatch(r"(\d{2})(\d{2})(\d{2})", expiry_raw)
    if m:
        try:
            yy, mm, dd = int(m.group(1)), int(m.group(2)), int(m.group(3))
            # ICAO: year 00-68 → 2000-2068, 69-99 → 1969-1999
            full_year = 2000 + yy if yy <= 68 else 1900 + yy
            expiry_date = date(full_year, mm, dd)
        except ValueError:
            pass

    # Try DD MMM YYYY
    if not expiry_date:
        MONTHS = {
            "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4,
            "MAY": 5, "JUN": 6, "JUL": 7, "AUG": 8,
            "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
        }
        m2 = re.match(r"(\d{1,2})\s*([A-Z]{3})\s*(\d{4})", expiry_raw.upper())
        if m2:
            try:
                mon = MONTHS.get(m2.group(2))
                if mon:
                    expiry_date = date(int(m2.group(3)), mon, int(m2.group(1)))
            except ValueError:
                pass

    # Try DD/MM/YYYY or DD-MM-YYYY
    if not expiry_date:
        m3 = re.match(r"(\d{2})[/\-](\d{2})[/\-](\d{4})", expiry_raw)
        if m3:
            try:
                expiry_date = date(int(m3.group(3)), int(m3.group(2)), int(m3.group(1)))
            except ValueError:
                pass

    if not expiry_date:
        return {
            "status": "INCONCLUSIVE",
            "detail": f"Could not parse expiry date: '{expiry_raw}'",
        }

    if expiry_date < today:
        days_ago = (today - expiry_date).days
        return {
            "status": "FAILED",
            "detail": (
                f"Document expired {days_ago} day(s) ago (expiry: {expiry_date.isoformat()}). "
                "NOTE: Expired status does not indicate the document is fraudulent."
            ),
        }

    days_remaining = (expiry_date - today).days
    if days_remaining == 0:
        return {
            "status": "FAILED",
            "detail": f"Document expires today ({expiry_date.isoformat()}). NOTE: Expiry status does not indicate fraud.",
        }

    return {
        "status": "PASSED",
        "detail": f"Document valid until {expiry_date.isoformat()} ({days_remaining} day(s) remaining)",
    }


# ─── Stage 10: Explainable Risk Engine ─────────────────────────────────────────

def _compute_risk(
    face_check: dict,
    tamper_check: dict,
    ocr_check: dict,
    cross_field_check: dict,
    mrz_check: dict,
    watchlist_check: dict,
    expiry_check: dict,
) -> tuple[int | None, str | None, str, bool, list[str]]:
    """
    Deterministic risk engine.

    Formula (when sufficient evidence):
        Face match        = 40 % weight
        Tamper evidence   = 35 % weight
        OCR/Cross-field   = 25 % weight  (average of OCR + cross-field)

    Each component contributes 0 (PASSED), 50 (INCONCLUSIVE/UNAVAILABLE),
    or 100 (FAILED) to its weighted share.

    Hard overrides (applied AFTER base calculation):
        MRZ checksum FAILED      → score = max(score, 90)
        Watchlist FAILED         → score = max(score, 95)

    Tier boundaries:
         0–25  = CLEAR
        26–65  = REVIEW
        66–100 = HIGH_RISK

    Insufficient evidence rule:
        If 2+ of these 5 checks are INCONCLUSIVE or UNAVAILABLE
        {OCR, MRZ, Cross-field, Face, Watchlist}
        → return None score, None tier, INSUFFICIENT_EVIDENCE flag.

    Returns: (risk_score, risk_tier, risk_explanation, insufficient_evidence, reasons)
    """

    def component_score(status: str) -> int:
        """Convert a check status to a 0–100 component risk contribution."""
        if status == "PASSED":
            return 0
        if status == "FAILED":
            return 100
        # INCONCLUSIVE or UNAVAILABLE
        return 50

    # ── Check for insufficient evidence ───────────────────────────────────────
    key_checks = [
        ocr_check["status"],
        mrz_check["status"],
        cross_field_check["status"],
        face_check["status"],
        watchlist_check["status"],
    ]
    inconclusive_count = sum(
        1 for s in key_checks if s in ("INCONCLUSIVE", "UNAVAILABLE")
    )
    insufficient_evidence = inconclusive_count >= 2

    if insufficient_evidence:
        explanation = (
            "Insufficient evidence to compute a reliable risk score. "
            f"{inconclusive_count} of 5 key checks returned INCONCLUSIVE or UNAVAILABLE. "
            "Manual verification is required."
        )
        return None, None, explanation, True, []

    # ── Base weighted calculation ──────────────────────────────────────────────
    # Face: 40%
    face_contrib = component_score(face_check["status"]) * 0.40

    # Tamper: 35%
    tamper_contrib = component_score(tamper_check["status"]) * 0.35

    # OCR/Cross-field: 25% (average of OCR + cross-field, each worth 12.5%)
    ocr_score = component_score(ocr_check["status"])
    cross_score = component_score(cross_field_check["status"])
    ocr_cross_contrib = ((ocr_score + cross_score) / 2) * 0.25

    base_score = int(round(face_contrib + tamper_contrib + ocr_cross_contrib))
    risk_score = max(0, min(100, base_score))

    reasons = []

    # ── Hard overrides ─────────────────────────────────────────────────────────
    if mrz_check["status"] == "FAILED":
        risk_score = max(90, risk_score)
        reasons.append(
            "MRZ checksum validation failed — internal document data consistency cannot be confirmed"
        )

    if watchlist_check["status"] == "FAILED":
        risk_score = max(95, risk_score)
        reasons.append(
            "Document number matches a flagged entry in the watch database"
        )

    # ── Human-readable reasons ─────────────────────────────────────────────────
    if face_check["status"] == "FAILED":
        pct = face_check.get("match_percentage")
        pct_str = f" ({pct:.1f}% similarity)" if pct is not None else ""
        reasons.append(f"Face comparison shows significant mismatch with document photo{pct_str}")
    elif face_check["status"] in ("INCONCLUSIVE", "UNAVAILABLE"):
        reasons.append(f"Face verification {face_check['status'].lower()} — {face_check.get('detail', '')}")

    if tamper_check["status"] == "FAILED":
        reasons.append(
            "Error Level Analysis (ELA) detected potential image manipulation in document"
        )
    elif tamper_check["status"] == "INCONCLUSIVE":
        reasons.append("Forensic analysis returned inconclusive result")

    if cross_field_check["status"] == "FAILED":
        for mismatch in cross_field_check.get("mismatches", []):
            reasons.append(mismatch)
    elif cross_field_check["status"] == "INCONCLUSIVE":
        reasons.append("Cross-field validation could not be completed — insufficient field overlap")

    if ocr_check["status"] == "INCONCLUSIVE":
        reasons.append("Partial text extraction — document may have printing defects or be low quality")
    elif ocr_check["status"] == "UNAVAILABLE":
        reasons.append("OCR engine unavailable — text extraction could not be performed")

    if expiry_check["status"] == "FAILED":
        reasons.append(expiry_check.get("detail", "Document may be expired"))

    if mrz_check["status"] == "INCONCLUSIVE":
        reasons.append("MRZ data was not available or could not be fully parsed")

    if watchlist_check["status"] in ("INCONCLUSIVE", "UNAVAILABLE"):
        reasons.append(f"Watchlist check {watchlist_check['status'].lower()} — {watchlist_check.get('detail', '')}")

    # ── Tier ──────────────────────────────────────────────────────────────────
    if risk_score <= 25:
        risk_tier = "CLEAR"
        if not reasons:
            reasons.append("All automated checks passed — document appears consistent")
    elif risk_score <= 65:
        risk_tier = "REVIEW"
    else:
        risk_tier = "HIGH_RISK"

    risk_explanation = ". ".join(reasons) + "." if reasons else "No specific risk factors identified."

    return risk_score, risk_tier, risk_explanation, False, reasons


# ─── Main Pipeline ──────────────────────────────────────────────────────────────

def run_verification_pipeline(
    doc_image_path: str,
    selfie_image_path: str | None,
    officer_id: int,
) -> dict:
    """
    Run the full 10-stage sequential verification pipeline.

    Every stage returns a check dict with at minimum:
        { "status": PASSED|FAILED|INCONCLUSIVE|UNAVAILABLE, "detail": str }

    Stages are never silently skipped.
    """
    start_time = time.time()
    logger.info("Pipeline started for officer_id=%s", officer_id)

    # ── Stage 1-3: Preprocessing + Doc Type + OCR/MRZ ─────────────────────────
    # Preprocessing runs inside extract_document_info (perspective, threshold,
    # resize, noise removal) — not exported as a separate HTTP call but is
    # tracked in the preprocessing_check result below.
    ocr_result = ocr.extract_document_info(doc_image_path)

    preprocessing_check = {
        "status": "PASSED" if ocr_result["status"] != "UNAVAILABLE" else "UNAVAILABLE",
        "detail": "Image preprocessing completed (grayscale, upscale, threshold variants)",
    }

    doc_type_check = {
        "status": "PASSED" if ocr_result["doc_type"] not in ("UNKNOWN", "") else "INCONCLUSIVE",
        "detail": f"Detected document type: {ocr_result['doc_type']}",
    }

    ocr_check = {
        "status": ocr_result["status"],
        "detail": ocr_result["detail"],
    }

    # ── Stage 4: MRZ Checksum ─────────────────────────────────────────────────
    mrz_check = ocr.validate_mrz_checksum(ocr_result["mrz_lines"])

    # ── Stage 5: Cross-Field Validation ───────────────────────────────────────
    cross_field_check = _cross_field_validation(ocr_result)

    # ── Stage 6: Document Validity (Expiry) ───────────────────────────────────
    expiry_check = _check_document_expiry(ocr_result)

    # ── Stage 7: Forensic / Tamper (ELA + ML Random Forest) ───────────────────
    tamper_result = tamper.run_tamper_check(doc_image_path)
    tamper_check = {
        "status":          tamper_result["status"],
        "detail":          tamper_result["detail"],
        "ela_image_b64":   tamper_result.get("ela_image_b64", ""),
        "suspicious_region": tamper_result.get("suspicious_region"),
        "max_ela_value":   tamper_result.get("max_ela_value", 0.0),
        # Both signal details — exposed to frontend
        "ela_status":      tamper_result.get("ela_status"),
        "ela_detail":      tamper_result.get("ela_detail"),
        "ml_status":       tamper_result.get("ml_status"),
        "ml_probability":  tamper_result.get("ml_probability"),
        "ml_label":        tamper_result.get("ml_label"),
    }


    # ── Stage 8: Face Verification ─────────────────────────────────────────────
    face_check = face.compare_faces(doc_image_path, selfie_image_path)

    # ── Stage 9: Watchlist Check ───────────────────────────────────────────────
    doc_number = ocr_result.get("extracted_doc_number", "Not detected")
    online = _is_online()

    if doc_number and doc_number != "Not detected":
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM blacklist_cache WHERE doc_number = ?", (doc_number,)
        )
        bl_entry = cursor.fetchone()
        conn.close()

        if bl_entry:
            watchlist_status = "FAILED"
            watchlist_detail = f"Match found in local watchlist: {bl_entry['reason']}"
        elif not online:
            watchlist_status = "UNAVAILABLE"
            watchlist_detail = (
                "Offline — live watchlist check unavailable. "
                "Local cache checked (no match found). "
                "This result must be verified when connectivity is restored."
            )
        else:
            watchlist_status = "PASSED"
            watchlist_detail = "Document number not found in local watchlist cache. Live check: online."
    else:
        watchlist_status = "INCONCLUSIVE"
        watchlist_detail = "Document number not detected — watchlist check could not be performed"

    watchlist_check = {
        "status": watchlist_status,
        "detail": watchlist_detail,
        "online": online,
    }

    # ── Stage 10: Risk Engine ──────────────────────────────────────────────────
    risk_score, risk_tier, risk_explanation, insufficient_evidence, reasons = _compute_risk(
        face_check=face_check,
        tamper_check=tamper_check,
        ocr_check=ocr_check,
        cross_field_check=cross_field_check,
        mrz_check=mrz_check,
        watchlist_check=watchlist_check,
        expiry_check=expiry_check,
    )

    processing_time = time.time() - start_time
    case_id = generate_case_id()

    logger.info(
        "Pipeline complete: case_id=%s tier=%s score=%s time=%.2fs",
        case_id, risk_tier, risk_score, processing_time,
    )

    # ── Persist to Database ────────────────────────────────────────────────────
    record_data = {
        "case_id": case_id,
        "officer_id": officer_id,
        "doc_type": ocr_result["doc_type"],
        "extracted_name_enc": security.encrypt_field(ocr_result["extracted_name"]),
        "extracted_dob": ocr_result["extracted_dob"],
        "extracted_doc_number_enc": security.encrypt_field(ocr_result["extracted_doc_number"]),
        "extracted_expiry": ocr_result["extracted_expiry"],
        "extracted_nationality": ocr_result["extracted_nationality"],
        "check_doc_type": doc_type_check["status"],
        "check_ocr": ocr_check["status"],
        "check_mrz": mrz_check["status"],
        "check_cross_field": cross_field_check["status"],
        "check_expiry": expiry_check["status"],
        "check_tamper": tamper_check["status"],
        "check_face": face_check["status"],
        "check_watchlist": watchlist_check["status"],
        "risk_score": risk_score,
        "risk_tier": risk_tier,
        "risk_explanation": risk_explanation,
        "processing_time": processing_time,
        "created_at": datetime.utcnow().isoformat(),
        "synced": 1 if online else 0,
    }

    prev_hash = database.get_last_record_hash()
    record_hash = security.compute_record_hash(record_data, prev_hash)
    record_data["record_hash"] = record_hash
    record_data["previous_hash"] = prev_hash

    database.insert_verification_record(record_data)

    # ── Return Full Pipeline Result ────────────────────────────────────────────
    return {
        "case_id": case_id,
        "doc_type": ocr_result["doc_type"],
        "extracted_name": ocr_result["extracted_name"],
        "extracted_dob": ocr_result["extracted_dob"],
        "extracted_doc_number": ocr_result["extracted_doc_number"],
        "extracted_expiry": ocr_result["extracted_expiry"],
        "extracted_nationality": ocr_result["extracted_nationality"],
        "ocr_text": ocr_result["raw_text"],
        "checks": {
            "preprocessing": preprocessing_check,
            "doc_type": doc_type_check,
            "ocr": ocr_check,
            "mrz": mrz_check,
            "cross_field": cross_field_check,
            "expiry": expiry_check,
            "tamper": tamper_check,
            "face": face_check,
            "watchlist": watchlist_check,
        },
        "insufficient_evidence": insufficient_evidence,
        "risk_score": risk_score,
        "risk_tier": risk_tier,
        "risk_explanation": risk_explanation,
        "processing_time": processing_time,
        "online": online,
        "ela_image_b64": tamper_result.get("ela_image_b64", ""),
        "suspicious_region": tamper_result.get("suspicious_region"),
    }
