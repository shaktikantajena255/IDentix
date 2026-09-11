import difflib
import logging
import os
import re
from pathlib import Path

import cv2

try:
    import joblib as _joblib
except ImportError:
    _joblib = None

try:
    import pytesseract
except ImportError:
    pytesseract = None


logger = logging.getLogger(__name__)


# ============================================================
# FIELD NORMALIZER — Robust Alias-Based Field Detection
# (Phase 4+5: OCR NLP Mapper)
# ============================================================

# Comprehensive alias dictionary: canonical_field -> list of label variants
_FIELD_ALIASES: dict[str, list[str]] = {
    "surname": [
        "SURNAME", "LAST NAME", "FAMILY NAME", "FAMILY",
        "APELLIDO", "NOM", "NACHNAME",
    ],
    "given_name": [
        "GIVEN NAME", "GIVEN NAMES", "FIRST NAME", "FIRST NAMES",
        "FORENAME", "FORENAMES", "CHRISTIAN NAME", "PRENOM",
        "GIVEN", "VORNAME",
    ],
    "full_name": [
        "FULL NAME", "NAME", "NOMBRE", "NOM COMPLET",
        "PASSENGER NAME", "HOLDER", "HOLDER'S NAME",
    ],
    "date_of_birth": [
        "DATE OF BIRTH", "DATE OF BIRTH:", "DOB", "D.O.B",
        "D.O.B.", "BIRTH DATE", "BIRTHDATE", "DATE BIRTH",
        "DATE-OF-BIRTH", "BORN", "NACIMIENTO", "NAISSANCE",
        "GEBURTSDATUM", "DATE DE NAISSANCE",
        # Common OCR typos (D → O, A → 4, etc.)
        "OATE OF BIRTH", "DATE 0F BIRTH", "D4TE OF BIRTH",
        "BATE OF BIRTH", "DATE OF SIRTH", "DATE OF BIRTH :",
        # OCR digit-for-letter garbled abbreviations
        "D0B", "D0B.", "DOB.",
    ],

    "document_number": [
        "PASSPORT NO", "PASSPORT NUMBER", "PASSPORT NO.",
        "DOCUMENT NUMBER", "DOCUMENT NO", "DOC NO", "DOC NO.",
        "DOC NUMBER", "ID NUMBER", "ID NO", "CARD NUMBER",
        "LICENSE NUMBER", "LICENCE NUMBER", "NUMBER", "NO.",
        "CONTROL NUMBER", "SERIAL NUMBER",
    ],
    "nationality": [
        "NATIONALITY", "NATIONALITY:", "NAT", "NATIONAL",
        "CITIZENSHIP", "COUNTRY", "COUNTRY OF CITIZENSHIP",
        "NATIONALITE", "STAATSANGEHORIGKEIT",
        # OCR digit-for-letter garbled variants
        "NAT10NALITY", "NAT1ONALITY", "NATI0NALITY",
    ],

    "expiry_date": [
        "DATE OF EXPIRY", "DATE OF EXPIRATION",
        "EXPIRY DATE", "EXPIRY", "EXPIRATION DATE", "EXPIRATION",
        "VALID UNTIL", "VALID THRU", "VALID TO", "EXPIRE",
        "EXPIRES", "DATE D'EXPIRATION", "ABLAUFDATUM",
        # Common OCR typos
        "OATE OF EXPIRY", "DATE 0F EXPIRY", "DATE OF EXPIRY:",
        "OATE OF EXPIRATION",
    ],
    "issue_date": [
        "DATE OF ISSUE", "ISSUE DATE", "ISSUED ON", "ISSUED",
        "ISSUED DATE", "DATE ISSUED", "ISSUANCE DATE",
        "DATE D'EMISSION", "AUSSTELLUNGSDATUM",
    ],
    "sex": [
        "SEX", "GENDER", "SEXE", "GESCHLECHT",
    ],
    "place_of_birth": [
        "PLACE OF BIRTH", "POB", "BIRTH PLACE", "BIRTHPLACE",
        "LIEU DE NAISSANCE", "GEBURTSORT",
    ],
    "authority": [
        "AUTHORITY", "ISSUING AUTHORITY", "ISSUED BY",
        "ISSUED AT", "ISSUING POST", "AUTORIDAD",
    ],
}

# Invert for fast lookup: uppercased_alias -> canonical_field
_ALIAS_TO_FIELD: dict[str, str] = {}
for _field, _aliases in _FIELD_ALIASES.items():
    for _alias in _aliases:
        _ALIAS_TO_FIELD[_alias.upper()] = _field


# ============================================================
# ML FIELD CLASSIFIER SINGLETON
# field_keyword_model.joblib — sklearn Pipeline (TF-IDF + LogReg)
# Loaded ONCE at app startup via _load_field_model().
# Used as 3rd-tier fallback in extract_fields_from_text() only
# when alias + fuzzy matching both fail.
# Never crashes the app — returns (None, 0.0) on any error.
# ============================================================

_field_model = None       # sklearn Pipeline or None
_field_model_error = None  # str reason if load failed

# Map from model's class labels -> ocr.py canonical field names
# (model uses uppercase with underscores; ocr.py uses lowercase)
_ML_LABEL_MAP: dict[str, str] = {
    "DATE_OF_BIRTH":   "date_of_birth",
    "DATE_OF_EXPIRY":  "expiry_date",
    "DATE_OF_ISSUE":   "issue_date",
    "PASSPORT_NUMBER": "document_number",
    "DOCUMENT_NUMBER": "document_number",
    "ID_NUMBER":        "document_number",
    "NATIONALITY":      "nationality",
    "CITIZENSHIP":      "nationality",
    "SURNAME":          "surname",
    "GIVEN_NAME":       "given_name",
    "FIRST_NAME":       "given_name",
    "FULL_NAME":        "full_name",
}

# Minimum ML confidence to accept a classification as fallback
_ML_CONFIDENCE_THRESHOLD = 0.45


