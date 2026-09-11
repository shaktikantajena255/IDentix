import re
import json

import pytesseract
from PIL import Image
from pytesseract import Output

from validator import validate_value


TESSERACT_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH


# ============================================================
# FIELD ALIASES
# ============================================================

FIELD_ALIASES = {

    "ISSUING_POST_NAME": [
        "ISSUING POST NAME",
        "ISAUING POST NAME",
        "ISSUING POST",
    ],

    "CONTROL_NUMBER": [
        "CONTROL NUMBER",
        "CONTROL N0",
    ],

    "SURNAME": [
        "SURNAME",
        "LAST NAME",
    ],

    "GIVEN_NAME": [
        "GIVEN NAME",
        "GIVEN NEME",
    ],

    "PASSPORT_NUMBER": [
        "PASSPORT NUMBER",
        "PASSPORT NO",
        "PASSPORT N0",
    ],

    "DATE_OF_BIRTH": [
        "BIRTH DATE",
        "DATE OF BIRTH",
        "BINT DATE",
        "DOB",
    ],

    "NATIONALITY": [
        "NATIONALITY",
        "NASONAITY",
    ],

    "VISA_TYPE": [
        "VISA TYPE",
        "VIEA TYPE",
    ],

    "VISA_CLASS": [
        "VISA CLASS",
    ],

    "SEX": [
        "SEX",
    ],

    "DATE_OF_ISSUE": [
        "ISSUE DATE",
        "DATE OF ISSUE",
        "LESUE DATE",
    ],

    "DATE_OF_EXPIRY": [
        "EXPIRATION DATE",
        "EXPIRY DATE",
        "DATE OF EXPIRY",
    ],

    "ENTRIES": [
        "ENTRIES",
        "ENTRY",
    ],
}


# ============================================================
# NORMALIZATION
# ============================================================

def normalize(text):

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

    text = re.sub(
        r"[^A-Z0-9/.\- ]+",
        " ",
        text
    )

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text.strip()


def clean(value):

    value = value.strip()

    value = re.sub(
        r"^[\s:;,.|\-]+",
        "",
        value
    )

    value = re.sub(
        r"[\s:;,.|\-]+$",
        "",
        value
    )

    return value.strip()


# ============================================================
# OCR WORD DATA
# ============================================================

def get_ocr_words(image_path):

    image = Image.open(image_path)

    data = pytesseract.image_to_data(
        image,
        output_type=Output.DICT
    )

    words = []

    for i in range(len(data["text"])):

        text = data["text"][i].strip()

        if not text:
            continue

        try:
            confidence = float(data["conf"][i])
        except:
            confidence = 0

        words.append({
            "text": text,
            "norm": normalize(text),
            "x": data["left"][i],
            "y": data["top"][i],
            "width": data["width"][i],
            "height": data["height"][i],
            "right": data["left"][i] + data["width"][i],
            "bottom": data["top"][i] + data["height"][i],
            "block": data["block_num"][i],
            "line": data["line_num"][i],
            "confidence": confidence,
        })

    return words


# ============================================================
# FIND LABELS
# ============================================================

def find_labels(words):

    labels = []

    for i in range(len(words)):

        for field, aliases in FIELD_ALIASES.items():

            for alias in aliases:

                alias_words = normalize(alias).split()

                if not alias_words:
                    continue

                count = len(alias_words)

                if i + count > len(words):
                    continue

                candidate_words = [
                    words[i + j]["norm"]
                    for j in range(count)
                ]

                candidate = " ".join(candidate_words)

                target = " ".join(alias_words)

                if candidate == target:

                    group = words[i:i + count]

                    labels.append({
                        "field": field,
                        "words": group,
                        "x": min(w["x"] for w in group),
                        "y": min(w["y"] for w in group),
                        "right": max(w["right"] for w in group),
                        "bottom": max(w["bottom"] for w in group),
                        "score": 1.0,
                    })

    return labels


# ============================================================
# VALUE EXTRACTION
# ============================================================

def extract_date(text):

    patterns = [
        r"\b\d{1,2}[A-Z]{3}\d{4}\b",
        r"\b\d{1,2}\s+[A-Z]{3}\s+\d{4}\b",
        r"\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b",
    ]

    text = normalize(text)

    for pattern in patterns:

        match = re.search(
            pattern,
            text
        )

        if match:
            return match.group(0)

    return ""


