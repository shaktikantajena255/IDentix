import joblib
import re
from rapidfuzz import process, fuzz


MODEL_PATH = "../model/field_keyword_model.joblib"

model = joblib.load(MODEL_PATH)


# --------------------------------------------------
# Canonical keyword dictionary
# --------------------------------------------------

KEYWORDS = {
    "DATE_OF_BIRTH": [
        "dob",
        "d.o.b",
        "d o b",
        "date of birth",
        "birth date",
        "birthdate",
    ],

    "PLACE_OF_BIRTH": [
        "place of birth",
        "birth place",
        "birthplace",
    ],

    "NATIONALITY": [
        "nationality",
    ],

    "CITIZENSHIP": [
        "citizenship",
        "country of citizenship",
    ],

    "SURNAME": [
        "surname",
        "family name",
        "last name",
    ],

    "GIVEN_NAME": [
        "given name",
        "given names",
        "forename",
    ],

    "FIRST_NAME": [
        "first name",
        "firstname",
    ],

    "FULL_NAME": [
        "full name",
        "name",
    ],

    "PASSPORT_NUMBER": [
        "passport number",
        "passport no",
        "passport no.",
        "passport id",
    ],

    "DOCUMENT_NUMBER": [
        "document number",
        "document no",
        "document no.",
        "doc number",
    ],

    "ID_NUMBER": [
        "id number",
        "id no",
        "id no.",
    ],

    "DATE_OF_ISSUE": [
        "date of issue",
        "issue date",
        "issued on",
        "date issued",
    ],

    "DATE_OF_EXPIRY": [
        "date of expiry",
        "expiry date",
        "expiration date",
        "expires on",
        "valid until",
        "valid till",
    ],

    "ISSUING_AUTHORITY": [
        "issuing authority",
        "issuing office",
        "issued by",
        "authority",
    ],

    "VISA_NUMBER": [
        "visa number",
        "visa no",
        "visa no.",
        "visa id",
    ],

    "DRIVING_LICENSE_NUMBER": [
        "driving license number",
        "driving licence number",
        "driving license no",
        "driving licence no",
        "dl number",
        "dl no",
    ],

    "LICENSE_NUMBER": [
        "license number",
        "licence number",
        "license no",
        "licence no",
    ],

    "AADHAAR_NUMBER": [
        "aadhaar number",
        "aadhaar no",
        "aadhaar no.",
        "aadhaar id",
    ],

    "ADDRESS": [
        "address",
        "permanent address",
        "residential address",
        "current address",
        "present address",
        "mailing address",
    ],

    "POSTAL_CODE": [
        "postal code",
        "pin code",
        "pincode",
        "zip code",
        "zip",
    ],

    "MRZ": [
        "mrz",
        "machine readable zone",
        "mrz code",
        "mrz line",
    ],

    "BARCODE": [
        "barcode",
        "barcode number",
    ],

    "QR_CODE": [
        "qr code",
        "qr",
    ],
}


# --------------------------------------------------
# OCR normalization
# --------------------------------------------------

def normalize_ocr(text):
    text = str(text).strip().lower()

    # Common OCR errors
    text = text.replace("0", "o")
    text = text.replace("1", "i")

    # Normalize punctuation
    text = re.sub(r"[^\w\s.]", " ", text)

    # Multiple spaces
    text = re.sub(r"\s+", " ", text)

    return text.strip()


# --------------------------------------------------
# Exact / fuzzy keyword matching
# --------------------------------------------------

def keyword_match(text):

    normalized = normalize_ocr(text)

    best_label = None
    best_keyword = None
    best_score = 0

    for label, keywords in KEYWORDS.items():

        for keyword in keywords:

            keyword_normalized = normalize_ocr(keyword)

            score = fuzz.ratio(
                normalized,
                keyword_normalized
            )

            # Partial matching for longer phrases
            partial_score = fuzz.partial_ratio(
                normalized,
                keyword_normalized
            )

            score = max(score, partial_score)

            if score > best_score:
                best_score = score
                best_label = label
                best_keyword = keyword

    return {
        "label": best_label,
        "keyword": best_keyword,
        "score": best_score
    }


# --------------------------------------------------
# ML prediction
# --------------------------------------------------

def ml_prediction(text):

    probabilities = model.predict_proba([text])[0]

    best_index = probabilities.argmax()

    label = model.classes_[best_index]

    confidence = probabilities[best_index]

    return label, float(confidence)


# --------------------------------------------------
# Main prediction function
# --------------------------------------------------

def predict_keyword(text):

    text = str(text).strip()

    if not text:

        return {
            "text": text,
            "label": "UNKNOWN",
            "confidence": 0.0,
            "method": "empty"
        }


    # ----------------------------------------------
    # First: exact/fuzzy keyword matching
    # ----------------------------------------------

    fuzzy_result = keyword_match(text)

    if fuzzy_result["score"] >= 85:

        return {
            "text": text,
            "label": fuzzy_result["label"],
            "confidence": round(
                fuzzy_result["score"] / 100,
                4
            ),
            "method": "keyword",
            "matched_keyword": fuzzy_result["keyword"]
        }


    # ----------------------------------------------
    # Second: ML model
    # ----------------------------------------------

    ml_label, ml_confidence = ml_prediction(text)


    # ----------------------------------------------
    # Unknown threshold
    # ----------------------------------------------

    if ml_confidence < 0.45:

        return {
            "text": text,
            "label": "UNKNOWN",
            "confidence": round(
                ml_confidence,
                4
            ),
            "method": "ml_rejected"
        }


    return {
        "text": text,
        "label": ml_label,
        "confidence": round(
            ml_confidence,
            4
        ),
        "method": "ml"
    }


# --------------------------------------------------
# Testing
# --------------------------------------------------

if __name__ == "__main__":

    test_inputs = [

        # Normal
        "DOB",
        "D.O.B",
        "Date of Birth",
        "Birth Date",

        "Place of Birth",
        "Nationality",
        "Surname",
        "Given Name",

        "Passport No",
        "Document Number",

        "Date of Issue",
        "Expiry Date",

        "Issuing Authority",
        "Visa Number",

        "Driving Licence Number",
        "Aadhaar Number",

        "Address",
        "Postal Code",

        "MRZ",
        "Barcode",
        "QR Code",

        # OCR errors
        "D0B",
        "DATE 0F BIRTH",
        "DATE OF B1RTH",
        "NAT10NALITY",
        "PASSPORT N0",
        "AADHAAR N0",

        # Unknown
        "Hello World",
        "Random Text",
        "This is a document",
    ]


    print("\n========== PREDICTIONS ==========\n")


    for text in test_inputs:

        result = predict_keyword(text)

        print(
            f"{text:<30}"
            f" -> {result['label']:<30}"
            f" confidence={result['confidence']:<7}"
            f" method={result['method']}"
        )