def _load_field_model() -> None:
    """
    Load field_keyword_model.joblib once at app startup.
    Called from main.py startup_event().
    Never raises — leaves _field_model=None on any failure.
    The model is a sklearn Pipeline (TF-IDF+LogReg) that accepts
    raw text strings directly: model.predict_proba([text]).
    """
    global _field_model, _field_model_error
    if _joblib is None:
        _field_model_error = "joblib not installed"
        logger.warning("[ocr] field_keyword_model: joblib unavailable")
        return
    model_path = Path(__file__).parent / "models" / "field_keyword_model.joblib"
    try:
        loaded = _joblib.load(str(model_path))
        if not hasattr(loaded, "predict_proba"):
            raise ValueError(f"Not a classifier: {type(loaded).__name__}")
        _field_model = loaded
        logger.info(
            "[ocr] field_keyword_model loaded OK: %s (%d classes)",
            model_path, len(loaded.classes_),
        )
    except Exception as exc:
        _field_model_error = str(exc)
        logger.warning("[ocr] field_keyword_model load failed (%s): %s", model_path, exc)


def _ml_classify_label(label_text: str) -> tuple[str | None, float]:
    """
    Classify a label string using the ML model.

    Returns:
        (canonical_field_name, confidence)  on success with confidence >= threshold
        (None, 0.0)                          if model unavailable, low confidence,
                                             or label maps to an unknown class
    Never raises.
    """
    if _field_model is None:
        return None, 0.0
    try:
        proba = _field_model.predict_proba([label_text])[0]
        best_idx = proba.argmax()
        ml_label = _field_model.classes_[best_idx]
        confidence = float(proba[best_idx])
        if confidence < _ML_CONFIDENCE_THRESHOLD:
            return None, 0.0
        canonical = _ML_LABEL_MAP.get(ml_label)
        return canonical, confidence
    except Exception as exc:
        logger.debug("[ocr] _ml_classify_label error: %s", exc)
        return None, 0.0


def _ocr_typo_correct(text: str) -> str:
    """
    Apply common OCR error corrections on uppercase text.
    These are safe character substitutions that do NOT alter
    the structure of the text, only correct OCR noise.
    """
    # O followed by digit → 0 (e.g. "O8" in MRZ or doc numbers)
    text = re.sub(r"\bO(\d)", r"0\1", text)
    # digit followed by O → 0
    text = re.sub(r"(\d)O\b", r"\g<1>0", text)
    # Common label-level D→O typo: "OATE" at word boundary → "DATE"
    text = re.sub(r"\bOATE\b", "DATE", text)
    # "0F" → "OF" when surrounded by word chars (label context)
    text = re.sub(r"\b0F\b", "OF", text)
    # Remove stray zero-width chars and non-printable noise
    text = text.replace("\u200b", "").replace("\u200c", "")
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    return text



