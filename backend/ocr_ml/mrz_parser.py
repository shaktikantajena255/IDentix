import re
import json


VALID_NATIONALITIES = {
    "IND", "USA", "GBR", "CAN", "AUS", "DEU",
    "FRA", "ITA", "ESP", "JPN", "CHN", "ARE"
}


def clean_mrz(text):
    """
    Keep MRZ-compatible characters.
    Do not aggressively 'correct' OCR.
    """
    text = text.upper()

    # Common OCR symbols that may represent filler <
    replacements = {
        "£": "<",
        "‹": "<",
        "«": "<",
        "—": "<",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    text = re.sub(r"[^A-Z0-9<\n]", "", text)

    return text


def find_mrz_candidates(text):
    """
    Find long OCR lines that look like MRZ.
    """
    cleaned = clean_mrz(text)

    candidates = []

    for line in cleaned.splitlines():
        line = line.strip()

        if len(line) < 20:
            continue

        alnum = sum(c.isalnum() for c in line)
        filler = line.count("<")

        density = alnum / max(len(line), 1)

        if len(line) >= 25 and (filler >= 1 or density > 0.80):
            candidates.append(line)

    return candidates


def find_passport_candidate(lines):
    """
    Search for a passport-number-like sequence followed by
    MRZ check digit and nationality.

    Example:
        CZ6311T47<9IND
    """

    pattern = re.compile(
        r"([A-Z]{1,2}[A-Z0-9]{6,8})<([0-9])([A-Z]{3})"
    )

    candidates = []

    for line in lines:

        matches = pattern.finditer(line)

        for match in matches:

            passport_number = match.group(1)
            check_digit = match.group(2)
            nationality = match.group(3)

            candidates.append({
                "passport_number": passport_number,
                "check_digit": check_digit,
                "nationality": nationality,
                "nationality_valid_code":
                    nationality in VALID_NATIONALITIES,
                "raw_match": match.group(0)
            })

    return candidates


def passport_checksum(value):
    """
    ICAO MRZ checksum.
    """

    weights = [7, 3, 1]

    total = 0

    for i, char in enumerate(value):

        if char == "<":
            number = 0

        elif char.isdigit():
            number = int(char)

        elif "A" <= char <= "Z":
            number = ord(char) - ord("A") + 10

        else:
            number = 0

        total += number * weights[i % 3]

    return str(total % 10)


def analyze_passport_candidate(candidate):

    passport = candidate["passport_number"]
    expected = passport_checksum(passport)
    actual = candidate["check_digit"]

    return {
        "passport_number": passport,

        "checksum": {
            "expected": expected,
            "actual": actual,
            "valid": expected == actual
        },

        "nationality": candidate["nationality"],

        "nationality_valid_code":
            candidate["nationality_valid_code"],

        "raw_match": candidate["raw_match"]
    }


def analyze_mrz(text):

    lines = find_mrz_candidates(text)

    passport_candidates = find_passport_candidate(lines)

    result = {
        "success": False,
        "mrz_lines": lines,
        "passport_candidates": [],
        "evidence": {
            "passport_number_found": False,
            "checksum_failed": False,
            "invalid_nationality": False
        }
    }

    for candidate in passport_candidates:

        analysis = analyze_passport_candidate(candidate)

        result["passport_candidates"].append(analysis)

    if passport_candidates:

        result["success"] = True

        result["evidence"]["passport_number_found"] = True

        if any(
            not item["checksum"]["valid"]
            for item in result["passport_candidates"]
        ):
            result["evidence"]["checksum_failed"] = True

        if any(
            not item["nationality_valid_code"]
            for item in result["passport_candidates"]
        ):
            result["evidence"]["invalid_nationality"] = True

    return result


if __name__ == "__main__":

    print("Paste the OCR MRZ text.")
    print("Press ENTER twice when finished.\n")

    lines = []

    while True:

        line = input()

        if not line.strip():
            break

        lines.append(line)

    text = "\n".join(lines)

    result = analyze_mrz(text)

    print("\n========== MRZ EVIDENCE ==========\n")

    print(
        json.dumps(
            result,
            indent=4,
            ensure_ascii=False
        )
    )