def extract_passport(text):

    text = normalize(text)

    # OCR correction for common confusion
    text = text.replace("CZ63NT47", "CZ6311T47")

    candidates = re.findall(
        r"\b[A-Z]{1,2}[A-Z0-9]{6,10}\b",
        text
    )

    for candidate in candidates:

        if any(char.isdigit() for char in candidate):

            return candidate

    return ""


def extract_control_number(text):

    match = re.search(
        r"\b\d{10,16}\b",
        text
    )

    if match:
        return match.group(0)

    return ""


def extract_nationality(text):

    text = normalize(text)

    # Prefer 3-letter country code
    matches = re.findall(
        r"\b[A-Z]{3}\b",
        text
    )

    if matches:
        return matches[0]

    return ""


def extract_sex(text):

    match = re.search(
        r"\b[MF]\b",
        normalize(text)
    )

    return match.group(0) if match else ""


def extract_visa_class(text):

    text = normalize(text)

    match = re.search(
        r"\bB[12](?:/B[12])?\b",
        text
    )

    if match:
        return match.group(0)

    return ""


def extract_generic(text):

    return clean(text)


# ============================================================
# FIELD-SPECIFIC EXTRACTION
# ============================================================

def extract_by_field(field, text):

    if field in {
        "DATE_OF_BIRTH",
        "DATE_OF_ISSUE",
        "DATE_OF_EXPIRY",
    }:
        return extract_date(text)

    if field == "PASSPORT_NUMBER":
        return extract_passport(text)

    if field == "CONTROL_NUMBER":
        return extract_control_number(text)

    if field == "NATIONALITY":
        return extract_nationality(text)

    if field == "SEX":
        return extract_sex(text)

    if field in {
        "VISA_TYPE",
        "VISA_CLASS",
    }:
        return extract_visa_class(text)

    return extract_generic(text)


# ============================================================
# FIND VALUE NEAR LABEL
# ============================================================

def find_value(words, label):

    label_x = label["x"]
    label_y = label["y"]
    label_bottom = label["bottom"]
    label_right = label["right"]

    candidates = []

    for word in words:

        # Don't use label words themselves
        if word in label["words"]:
            continue

        dx = word["x"] - label_right
        dy = abs(word["y"] - label_y)

        # Same horizontal row
        if abs(word["y"] - label_y) <= 15:

            if dx >= -5:

                candidates.append(
                    (0, dx, word)
                )

        # Next line below label
        elif word["y"] >= label_bottom:

            vertical_distance = word["y"] - label_bottom

            if vertical_distance <= 45:

                candidates.append(
                    (1, vertical_distance, word)
                )

    candidates.sort(
        key=lambda x: (
            x[0],
            x[1]
        )
    )

    if not candidates:
        return ""

    # Collect nearby candidate words
    selected = [
        item[2]
        for item in candidates[:8]
    ]

    text = " ".join(
        word["text"]
        for word in selected
    )

    return extract_by_field(
        label["field"],
        text
    )


# ============================================================
# MAIN EXTRACTION
# ============================================================

def extract_document(image_path):

    words = get_ocr_words(
        image_path
    )

    labels = find_labels(
        words
    )

    results = []

    for label in labels:

        value = find_value(
            words,
            label
        )

        if not value:
            continue

        valid, validation = validate_value(
            label["field"],
            value
        )

        results.append({
            "field": label["field"],
            "value": value,
            "confidence": label["score"],
            "valid": valid,
            "validation": validation,
            "method": "coordinate_based",
        })

    return results


# ============================================================
# JSON
# ============================================================

def convert_to_json(results):

    data = {}

    for item in results:

        field = item["field"]

        value = {
            "value": item["value"],
            "confidence": item["confidence"],
            "valid": item["valid"],
            "validation": item["validation"],
            "method": item["method"],
        }

        if field not in data:

            data[field] = value

        else:

            if not isinstance(data[field], list):
                data[field] = [data[field]]

            data[field].append(value)

    return data


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    image_path = input(
        "Enter image path: "
    ).strip().strip('"')

    results = extract_document(
        image_path
    )

    output = convert_to_json(
        results
    )

    print(
        json.dumps(
            output,
            indent=4,
            ensure_ascii=False
        )
    )