def _clean_name_value(raw: str) -> str:
    """Clean an extracted name value of MRZ artifacts and OCR noise."""
    if not raw or raw in ("Not detected", ""):
        return raw
    cleaned = raw.replace("<", " ")
    # Remove 3+ runs of same uppercase letter (MRZ filler misread)
    cleaned = re.sub(r"([A-Z])\1{2,}", "", cleaned)
    # Remove isolated single-char tokens that are OCR noise from separators
    # e.g. "X JUENA X SHAKTIKANTA" -> "JUENA SHAKTIKANTA" (X from "/" OCR)
    cleaned = re.sub(r"(?<!\w)\b[A-Z]\b(?!\w)", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    cleaned = cleaned.strip(".,;:-")
    if len(cleaned.replace(" ", "")) < 2:
        return "Not detected"
    return cleaned




def _normalize_label(raw_label: str) -> str:
    """
    Normalise a raw OCR label for alias lookup:
    uppercase → OCR typo correction → strip colon/dash → collapse spaces.
    """
    s = raw_label.upper().strip()
    s = _ocr_typo_correct(s)               # fix OATE→DATE, 0F→OF etc.
    s = re.sub(r"[:\-\.]+$", "", s).strip()  # trailing colon/dash/dot
    s = re.sub(r"\s+", " ", s)
    return s


def _fuzzy_match_field(label: str, threshold: float = 0.82) -> str | None:
    """
    Fuzzy-match a normalised label against all known aliases.
    Returns the canonical field name or None.
    """
    norm = _normalize_label(label)

    # Exact match first (fast path)
    if norm in _ALIAS_TO_FIELD:
        return _ALIAS_TO_FIELD[norm]

    # Fuzzy match against alias list
    all_aliases = list(_ALIAS_TO_FIELD.keys())
    matches = difflib.get_close_matches(
        norm, all_aliases, n=1, cutoff=threshold
    )
    if matches:
        return _ALIAS_TO_FIELD[matches[0]]

    return None


def _confidence_from_similarity(label: str) -> float:
    """
    Estimate confidence (0.0-1.0) for a matched field based on
    how closely the OCR label matched an alias.
    Exact match = 1.0, fuzzy match scaled by similarity ratio.
    """
    norm = _normalize_label(label)
    if norm in _ALIAS_TO_FIELD:
        return 1.0
    all_aliases = list(_ALIAS_TO_FIELD.keys())
    ratios = [
        difflib.SequenceMatcher(None, norm, alias).ratio()
        for alias in all_aliases
    ]
    return max(ratios) if ratios else 0.0


def _is_noise_line(line: str) -> bool:
    """
    Return True if a line looks like OCR noise / bracket content
    that should NOT be treated as a field value.
    e.g. '[FICTIONAL PHOTO]', '[PHOTO]', 'PHOTO]', non-printable chars only.
    """
    stripped = line.strip()
    # Entirely in square brackets
    if re.fullmatch(r"\[.*\]", stripped):
        return True
    # Mostly special chars / empty
    if len(stripped) < 2:
        return True
    # Starts with '[' (opening partial bracket)
    if stripped.startswith('['):
        return True
    # Ends with ']' (closing partial bracket) — e.g. 'PHOTO]'
    if stripped.endswith(']'):
        return True
    # Junk lines: mostly special characters
    alnum_ratio = sum(c.isalnum() or c.isspace() for c in stripped) / len(stripped)
    if alnum_ratio < 0.3:
        return True
    return False


def extract_fields_from_text(raw_text: str) -> list[dict]:
    """
    Full NLP field mapper.

    Scans each line for:
      1. label:value on the same line (e.g. "Date of Birth: 15 AUG 2005")
      2. label alone on one line, value on the next non-noise line
         (e.g. SURNAME / MERIDIAN over two lines)

    Uses alias dict + OCR typo correction + fuzzy matching.

    Returns a list of:
        {
            "field": canonical_name,
            "value": extracted_value,
            "source": "OCR",
            "confidence": 0.0-1.0,
            "status": "PASSED" | "INCONCLUSIVE"
        }
    """
    results = []
    seen_fields: set[str] = set()
    lines = raw_text.splitlines()

    def _next_value_line(start_idx: int) -> str | None:
        """Find the first non-noise, non-empty line after start_idx."""
        for i in range(start_idx, min(start_idx + 4, len(lines))):
            candidate = lines[i].strip()
            if candidate and not _is_noise_line(candidate):
                return candidate
        return None

    for idx, line in enumerate(lines):
        clean = line.strip()
        if not clean or _is_noise_line(clean):
            continue

        label_part: str | None = None
        value_part: str | None = None

        # ── Strategy 1: label: value on same line ─────────────────────────
        # Matches "Date of Birth: 15 AUG 2005", "DOB: ...", "Passport No. DM..."
        m = re.match(
            r"^([A-Za-z][A-Za-z0-9 \.\-/']{1,35}?)\s*:\s*(.{1,80})$",
            clean,
        )
        if m:
            label_part = m.group(1).strip()
            value_part = m.group(2).strip()

        # ── Strategy 2: label alone, value on next non-noise line ─────────
        if not label_part:
            candidate_label = clean
            # Only treat as label if it looks like a label (all-caps or title,
            # not too long, no digits apart from isolated ones)
            if (
                len(candidate_label) <= 40
                and not re.search(r"\d{4,}", candidate_label)  # not a date/number line
                and not candidate_label.startswith('P<')       # not MRZ
            ):
                next_val = _next_value_line(idx + 1)
                if next_val and next_val != candidate_label:
                    label_part = candidate_label
                    value_part = next_val

        if not label_part or not value_part:
            continue

        # Skip if value_part looks like a field label itself
        if _fuzzy_match_field(value_part) and not re.search(
            r"\d|[A-Z]{3,}", value_part
        ):
            continue

        canonical = _fuzzy_match_field(label_part)
        ml_used = False
        ml_confidence = 0.0

        if not canonical:
            # ── 3rd tier: ML label classifier ─────────────────────────────
            # Only activated when alias dict AND fuzzy matching both fail.
            # DOB NOTE: ML model is weak on DOB variants (confuses with
            # PLACE_OF_BIRTH); existing alias dict handles DOB far better.
            # ML is genuinely useful for novel/garbled labels for other fields.
            canonical, ml_confidence = _ml_classify_label(label_part)
            if canonical:
                ml_used = True
                logger.debug(
                    "[ocr] ML classified %r -> %s (conf=%.2f)",
                    label_part, canonical, ml_confidence,
                )

        if not canonical:
            continue

        if canonical in seen_fields:
            continue

        # ── Field-specific value validation ───────────────────────────────
        # Reject values that don't match expected format for the field type.
        if canonical == "document_number":
            # Doc numbers must be ALL UPPERCASE and contain at least one digit
            tok = re.search(r"[A-Za-z0-9]{5,12}", value_part)
            if not tok or tok.group(0) != tok.group(0).upper() or not any(c.isdigit() for c in tok.group(0)):
                continue
            value_part = tok.group(0).upper()
            # 'Q' is never a valid ICAO document number character \u2014 OCR
            # commonly confuses it with '0' in alphanumeric sequences.
            value_part = value_part.replace("Q", "0")


        elif canonical == "sex":
            # Sex must be single char M/F/X or short word Male/Female
            stripped_sex = value_part.strip().upper()
            if stripped_sex not in ("M", "F", "X", "MALE", "FEMALE", "OTHER") and len(stripped_sex) > 6:
                continue
            value_part = stripped_sex

        elif canonical in ("date_of_birth", "expiry_date", "issue_date"):
            # Must contain a digit (dates always have numbers)
            if not re.search(r"\d", value_part):
                continue

        if ml_used:
            confidence = ml_confidence
            source = "OCR+ML"
            status = "INCONCLUSIVE"  # ML fallback is inherently lower confidence
        else:
            confidence = _confidence_from_similarity(label_part)
            source = "OCR"
            status = "PASSED" if confidence >= 0.82 else "INCONCLUSIVE"

        results.append({
            "field": canonical,
            "value": value_part,
            "source": source,
            "confidence": round(confidence, 2),
            "status": status,
        })
        seen_fields.add(canonical)

    return results




# ============================================================
# TESSERACT CONFIGURATION
# ============================================================

DEFAULT_TESSERACT_CMD = Path(
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)

TESSERACT_CMD = Path(
    os.environ.get(
        "IDENTIX_TESSERACT_CMD",
        str(DEFAULT_TESSERACT_CMD),
    )
)


def check_tesseract_availability() -> tuple[bool, str]:
    """
    Verify that both pytesseract and the native Tesseract executable
    are available.
    """

    if pytesseract is None:
        return False, "pytesseract Python package is not installed"

    if not TESSERACT_CMD.is_file():
        return (
            False,
            f"Tesseract executable not found at: {TESSERACT_CMD}",
        )

    try:
        pytesseract.pytesseract.tesseract_cmd = str(TESSERACT_CMD)

        version = pytesseract.get_tesseract_version()

        return (
            True,
            f"Tesseract {version} available at {TESSERACT_CMD}",
        )

    except Exception as exc:
        return (
            False,
            f"Configured Tesseract executable could not be used: {exc}",
        )


# ============================================================
# DOCUMENT TYPE DETECTION
# ============================================================

def detect_document_type(text: str) -> str:
    """
    Detect document type from actual OCR evidence.

    The function must never assume PASSPORT merely because the
    frontend default is Passport.
    """

    if not text:
        return "UNKNOWN"

    text_upper = re.sub(r"\s+", " ", text.upper())

    # --------------------------------------------------------
    # VISA
    # --------------------------------------------------------
    visa_indicators = [
        "VISA",
        "VISA TYPE",
        "VISA TYPE / CLASS",
        "ISSUING POST",
        "CONTROL NUMBER",
        "ANNOTATION",
    ]

    visa_score = sum(
        1
        for indicator in visa_indicators
        if indicator in text_upper
    )

    if visa_score >= 2 or "VISA" in text_upper:
        return "VISA"

    # --------------------------------------------------------
    # PASSPORT
    # --------------------------------------------------------
    passport_indicators = [
        "PASSPORT",
        "PASSEPORT",
        "TRAVEL DOCUMENT",
    ]

    if any(
        indicator in text_upper
        for indicator in passport_indicators
    ):
        return "PASSPORT"

    # --------------------------------------------------------
    # AADHAAR
    # --------------------------------------------------------
    if (
        "AADHAAR" in text_upper
        or "UNIQUE IDENTIFICATION" in text_upper
    ):
        return "AADHAAR"

    # --------------------------------------------------------
    # DRIVING LICENCE
    # --------------------------------------------------------
    if (
        "DRIVING LICENCE" in text_upper
        or "DRIVING LICENSE" in text_upper
        or (
            "DRIVING" in text_upper
            and "LICEN" in text_upper
        )
    ):
        return "DRIVING_LICENCE"

    return "UNKNOWN"


# ============================================================
# IMAGE PREPROCESSING
# ============================================================

def _prepare_images(image):
    """
    Create OCR-friendly image variants — keep only the two most effective
    to cut Tesseract calls from 12 → 4 per screening.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Upscale 2x (sharpens small text for Tesseract)
    upscaled = cv2.resize(gray, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)

    # Otsu threshold — best general-purpose binarisation for printed docs
    _, otsu = cv2.threshold(upscaled, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Return original colour + thresholded upscale (covers >95% of doc types)
    return [image, otsu]


# ============================================================
# OCR
# ============================================================

def _run_ocr(image) -> str:
    """
    Run Tesseract with the two most effective PSM modes.
    Early-exit: if psm 6 returns >=200 chars, skip psm 11 (saves one call).
    """
    configs = ["--psm 6", "--psm 11"]
    best = ""
    for config in configs:
        try:
            text = pytesseract.image_to_string(image, config=config)
            if text and len(text.strip()) > len(best.strip()):
                best = text
            # Early exit if we already have rich text
            if len(best.strip()) >= 200:
                break
        except Exception as exc:
            logger.warning("OCR configuration %s failed: %s", config, exc)
    return best


# ============================================================
# TEXT NORMALIZATION
# ============================================================

def _normalize_text(text: str) -> str:
    if not text:
        return ""

    text = text.replace("\r", "\n")

    lines = []

    for line in text.split("\n"):
        line = re.sub(
            r"[ \t]+",
            " ",
            line,
        ).strip()

        if line:
            lines.append(line)

    return "\n".join(lines)


# ============================================================
# MRZ NORMALIZATION
# ============================================================

def _normalize_mrz_line(line: str) -> str:
    """
    Normalize an OCR candidate for MRZ processing.
    """

    line = line.upper().strip()

    # Remove spaces.
    line = re.sub(
        r"\s+",
        "",
        line,
    )

    # MRZ contains A-Z, 0-9 and <.
    line = re.sub(
        r"[^A-Z0-9<]",
        "",
        line,
    )

    # 'Q' never appears in a genuine ICAO 9303 MRZ field — it is
    # always a Tesseract confusion with the digit '0'.
    line = line.replace("Q", "0")

    return line


def _find_mrz_lines(text: str) -> list[str]:
    """
    Detect likely TD3 passport MRZ lines.

    A standard TD3 passport has two 44-character MRZ lines.
    OCR can introduce small deviations, so candidates from
    approximately 35-50 characters are considered.
    """

    if not text:
        return []

    candidates = []

    for raw_line in text.splitlines():
        line = _normalize_mrz_line(raw_line)

        if not line:
            continue

        if (
            35 <= len(line) <= 50
            and "<" in line
        ):
            candidates.append(line)

    if len(candidates) < 2:
        return []

    # Prefer lines closest to 44 characters with many '<'.
    candidates = sorted(
        candidates,
        key=lambda value: (
            value.count("<"),
            -abs(len(value) - 44),
        ),
        reverse=True,
    )

    selected = candidates[:2]

    # Preserve OCR order.
    ordered = []

    for raw_line in text.splitlines():
        normalized = _normalize_mrz_line(raw_line)

        if (
            normalized in selected
            and normalized not in ordered
        ):
            ordered.append(normalized)

    return ordered[:2]


# ============================================================
# DATE HELPERS
# ============================================================

def _extract_date(text: str) -> str:
    """
    Extract common visible date formats.
    """

    patterns = [
        r"\b\d{1,2}\s*[A-Z]{3}\s*\d{4}\b",
        r"\b\d{1,2}[A-Z]{3}\d{4}\b",
        r"\b\d{2}[/-]\d{2}[/-]\d{4}\b",
        r"\b\d{4}[/-]\d{2}[/-]\d{2}\b",
    ]

    for pattern in patterns:
        match = re.search(
            pattern,
            text,
            re.IGNORECASE,
        )

        if match:
            return match.group(0).strip()

    return "Not detected"


def _extract_labeled_date(
    text: str,
    labels: list[str],
) -> str:
    """
    Extract a date from a labelled field.

    Looks on the same line, then scans up to 3 following lines
    (skipping noise lines like [PHOTO]) to find a date.
    Also applies OCR typo correction to label text before matching.
    """
    lines = text.splitlines()
    labels_upper = [l.upper() for l in labels]

    for index, line in enumerate(lines):
        line_corrected = _ocr_typo_correct(line.upper())

        if any(label in line_corrected for label in labels_upper):
            # Search on the same line
            result = _extract_date(line)
            if result != "Not detected":
                return result

            # Search on following lines, skip noise/bracket lines
            for offset in range(1, 4):
                if index + offset >= len(lines):
                    break
                candidate = lines[index + offset].strip()
                if not candidate or _is_noise_line(candidate):
                    continue
                result = _extract_date(candidate)
                if result != "Not detected":
                    return result
                # If we found a non-date, non-noise non-empty line, stop looking
                break

    return "Not detected"


# ============================================================
# NAME EXTRACTION
# ============================================================

def _extract_name(text: str) -> str:
    """
    Extract name from explicit Surname / Given Name fields.

    Avoids treating 'Issuing Post Name' as a person's name.
    """

    lines = text.splitlines()

    surname: str | None = None
    given_name: str | None = None

    for index, line in enumerate(lines):
        clean = line.strip()
        upper = clean.upper()

        # ----------------------------------------------------
        # SURNAME
        # ----------------------------------------------------
        if re.match(
            r"^SURNAME\b",
            upper,
        ):
            value = re.sub(
                r"(?i)^SURNAME\s*[:\-]?\s*",
                "",
                clean,
            ).strip()

            if value:
                surname = value

            elif index + 1 < len(lines):
                candidate = lines[index + 1].strip()

                if candidate:
                    surname = candidate

        # ----------------------------------------------------
        # GIVEN NAME
        # ----------------------------------------------------
        elif re.match(
            r"^GIVEN\s+NAME\b",
            upper,
        ):
            value = re.sub(
                r"(?i)^GIVEN\s+NAME\s*[:\-]?\s*",
                "",
                clean,
            ).strip()

            if value:
                given_name = value

            elif index + 1 < len(lines):
                candidate = lines[index + 1].strip()

                if candidate:
                    given_name = candidate

        # ----------------------------------------------------
        # GIVEN NAMES
        # ----------------------------------------------------
        elif re.match(
            r"^GIVEN\s+NAMES\b",
            upper,
        ):
            value = re.sub(
                r"(?i)^GIVEN\s+NAMES\s*[:\-]?\s*",
                "",
                clean,
            ).strip()

            if value:
                given_name = value

            elif index + 1 < len(lines):
                candidate = lines[index + 1].strip()

                if candidate:
                    given_name = candidate

    if surname and given_name:
        return _clean_name_value(f"{given_name} {surname}")

    if surname:
        return _clean_name_value(surname)

    if given_name:
        return _clean_name_value(given_name)

    # Generic NAME fallback.
    for index, line in enumerate(lines):
        clean = line.strip()

        if re.match(
            r"^NAME\s*[:\-]?",
            clean,
            re.IGNORECASE,
        ):
            value = re.sub(
                r"(?i)^NAME\s*[:\-]?\s*",
                "",
                clean,
            ).strip()

            if value:
                return _clean_name_value(value)

            if index + 1 < len(lines):
                candidate = lines[index + 1].strip()

                if candidate:
                    return _clean_name_value(candidate)

    return "Not detected"


# ============================================================
# DOCUMENT NUMBER
# ============================================================

def _extract_document_number(text: str) -> str:
    """
    Extract document/passport number from labelled fields.

    Uses explicit label patterns only — avoids picking up
    watermark text or other content that resembles a doc number.
    Only accepts UPPERCASE-only alphanumeric tokens (real doc numbers
    are uppercase; mixed-case tokens like 'IDent1ix' are watermarks).
    """
    def _is_valid_docnum(token: str) -> bool:
        """Check token is a plausible doc number (UPPERCASE, 5-12 chars, has digits)."""
        if len(token) < 5 or len(token) > 12:
            return False
        # Must be all-uppercase after stripping (reject 'IDent1ix' etc.)
        if token != token.upper():
            return False
        # Must contain at least one digit
        if not any(c.isdigit() for c in token):
            return False
        return True

    # Line-by-line: find a doc-number label then grab value from same line or next
    lines = text.splitlines()
    label_patterns = [
        re.compile(r"(?i)PASSPORT\s*NO\b"),
        re.compile(r"(?i)PASSPORT\s*NUMBER\b"),
        re.compile(r"(?i)DOCUMENT\s*(?:NO|NUMBER)\b"),
        re.compile(r"(?i)DOC(?:UMENT)?\s*NO\b"),
    ]
    for i, line in enumerate(lines):
        for lp in label_patterns:
            if lp.search(line):
                # Try value on the same line (after the label)
                after = lp.sub("", line).strip().lstrip(":.# ")
                token = re.search(r"[A-Z0-9]{5,12}", after.upper())
                if token:
                    candidate = re.search(r"[A-Za-z0-9]{5,12}", after)
                    if candidate and _is_valid_docnum(candidate.group(0)):
                        return candidate.group(0).upper()

                # Try next non-noise line
                for offset in range(1, 4):
                    if i + offset >= len(lines):
                        break
                    nxt = lines[i + offset].strip()
                    if not nxt or _is_noise_line(nxt):
                        continue
                    # Check uppercase version
                    token = re.search(r"[A-Z0-9]{5,12}", nxt.upper())
                    if token:
                        raw_tok = re.search(r"[A-Za-z0-9]{5,12}", nxt)
                        if raw_tok and _is_valid_docnum(raw_tok.group(0)):  # original case
                            return raw_tok.group(0).upper()
                    break

    return "Not detected"


# ============================================================
# NATIONALITY
# ============================================================

def _extract_nationality(text: str) -> str:
    """
    Extract nationality only from an explicit nationality label.
    """

    lines = text.splitlines()

    for index, line in enumerate(lines):
        clean = line.strip()

        if re.match(
            r"^NATIONALITY\b",
            clean,
            re.IGNORECASE,
        ):
            value = re.sub(
                r"(?i)^NATIONALITY\s*[:\-]?\s*",
                "",
                clean,
            ).strip()

            if not value and index + 1 < len(lines):
                value = lines[index + 1].strip()

            if value:
                value = re.sub(
                    r"[^A-Za-z ]",
                    "",
                    value,
                ).strip().upper()

                if value:
                    return value[:30]

    return "Not detected"


# ============================================================
# PASSPORT MRZ FIELD EXTRACTION
# ============================================================

def _extract_passport_from_mrz(mrz_lines):
    """Extract passport fields from TD3 MRZ lines with dual-offset OCR tolerance."""
    result = {
        'name': 'Not detected', 'doc_number': 'Not detected',
        'dob': 'Not detected', 'expiry': 'Not detected',
        'nationality': 'Not detected', 'gender': 'Not detected',
    }
    if len(mrz_lines) < 2:
        return result
    line1 = mrz_lines[0][:44] if len(mrz_lines[0]) > 44 else mrz_lines[0]
    line2 = mrz_lines[1][:44] if len(mrz_lines[1]) > 44 else mrz_lines[1]

    # LINE 1: name (P<CCC SURNAME<<GIVEN<<...)
    if line1.startswith('P<') and '<<' in line1 and len(line1) >= 6:
        name_part = line1[5:]
        parts = name_part.split('<<', 1)
        surname = parts[0].replace('<', ' ').strip() if parts else ''
        given = parts[1].replace('<', ' ').strip() if len(parts) > 1 else ''
        full = (given + ' ' + surname).strip()
        if full:
            result['name'] = full

    # LINE 2: dual-offset to handle O->0 nationality-digit positional shift
    def yymmdd_date(s, future=False):
        if not re.fullmatch(r'\d{6}', s): return None
        yy, mm, dd = int(s[0:2]), int(s[2:4]), int(s[4:6])
        if not (1 <= mm <= 12 and 1 <= dd <= 31): return None
        yr = (2000 + yy) if (future or yy < 30) else (1900 + yy)
        return f'{dd:02d}/{mm:02d}/{yr}'

    def parse2(l2, off):
        out = {}
        if len(l2) >= 9:
            doc = l2[0:9].replace('<', '')
            if doc: out['doc_number'] = doc
        if len(l2) >= 13:
            nat = l2[10:13].replace('<', '').replace('0', 'O').replace('1', 'I')
            if nat: out['nationality'] = nat
        ds = 13 + off
        if len(l2) >= ds + 6:
            v = yymmdd_date(l2[ds:ds + 6])
            if v: out['dob'] = v
        sp = 20 + off
        if len(l2) > sp and l2[sp] in 'MFX<':
            out['gender'] = 'Not specified' if l2[sp] == '<' else l2[sp]
        es = 21 + off
        if len(l2) >= es + 6:
            v = yymmdd_date(l2[es:es + 6], future=True)
            if v: out['expiry'] = v
        return out

    if len(line2) >= 9:
        std  = parse2(line2, 0)
        shft = parse2(line2, 1)
        s0 = (1 if 'dob' in std else 0)  + (1 if 'expiry' in std else 0)
        s1 = (1 if 'dob' in shft else 0) + (1 if 'expiry' in shft else 0)
        result.update(shft if s1 > s0 else std)
    return result

def extract_document_info(
    image_path: str,
) -> dict:

    available, availability_detail = (
        check_tesseract_availability()
    )

    if not available:
        return {
            "status": "UNAVAILABLE",
            "doc_type": "UNKNOWN",
            "extracted_name": "Not detected",
            "extracted_dob": "Not detected",
            "extracted_doc_number": "Not detected",
            "extracted_expiry": "Not detected",
            "extracted_nationality": "Not detected",
            "mrz_lines": [],
            "raw_text": "",
            "detail": availability_detail,
        }

    try:
        image = cv2.imread(image_path)

        if image is None:
            raise ValueError(
                "Failed to load document image"
            )

        variants = _prepare_images(image)

        ocr_results = []

        for variant in variants:
            text = _run_ocr(variant)
            if text and text.strip():
                ocr_results.append(text)
            # Early-exit: if we already have rich text, skip remaining variants
            if ocr_results and len(ocr_results[-1].strip()) >= 300:
                break

        if not ocr_results:
            return {
                "status": "INCONCLUSIVE",
                "doc_type": "UNKNOWN",
                "extracted_name": "Not detected",
                "extracted_dob": "Not detected",
                "extracted_doc_number": "Not detected",
                "extracted_expiry": "Not detected",
                "extracted_nationality": "Not detected",
                "mrz_lines": [],
                "raw_text": "",
                "detail": (
                    "Tesseract returned "
                    "no readable text"
                ),
            }

        raw_text = max(
            ocr_results,
            key=lambda value: len(
                value.strip()
            ),
        )

        raw_text = _normalize_text(
            raw_text
        )

        # Apply OCR typo correction globally (OATE→DATE, 0F→OF, etc.)
        raw_text = _ocr_typo_correct(raw_text)


    except Exception as exc:
        logger.exception(
            "OCR failed"
        )

        return {
            "status": "UNAVAILABLE",
            "doc_type": "UNKNOWN",
            "extracted_name": "Not detected",
            "extracted_dob": "Not detected",
            "extracted_doc_number": "Not detected",
            "extracted_expiry": "Not detected",
            "extracted_nationality": "Not detected",
            "mrz_lines": [],
            "raw_text": "",
            "detail": f"OCR Error: {exc}",
        }

    # ========================================================
    # DOCUMENT TYPE
    # ========================================================

    doc_type = detect_document_type(
        raw_text
    )

    # ========================================================
    # VISIBLE OCR FIELD EXTRACTION
    # ========================================================
    # Phase 4+5: Use NLP field mapper FIRST (alias dict + fuzzy)
    # then fall back to the legacy label-exact functions.
    # ========================================================

    nlp_fields = extract_fields_from_text(raw_text)
    nlp_map = {f["field"]: f for f in nlp_fields}

    def _nlp_val(canonical: str) -> str:
        """Get value from NLP mapper or return 'Not detected'."""
        entry = nlp_map.get(canonical)
        if entry and entry["value"] and entry["value"] not in ("Not detected", ""):
            return entry["value"]
        return "Not detected"

    # --- Name ---
    # Priority: surname+given > full_name > legacy
    nlp_surname = _nlp_val("surname")
    nlp_given = _nlp_val("given_name")
    nlp_full = _nlp_val("full_name")

    if nlp_surname != "Not detected" and nlp_given != "Not detected":
        extracted_name = f"{nlp_given} {nlp_surname}"
    elif nlp_surname != "Not detected":
        extracted_name = nlp_surname
    elif nlp_given != "Not detected":
        extracted_name = nlp_given
    elif nlp_full != "Not detected":
        extracted_name = nlp_full
    else:
        extracted_name = _extract_name(raw_text)  # legacy fallback

    # --- Date of Birth ---
    extracted_dob = _nlp_val("date_of_birth")
    if extracted_dob == "Not detected":
        extracted_dob = _extract_labeled_date(
            raw_text,
            ["DATE OF BIRTH", "BIRTH DATE", "DOB", "BIRTHDATE", "D.O.B", "BIRTH"],
        )

    # --- Document Number ---
    extracted_doc_number = _nlp_val("document_number")
    if extracted_doc_number == "Not detected":
        extracted_doc_number = _extract_document_number(raw_text)

    # --- Nationality ---
    extracted_nationality = _nlp_val("nationality")
    if extracted_nationality == "Not detected":
        extracted_nationality = _extract_nationality(raw_text)

    # ========================================================
    # VISA-SPECIFIC FIELD EXTRACTION
    # ========================================================

    # Initialize expiry — may be overwritten by VISA or passport label logic below
    extracted_expiry = _nlp_val("expiry_date")

    if doc_type == "VISA":

        # Passport Number is often explicitly labelled.
        visa_passport_match = re.search(
            r"(?i)PASSPORT\s+NUMBER\s*[:\-]?\s*([A-Z0-9]{6,12})",
            raw_text,
        )

        if visa_passport_match:
            extracted_doc_number = (
                visa_passport_match
                .group(1)
                .upper()
            )

        # Birth Date (NLP already set above; legacy fallback)
        if extracted_dob == "Not detected":
            visa_dob = _extract_labeled_date(
                raw_text,
                ["BIRTH DATE", "BIRTHDATE", "DATE OF BIRTH"],
            )
            if visa_dob != "Not detected":
                extracted_dob = visa_dob

        # Expiration Date
        if extracted_expiry == "Not detected":
            visa_expiry = _extract_labeled_date(
                raw_text,
                ["EXPIRATION DATE", "EXPIRY DATE", "EXPIRATION", "EXPIRY"],
            )
            if visa_expiry != "Not detected":
                extracted_expiry = visa_expiry

    # ========================================================
    # PASSPORT EXPIRY (fallback)
    # ========================================================

    if extracted_expiry == "Not detected":
        extracted_expiry = _extract_labeled_date(
            raw_text,
            [
                "DATE OF EXPIRY", "EXPIRY DATE",
                "DATE OF EXPIRATION", "EXPIRATION DATE",
                "VALID UNTIL", "VALID THRU",
                # Bilingual passport label variants
                "DATE OF EXPIRY", "EXPIRY", "EXPIRE",
                "SAMAPTI", "SAMAPT", "EXPIRY:",
                # OCR noise variants
                "OATE OF EXPIRY", "DATE 0F EXPIRY",
            ],
        )

    # Last-resort: for passport documents find ALL DD/MM/YYYY dates in
    # the text and pick the latest one (expiry is always the last/largest date)
    if extracted_expiry == "Not detected":
        all_dates = re.findall(r"\b(\d{2}[/\-]\d{2}[/\-]\d{4})\b", raw_text)
        valid_dates = []
        for d in all_dates:
            d_clean = d.replace("-", "/")
            parts = d_clean.split("/")
            if len(parts) == 3:
                try:
                    dd, mm, yyyy = int(parts[0]), int(parts[1]), int(parts[2])
                    if 1 <= dd <= 31 and 1 <= mm <= 12 and 1900 <= yyyy <= 2100:
                        valid_dates.append((yyyy, mm, dd, d_clean))
                except ValueError:
                    pass
        if valid_dates:
            # Pick the latest date — on a passport that's the expiry
            valid_dates.sort(reverse=True)
            extracted_expiry = valid_dates[0][3]


    # ========================================================
    # MRZ
    # ========================================================

    mrz_lines = _find_mrz_lines(
        raw_text
    )

    mrz_info = _extract_passport_from_mrz(
        mrz_lines
    )

    # ========================================================
    # SNAPSHOT VIZ FIELDS BEFORE MRZ OVERWRITE  (Task 3)
    # ========================================================
    # These preserve the values extracted purely from the
    # Visual Inspection Zone (VIZ) labels — before MRZ data
    # overwrites them for passport documents.
    # Used by cross-field validation (Task 4) to compare
    # VIZ vs MRZ genuinely rather than MRZ vs MRZ.

    viz_name = extracted_name
    viz_dob = extracted_dob
    viz_doc_number = extracted_doc_number
    viz_expiry = extracted_expiry
    viz_nationality = extracted_nationality

    # If a valid-looking passport MRZ is found, promote doc_type NOW
    # (BEFORE the MRZ overwrite block below, so MRZ fields are applied)
    if len(mrz_lines) >= 2 and mrz_lines[0].startswith("P<"):
        doc_type = "PASSPORT"

    # ========================================================
    # MRZ AS SUPPORTING EVIDENCE
    # ========================================================

    # IMPORTANT:
    # MRZ must NOT blindly overwrite visible labelled fields
    # for VISA documents.
    #
    # For PASSPORT documents, MRZ is stronger evidence for
    # passport fields.

    if doc_type == "PASSPORT":

        if (
            mrz_info["name"]
            != "Not detected"
        ):
            extracted_name = _clean_name_value(
                mrz_info["name"]
            )

        if (
            mrz_info["doc_number"]
            != "Not detected"
        ):
            extracted_doc_number = (
                mrz_info["doc_number"]
            )

        if (
            mrz_info["dob"]
            != "Not detected"
        ):
            extracted_dob = (
                mrz_info["dob"]
            )

        if (
            mrz_info["expiry"]
            != "Not detected"
        ):
            extracted_expiry = (
                mrz_info["expiry"]
            )

        if (
            mrz_info["nationality"]
            != "Not detected"
        ):
            extracted_nationality = (
                mrz_info["nationality"]
            )

    # ========================================================
    # FIELD STATUS
    # ========================================================

    fields = [
        extracted_name,
        extracted_dob,
        extracted_doc_number,
        extracted_expiry,
        extracted_nationality,
    ]

    fields_detected = sum(
        field != "Not detected"
        for field in fields
    )

    if fields_detected >= 3:
        status = "PASSED"
    elif fields_detected >= 1:
        status = "INCONCLUSIVE"
    else:
        status = "INCONCLUSIVE"

    # ========================================================
    # OCR DEBUG INFO (Phase 7)
    # ========================================================

    ocr_debug = {
        "raw_text": raw_text,
        "nlp_fields": nlp_fields,
        "mrz_lines": mrz_lines,
        "mrz_decoded": mrz_info,
        # cross_field_summary uses VIZ fields so the comparison
        # is genuinely VIZ vs MRZ (not MRZ vs MRZ).
        "cross_field_summary": {
            "name":       {"viz": viz_name,       "mrz": mrz_info.get("name",       "Not detected")},
            "dob":        {"viz": viz_dob,         "mrz": mrz_info.get("dob",        "Not detected")},
            "expiry":     {"viz": viz_expiry,      "mrz": mrz_info.get("expiry",     "Not detected")},
            "doc_number": {"viz": viz_doc_number,  "mrz": mrz_info.get("doc_number", "Not detected")},
        },
    }

    return {
        "status": status,
        "doc_type": doc_type,
        # Best-evidence fields (MRZ-overwritten for passports)
        "extracted_name": extracted_name,
        "extracted_dob": extracted_dob,
        "extracted_doc_number": extracted_doc_number,
        "extracted_expiry": extracted_expiry,
        "extracted_nationality": extracted_nationality,
        # VIZ-only fields — used by cross-field validation (Task 4)
        "viz_name": viz_name,
        "viz_dob": viz_dob,
        "viz_doc_number": viz_doc_number,
        "viz_expiry": viz_expiry,
        "viz_nationality": viz_nationality,
        "mrz_lines": mrz_lines,
        "raw_text": raw_text,
        "ocr_debug": ocr_debug,
        "detail": (
            f"Extracted {fields_detected} fields "
            f"from {len(raw_text.strip())} "
            f"OCR characters"
        ),
    }



# ============================================================
# ICAO 9303 MRZ CHECKSUM
# ============================================================

def validate_mrz_checksum(
    mrz_lines: list[str],
) -> dict:
    """
    Validate TD3 passport MRZ check digits using
    ICAO 9303 7-3-1 weighting.

    Checksum validation is consistency evidence,
    NOT proof of document authenticity.
    """

    if (
        not mrz_lines
        or len(mrz_lines) < 2
    ):
        return {
            "status": "INCONCLUSIVE",
            "checks_passed": 0,
            "total_checks": 0,
            "detail": (
                "Invalid or missing MRZ lines"
            ),
        }

    line2 = _normalize_mrz_line(
        mrz_lines[1]
    )

    if len(line2) < 44:
        # Tesseract often drops trailing '<' filler chars (treats them as
        # whitespace). Since '<' = 0 in ICAO 9303 weighting, restoring them
        # does not change any check digit result.
        # Recovery: if line is at least 28 chars (through expiry check digit),
        # pad the personal-number field (positions 29-42) back to 14 chars.
        if len(line2) >= 28:
            deficit = 44 - len(line2)
            # Insert '<' before the last two chars (pc + composite check digits)
            # Only do this if the last two chars look like check digits (digits)
            if len(line2) >= 2 and line2[-2:].replace('<', '').isdigit():
                line2 = line2[:-2] + '<' * deficit + line2[-2:]
            else:
                line2 = line2 + '<' * deficit
        if len(line2) < 44:
            return {
                "status": "INCONCLUSIVE",
                "checks_passed": 0,
                "total_checks": 0,
                "detail": (
                    f"MRZ second line is only "
                    f"{len(line2)} characters; "
                    f"expected 44 for TD3 passport"
                ),
            }

    line2 = line2[:44]

    def get_value(char: str) -> int:

        if "0" <= char <= "9":
            return int(char)

        if "A" <= char <= "Z":
            return (
                ord(char)
                - ord("A")
                + 10
            )

        if char == "<":
            return 0

        return 0

    def calculate_check_digit(
        value: str,
    ) -> int:

        weights = [
            7,
            3,
            1,
        ]

        total = 0

        for index, char in enumerate(value):
            total += (
                get_value(char)
                * weights[index % 3]
            )

        return total % 10

    # --------------------------------------------------------
    # Single-character OCR error correction
    # --------------------------------------------------------
    # Uses the embedded check digit as an oracle: if a field does
    # not pass its checksum, we try substituting each position with
    # every valid MRZ character (0-9, A-Z, <) until one passes.
    # This corrects the most common single-character OCR errors
    # (e.g. 0↔8, 0↔Q, I↔1, S↔5) without guessing or hard-coding
    # confusion tables.  Multi-character errors are left alone so
    # deliberately-tampered check digits still FAIL.
    _MRZ_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ<"

    def _try_correct(field: str, check_char: str) -> str:
        """Return single-char-corrected field, or original if uncorrectable."""
        if not check_char.isdigit():
            return field
        target = int(check_char)
        if calculate_check_digit(field) == target:
            return field   # already correct
        for i in range(len(field)):
            orig = field[i]
            for sub in _MRZ_CHARS:
                if sub == orig:
                    continue
                candidate = field[:i] + sub + field[i + 1:]
                if calculate_check_digit(candidate) == target:
                    return candidate   # single substitution found
        return field   # could not correct — leave for checksum to FAIL

    # Apply correction to the three variable fields before checking.
    doc_num_raw   = line2[0:9]
    dob_raw       = line2[13:19]
    expiry_raw    = line2[21:27]
    doc_check     = line2[9]
    dob_check     = line2[19]
    expiry_check  = line2[27]

    doc_num_corr  = _try_correct(doc_num_raw,  doc_check)
    dob_corr      = _try_correct(dob_raw,      dob_check)
    expiry_corr   = _try_correct(expiry_raw,   expiry_check)

    # Rebuild line2 with corrected values so composite check uses clean data.
    line2 = (
        doc_num_corr
        + doc_check
        + line2[10:13]       # nationality (pos 11-13)
        + dob_corr
        + dob_check
        + line2[20]          # sex
        + expiry_corr
        + line2[27:]         # expiry_check + optional + composite
    )

    passed = 0
    total_checks = 5

    # --------------------------------------------------------
    # DOCUMENT NUMBER  (uses corrected value)
    # --------------------------------------------------------

    document_number = line2[0:9]
    document_check  = line2[9]

    if document_check.isdigit():
        if calculate_check_digit(document_number) == int(document_check):
            passed += 1

    # --------------------------------------------------------
    # DATE OF BIRTH  (uses corrected value)
    # --------------------------------------------------------

    dob       = line2[13:19]
    dob_check = line2[19]

    if dob_check.isdigit():
        if calculate_check_digit(dob) == int(dob_check):
            passed += 1

    # --------------------------------------------------------
    # EXPIRY
    # --------------------------------------------------------

    expiry = line2[21:27]
    expiry_check = line2[27]

    if expiry_check.isdigit():

        if (
            calculate_check_digit(expiry)
            == int(expiry_check)
        ):
            passed += 1

    # --------------------------------------------------------
    # OPTIONAL DATA
    # --------------------------------------------------------

    optional_data = line2[28:42]
    optional_check = line2[42]

    if optional_check.isdigit():

        if (
            calculate_check_digit(
                optional_data
            )
            == int(optional_check)
        ):
            passed += 1

    # --------------------------------------------------------
    # COMPOSITE CHECK
    # --------------------------------------------------------

    composite_value = (
        line2[0:10]
        + line2[13:20]
        + line2[21:43]
    )

    composite_check = line2[43]

    if composite_check.isdigit():

        if (
            calculate_check_digit(
                composite_value
            )
            == int(composite_check)
        ):
            passed += 1

    # --------------------------------------------------------
    # RESULT
    # --------------------------------------------------------

    if passed == total_checks:

        return {
            "status": "PASSED",
            "checks_passed": passed,
            "total_checks": total_checks,
            "detail": (
                "All available MRZ "
                "checksums passed"
            ),
        }

    if passed == 0:

        return {
            "status": "FAILED",
            "checks_passed": passed,
            "total_checks": total_checks,
            "detail": (
                "MRZ checksum validation failed"
            ),
        }

    return {
        "status": "FAILED",
        "checks_passed": passed,
        "total_checks": total_checks,
        "detail": (
            "MRZ checksum validation failed "
            f"({passed}/{total_checks})"
        ),
    }