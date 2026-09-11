import re
from datetime import datetime


def validate_date(value):
    patterns = [
        r"\b\d{2}[/-]\d{2}[/-]\d{4}\b",
        r"\b\d{2}\s+[A-Z]{3}\s+\d{4}\b",
        r"\b\d{2}\s+[A-Z]+\s+\d{4}\b",
    ]

    return any(re.search(pattern, value.upper()) for pattern in patterns)


def validate_passport_number(value):
    value = value.replace(" ", "").upper()

    # Common passport-like format:
    # 1-2 letters followed by digits
    return bool(re.fullmatch(r"[A-Z]{1,2}[0-9]{6,9}", value))


def validate_aadhaar_number(value):
    digits = re.sub(r"\D", "", value)
    return len(digits) == 12


def validate_phone(value):
    digits = re.sub(r"\D", "", value)

    if len(digits) == 10:
        return digits[0] in "6789"

    if len(digits) == 12 and digits.startswith("91"):
        return digits[2] in "6789"

    return False


def validate_email(value):
    pattern = r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"
    return bool(re.fullmatch(pattern, value.strip()))


def validate_postal_code(value):
    digits = re.sub(r"\D", "", value)
    return len(digits) == 6


def validate_name(value):
    # Allows names such as:
    # ABHINNA
    # ABHINNA KUMAR
    # JOHN DOE
    return bool(
        re.fullmatch(
            r"[A-Za-z]+(?:[ .'-][A-Za-z]+)*",
            value.strip()
        )
    )


def validate_value(field, value):

    if not value:
        return False, "EMPTY"

    field = field.upper()

    if field in {
        "DATE_OF_BIRTH",
        "DATE_OF_ISSUE",
        "DATE_OF_EXPIRY",
        "VISA_ISSUE_DATE",
        "VISA_EXPIRY_DATE",
        "ENTRY_DATE",
        "DATE_OF_ENTRY",
        "ARRIVAL_DATE",
        "DATE_OF_ARRIVAL",
        "DEPARTURE_DATE",
        "DATE_OF_DEPARTURE",
        "EXIT_DATE",
        "DATE_OF_EXIT",
    }:
        valid = validate_date(value)
        return valid, "DATE" if valid else "INVALID_DATE"

    if field in {
        "PASSPORT_NUMBER",
        "TRAVEL_DOCUMENT_NUMBER",
    }:
        valid = validate_passport_number(value)
        return valid, "PASSPORT_NUMBER" if valid else "INVALID_PASSPORT_NUMBER"

    if field == "AADHAAR_NUMBER":
        valid = validate_aadhaar_number(value)
        return valid, "AADHAAR_NUMBER" if valid else "INVALID_AADHAAR_NUMBER"

    if field in {"PHONE_NUMBER", "MOBILE_NUMBER"}:
        valid = validate_phone(value)
        return valid, "PHONE" if valid else "INVALID_PHONE"

    if field == "EMAIL":
        valid = validate_email(value)
        return valid, "EMAIL" if valid else "INVALID_EMAIL"

    if field == "POSTAL_CODE":
        valid = validate_postal_code(value)
        return valid, "POSTAL_CODE" if valid else "INVALID_POSTAL_CODE"

    if field in {
        "SURNAME",
        "GIVEN_NAME",
        "FIRST_NAME",
        "MIDDLE_NAME",
        "LAST_NAME",
        "FULL_NAME",
    }:
        valid = validate_name(value)
        return valid, "NAME" if valid else "INVALID_NAME"

    # Generic fields:
    # We don't reject them without a field-specific rule.
    return True, "NOT_VALIDATED"


if __name__ == "__main__":

    tests = [
        ("DATE_OF_BIRTH", "15 AUG 2004"),
        ("DATE_OF_BIRTH", "HELLO WORLD"),
        ("PASSPORT_NUMBER", "P1234567"),
        ("PASSPORT_NUMBER", "HELLO"),
        ("AADHAAR_NUMBER", "1234 5678 9012"),
        ("PHONE_NUMBER", "9876543210"),
        ("EMAIL", "test@example.com"),
        ("POSTAL_CODE", "751001"),
        ("GIVEN_NAME", "ABHINNA KUMAR"),
    ]

    print("\n--- VALIDATION TEST ---\n")

    for field, value in tests:
        valid, validation = validate_value(field, value)

        print(
            f"{field:25} | "
            f"{value:25} | "
            f"{validation:25} | "
            f"{'VALID' if valid else 'INVALID'}"
        )