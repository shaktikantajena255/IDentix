"""
IDentix Tamper Check — Combined ELA + ML Random Forest.

Exports:
    run_tamper_check(image_path) -> dict

Four-state logic:
    FAILED       — both ELA and ML agree: tampered
    INCONCLUSIVE — ELA and ML disagree
    PASSED       — both agree: genuine
    (ML unavailable) — falls back to ELA-only result; ml_status = "UNAVAILABLE"

The returned dict always carries both signals so the frontend can display:
    "Rule-Based (ELA): [ela_status]"
    "ML Model (Random Forest): [ml_probability]%"
"""
import os
import cv2
import numpy as np
import base64
import tempfile
import logging

from PIL import Image, ImageChops, ImageEnhance

import document_authenticity

logger = logging.getLogger(__name__)


# ── Internal ELA implementation ───────────────────────────────────────────────

def _run_ela_internal(image_path: str) -> dict:
    """
    ELA-only analysis. Returns the original run_ela dict shape.
    Kept internal — external callers should use run_tamper_check().
    """
    try:
        img = Image.open(image_path).convert('RGB')

        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            tmp_path = tmp.name

        img.save(tmp_path, 'JPEG', quality=90)
        tmp_img = Image.open(tmp_path)

        ela_img = ImageChops.difference(img, tmp_img)

        extrema = ela_img.getextrema()
        max_diff = max([ex[1] for ex in extrema])

        if max_diff == 0:
            max_diff = 1

        scale = 255.0 / max_diff
        ela_img = ImageEnhance.Brightness(ela_img).enhance(scale)

        ela_cv = np.array(ela_img)
        ela_cv = cv2.cvtColor(ela_cv, cv2.COLOR_RGB2GRAY)

        _, thresh = cv2.threshold(ela_cv, int(15.0 * 255 / 10), 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        suspicious = False
        max_ela_value = np.max(ela_cv)
        suspicious_region = None

        # Thresholds:
        # < 30   : normal JPEG recompression noise — not suspicious
        # 30-45  : marginal — could be authentic high-frequency content or mild edit
        # > 45   : elevated — consistent with localized recompression manipulation
        #
        # NOTE: ELA is forensic evidence, not proof. Authentic documents
        # with high-frequency printing (holograms, microprint) may show
        # elevated ELA values. Results are labelled accordingly.
        SUSPICIOUS_THRESHOLD = 45.0
        MARGINAL_THRESHOLD = 30.0

        if max_ela_value > SUSPICIOUS_THRESHOLD:
            suspicious = True

        if contours:
            largest_contour = max(contours, key=cv2.contourArea)
            x, y, w, h = cv2.boundingRect(largest_contour)
            suspicious_region = {"x": x, "y": y, "w": w, "h": h}

        os.remove(tmp_path)

        _, buffer = cv2.imencode('.png', ela_cv)
        ela_b64 = base64.b64encode(buffer).decode('utf-8')

        if suspicious:
            result_status = "FAILED"
            result_detail = (
                f"ELA detected elevated recompression anomaly (max ELA value: {max_ela_value:.1f}). "
                "Suspicious region identified. Forensic signal: Tampered-like."
            )
        elif max_ela_value > MARGINAL_THRESHOLD:
            result_status = "INCONCLUSIVE"
            result_detail = (
                f"ELA shows marginal anomaly (max ELA value: {max_ela_value:.1f}). "
                "May reflect high-frequency authentic content (holograms, microprint) or mild manipulation. "
                "Forensic signal: Inconclusive."
            )
        else:
            result_status = "PASSED"
            result_detail = (
                f"ELA shows normal recompression noise pattern (max ELA value: {max_ela_value:.1f}). "
                "No elevated manipulation evidence detected."
            )

        return {
            "status": result_status,
            "suspicious": suspicious,
            "max_ela_value": float(max_ela_value),
            "suspicious_region": suspicious_region,
            "ela_image_b64": ela_b64,
            "detail": result_detail,
        }

    except Exception as e:
        logger.error("ELA failed: %s", e)
        return {
            "status": "INCONCLUSIVE",
            "suspicious": False,
            "max_ela_value": 0.0,
            "suspicious_region": None,
            "ela_image_b64": "",
            "detail": "Error during ELA analysis",
        }


# ── Public API ────────────────────────────────────────────────────────────────

def run_tamper_check(image_path: str) -> dict:
    """
    Combined tamper check: ELA (rule-based) + ML Random Forest.

    Four-state decision logic:
        FAILED       — ELA=FAILED  AND  ML=TAMPERED   (both agree tampered)
        INCONCLUSIVE — ELA and ML disagree on any combination
        PASSED       — ELA=PASSED  AND  ML=GENUINE    (both agree genuine)
        ML unavailable (pkl missing / inference error)
                     — overall result falls back to ELA-only; ml_status=UNAVAILABLE

    Returned dict always includes both signal details:
        status            — overall four-state result
        detail            — human-readable combined explanation
        ela_status        — ELA sub-result: PASSED / INCONCLUSIVE / FAILED
        ela_detail        — ELA explanation text
        ela_max_value     — raw max ELA pixel value
        ml_status         — "TAMPERED" | "GENUINE" | "UNAVAILABLE"
        ml_probability    — float 0.0-100.0 (tamper %) or None if unavailable
        ml_label          — "TAMPERED" | "GENUINE" | None
        ela_image_b64     — base64 ELA heatmap PNG (for frontend display)
        suspicious_region — bounding box dict or None
        max_ela_value     — alias of ela_max_value (keeps pipeline.py compat)
    """
    ela = _run_ela_internal(image_path)
    ml = document_authenticity.predict_tampering(image_path)

    ela_status = ela["status"]
    ela_passed = ela_status == "PASSED"
    ela_failed = ela_status == "FAILED"

    # ── ML unavailable — ELA-only fallback ───────────────────────────────────
    if ml is None:
        return {
            "status":          ela_status,
            "detail":          ela["detail"] + " [ML model unavailable — ELA-only result]",
            "ela_status":      ela_status,
            "ela_detail":      ela["detail"],
            "ela_max_value":   ela["max_ela_value"],
            "ml_status":       "UNAVAILABLE",
            "ml_probability":  None,
            "ml_label":        None,
            "ela_image_b64":   ela["ela_image_b64"],
            "suspicious_region": ela["suspicious_region"],
            "max_ela_value":   ela["max_ela_value"],   # pipeline compat alias
        }

    ml_tampered  = ml["tampered"]
    ml_prob_pct  = round(ml["probability"] * 100, 1)
    ml_label     = ml["label"]

    # ── Four-state decision ───────────────────────────────────────────────────
    if ela_failed and ml_tampered:
        # Both agree: tampered
        status = "FAILED"
        detail = (
            f"Both ELA and ML model agree: document appears tampered. "
            f"ELA max={ela['max_ela_value']:.1f}, "
            f"ML tamper probability={ml_prob_pct}%."
        )

    elif ela_passed and not ml_tampered:
        # Both agree: genuine
        status = "PASSED"
        detail = (
            f"Both ELA and ML model agree: document appears genuine. "
            f"ELA max={ela['max_ela_value']:.1f}, "
            f"ML tamper probability={ml_prob_pct}%."
        )

    else:
        # Any mismatch → INCONCLUSIVE
        status = "INCONCLUSIVE"
        detail = (
            f"ELA and ML model disagree. "
            f"ELA result: {ela_status} (max={ela['max_ela_value']:.1f}), "
            f"ML result: {ml_label} ({ml_prob_pct}% tamper probability)."
        )

    return {
        "status":          status,
        "detail":          detail,
        "ela_status":      ela_status,
        "ela_detail":      ela["detail"],
        "ela_max_value":   ela["max_ela_value"],
        "ml_status":       ml_label,          # "TAMPERED" or "GENUINE"
        "ml_probability":  ml_prob_pct,
        "ml_label":        ml_label,
        "ela_image_b64":   ela["ela_image_b64"],
        "suspicious_region": ela["suspicious_region"],
        "max_ela_value":   ela["max_ela_value"],   # pipeline compat alias
    }


# ── Legacy alias — kept so any direct callers of run_ela() don't break ───────
def run_ela(image_path: str) -> dict:
    """
    Backwards-compatible alias for run_tamper_check().
    pipeline.py is updated to call run_tamper_check() directly,
    but this alias ensures nothing else breaks.
    """
    return run_tamper_check(image_path)
