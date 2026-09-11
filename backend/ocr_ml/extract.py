import re
import json

from rapidfuzz import fuzz
from predict import KEYWORDS
from validator import validate_value


# ============================================================
# OCR NORMALIZATION
# ============================================================

def normalize_label(text):
    text = text.upper()

    replacements = {
        "0": "O",
        "1": "I",
        "|": "I",
        "’": "'",
        "‘": "'",
        "—": "-",
        "–": "-",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    text = re.sub(r"[^A-Z0-9/.\- ]+", " ", text)
    text = re.sub(r"\s+", " ", text)

    return text.strip()


def clean_value(value):
    value = value.strip()

    value = re.sub(
        r"^[\s:;,.\-|]+",
        "",
        value
    )

    value = re.sub(
        r"[\s:;,.\-|]+$",
        "",
        value
    )

    return value.strip()


# ============================================================
# FIELD ALIASES
# ============================================================

FIELD_ALIASES = {

    "SURNAME": [
        "SURNAME",
        "LAST NAME"
    ],

    "GIVEN_NAME": [
        "GIVEN NAME",
        "GIVEN NEME"
    ],

    "FULL_NAME": [
        "FULL NAME"
    ],

    "PASSPORT_NUMBER": [
        "PASSPORT NUMBER",
        "PASSPORT NO",
        "PASSPORT N0"
    ],

    "DATE_OF_BIRTH": [
        "DATE OF BIRTH",
        "BIRTH DATE",
        "BINT DATE",
        "DOB",
        "D.O.B"
    ],

    "NATIONALITY": [
        "NATIONALITY",
        "NASONAITY"
    ],

    "SEX": [
        "SEX"
    ],

    "VISA_TYPE": [
        "VISA TYPE",
        "VIEA TYPE"
    ],

    "VISA_CLASS": [
        "VISA CLASS",
        "CLASS"
    ],

    "CONTROL_NUMBER": [
        "CONTROL NUMBER",
        "CONTROL N0"
    ],

    "ISSUING_POST_NAME": [
        "ISSUING POST NAME",
        "ISAUING POST NAME",
        "ISSUING POST"
    ],

    "DATE_OF_ISSUE": [
        "DATE OF ISSUE",
        "ISSUE DATE",
        "LESUE DATE"
    ],

    "DATE_OF_EXPIRY": [
        "DATE OF EXPIRY",
        "EXPIRATION DATE",
        "EXPIRY DATE"
    ],

    "ENTRIES": [
        "ENTRIES",
        "ENTRY"
    ],

    "ANNOTATION": [
        "ANNOTATION"
    ]
}


# Add learned keyword variants
for field, variants in KEYWORDS.items():

    if field not in FIELD_ALIASES:
        FIELD_ALIASES[field] = []

    for variant in variants:

        if variant not in FIELD_ALIASES[field]:
            FIELD_ALIASES[field].append(variant)


# ============================================================
# FIND LABELS
# ============================================================

def find_labels(line):

    normalized = normalize_label(line)

    matches = []

    for field, aliases in FIELD_ALIASES.items():

        for alias in aliases:

            alias_normalized = normalize_label(alias)

            # Exact match
            position = normalized.find(alias_normalized)

            if position != -1:

                matches.append({
                    "field": field,
                    "start": position,
                    "end": position + len(alias_normalized),
                    "score": 100
                })

                continue

            # Fuzzy match
            words = normalized.split()
            alias_words = alias_normalized.split()

            if not alias_words:
                continue

            n = len(alias_words)

            for i in range(len(words) - n + 1):

                candidate = " ".join(
                    words[i:i + n]
                )

                score = fuzz.ratio(
                    candidate,
                    alias_normalized
                )

                if score >= 85:

                    start = normalized.find(candidate)

                    if start >= 0:

                        matches.append({
                            "field": field,
                            "start": start,
                            "end": start + len(candidate),
                            "score": score
                        })

    # Remove overlapping labels
    matches.sort(
        key=lambda x: (
            x["start"],
            -x["score"],
            -(x["end"] - x["start"])
        )
    )

    final = []

    for match in matches:

        overlap = False

        for existing in final:

            if not (
                match["end"] <= existing["start"]
                or match["start"] >= existing["end"]
            ):
                overlap = True
                break

        if not overlap:
            final.append(match)

    return final


# ============================================================
# FIELD-SPECIFIC VALUE EXTRACTION
# ============================================================

def extract_date(text):

    patterns = [
        r"\b\d{1,2}[A-Z]{3}\d{4}\b",
        r"\b\d{1,2}\s+[A-Z]{3}\s+\d{4}\b",
        r"\b\d{1,2}\s+[A-Z]+\s+\d{4}\b",
        r"\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b"
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text.upper()
        )

        if match:
            return match.group(0)

    return ""


def extract_passport_number(text):

    # Passport-like alphanumeric value
    pattern = r"\b[A-Z]{1,2}[0-9][A-Z0-9]{5,10}\b"

    match = re.search(
        pattern,
        text.upper()
    )

    if match:
        return match.group(0)

    # OCR may confuse I/l with 1
    pattern = r"\b[A-Z]{1,2}[A-Z0-9]{7,9}\b"

    candidates = re.findall(
        pattern,
        text.upper()
    )

    for candidate in candidates:

        if len(candidate) >= 7:
            return candidate

    return ""


def extract_control_number(text):

    # Prefer long numeric sequence
    match = re.search(
        r"\b\d{10,16}\b",
        text
    )

    if match:
        return match.group(0)

    return ""


def extract_nationality(text):

    # Common 3-letter nationality code
    match = re.search(
        r"\b[A-Z]{3}\b",
        text.upper()
    )

    if match:
        return match.group(0)

    # Full nationality word
    words = re.findall(
        r"\b[A-Z]{4,20}\b",
        text.upper()
    )

    if words:
        return words[-1]

    return ""


def extract_sex(text):

    match = re.search(
        r"\b[MF]\b",
        text.upper()
    )

    if match:
        return match.group(0)

    return ""


def extract_visa_class(text):

    match = re.search(
        r"\bB[12](?:/B[12])?\b",
        text.upper()
    )

    if match:
        return match.group(0)

    return ""


def extract_name(text):

    # Remove obvious non-name symbols
    text = re.sub(
        r"[^A-Z .'-]",
        " ",
        text.upper()
    )

    text = re.sub(
        r"\s+",
        " ",
        text
    ).strip()

    if not text:
        return ""

    # Don't accept obvious labels
    blocked = {
        "PASSPORT",
        "NUMBER",
        "DATE",
        "BIRTH",
        "NATIONALITY",
        "VISA",
        "TYPE",
        "CLASS",
        "SEX",
        "ENTRIES",
        "ISSUE",
        "EXPIRATION",
        "CONTROL"
    }

    words = text.split()

    words = [
        word for word in words
        if word not in blocked
    ]

    if not words:
        return ""

    return " ".join(words)


def extract_generic(text):

    return clean_value(text)


# ============================================================
# FIELD VALUE SELECTOR
# ============================================================

def extract_value_by_field(field, text):

    text = clean_value(text)

    if not text:
        return ""

    if field in {
        "DATE_OF_BIRTH",
        "DATE_OF_ISSUE",
        "DATE_OF_EXPIRY"
    }:
        return extract_date(text)

    if field == "PASSPORT_NUMBER":
        return extract_passport_number(text)

    if field == "CONTROL_NUMBER":
        return extract_control_number(text)

    if field == "NATIONALITY":
        return extract_nationality(text)

    if field == "SEX":
        return extract_sex(text)

    if field in {
        "VISA_TYPE",
        "VISA_CLASS"
    }:
        return extract_visa_class(text)

    if field in {
        "SURNAME",
        "GIVEN_NAME",
        "FULL_NAME"
    }:
        return extract_name(text)

    return extract_generic(text)


# ============================================================
# EXTRACT FIELDS
# ============================================================

def extract_fields(ocr_text):

    lines = [
        line.strip()
        for line in ocr_text.splitlines()
        if line.strip()
    ]

    results = []

    for line_index, line in enumerate(lines):

        labels = find_labels(line)

        if not labels:
            continue

        normalized_line = normalize_label(line)

        # ----------------------------------------------------
        # SAME-LINE EXTRACTION
        # ----------------------------------------------------

        for label_index, label in enumerate(labels):

            field = label["field"]

            start = label["end"]

            if label_index + 1 < len(labels):

                end = labels[
                    label_index + 1
                ]["start"]

            else:

                end = len(normalized_line)

            candidate = normalized_line[
                start:end
            ]

            candidate = clean_value(candidate)

            value = extract_value_by_field(
                field,
                candidate
            )

            # ------------------------------------------------
            # NEXT LINE FALLBACK
            # ------------------------------------------------

            if not value and line_index + 1 < len(lines):

                next_line = lines[
                    line_index + 1
                ]

                value = extract_value_by_field(
                    field,
                    next_line
                )

            # ------------------------------------------------
            # SEARCH NEXT LINE FOR SPECIFIC TYPE
            # ------------------------------------------------

            if not value and line_index + 1 < len(lines):

                next_line = lines[
                    line_index + 1
                ]

                # Date fields
                if field in {
                    "DATE_OF_BIRTH",
                    "DATE_OF_ISSUE",
                    "DATE_OF_EXPIRY"
                }:

                    value = extract_date(
                        next_line
                    )

                # Passport
                elif field == "PASSPORT_NUMBER":

                    value = extract_passport_number(
                        next_line
                    )

                # Control number
                elif field == "CONTROL_NUMBER":

                    value = extract_control_number(
                        next_line
                    )

                # Nationality
                elif field == "NATIONALITY":

                    value = extract_nationality(
                        next_line
                    )

                # Sex
                elif field == "SEX":

                    value = extract_sex(
                        next_line
                    )

                # Visa class/type
                elif field in {
                    "VISA_TYPE",
                    "VISA_CLASS"
                }:

                    value = extract_visa_class(
                        next_line
                    )

                # Names
                elif field in {
                    "SURNAME",
                    "GIVEN_NAME"
                }:

                    # Only use next line if it does not
                    # contain another recognizable field.
                    if not find_labels(next_line):

                        value = extract_name(
                            next_line
                        )

            # ------------------------------------------------
            # VALIDATION
            # ------------------------------------------------

            if value:

                valid, validation = validate_value(
                    field,
                    value
                )

                results.append({
                    "field": field,
                    "value": value,
                    "confidence": round(
                        label["score"] / 100,
                        3
                    ),
                    "valid": valid,
                    "validation": validation,
                    "method": "field_specific"
                })

    return results


# ============================================================
# JSON
# ============================================================

def convert_to_json(results):

    data = {}

    for item in results:

        field = item["field"]

        value_data = {
            "value": item["value"],
            "confidence": item["confidence"],
            "valid": item["valid"],
            "validation": item["validation"],
            "method": item["method"]
        }

        if field not in data:

            data[field] = value_data

        else:

            if not isinstance(data[field], list):
                data[field] = [data[field]]

            data[field].append(value_data)

    return data


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    with open(
        "ocr_output.txt",
        "r",
        encoding="utf-8"
    ) as file:

        ocr_text = file.read()

    results = extract_fields(
        ocr_text
    )

    json_data = convert_to_json(
        results
    )

    print("\n========== OCR TEXT ==========\n")
    print(ocr_text)

    print("\n========== STRUCTURED JSON ==========\n")

    print(
        json.dumps(
            json_data,
            indent=4,
            ensure_ascii=False
        )
    )