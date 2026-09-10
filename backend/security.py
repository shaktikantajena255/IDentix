import os
import hashlib
import json
from pathlib import Path
from cryptography.fernet import Fernet
import database
import logging

logger = logging.getLogger(__name__)

KEY_PATH = str(Path(__file__).parent / "secret.key")

def get_fernet():
    if not os.path.exists(KEY_PATH):
        key = Fernet.generate_key()
        with open(KEY_PATH, "wb") as f:
            f.write(key)
    else:
        with open(KEY_PATH, "rb") as f:
            key = f.read()
    return Fernet(key)

def encrypt_field(value: str) -> str:
    if value is None:
        return None
    f = get_fernet()
    return f.encrypt(value.encode('utf-8')).decode('utf-8')

def decrypt_field(encrypted: str) -> str:
    if encrypted is None:
        return None
    f = get_fernet()
    try:
        return f.decrypt(encrypted.encode('utf-8')).decode('utf-8')
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return "Decryption Error"

def compute_record_hash(record_data: dict, previous_hash: str) -> str:
    fields_to_hash = {
        "case_id": record_data.get("case_id"),
        "officer_id": record_data.get("officer_id"),
        "doc_type": record_data.get("doc_type"),
        "extracted_dob": record_data.get("extracted_dob"),
        "extracted_expiry": record_data.get("extracted_expiry"),
        "extracted_nationality": record_data.get("extracted_nationality"),
        "check_doc_type": record_data.get("check_doc_type"),
        "check_ocr": record_data.get("check_ocr"),
        "check_mrz": record_data.get("check_mrz"),
        "check_tamper": record_data.get("check_tamper"),
        "check_face": record_data.get("check_face"),
        "check_watchlist": record_data.get("check_watchlist"),
        "risk_score": record_data.get("risk_score"),
        "risk_tier": record_data.get("risk_tier"),
        "created_at": record_data.get("created_at")
    }
    
    sorted_json = json.dumps(fields_to_hash, sort_keys=True)
    combined = sorted_json + previous_hash
    return hashlib.sha256(combined.encode('utf-8')).hexdigest()

def verify_chain_integrity() -> dict:
    records = database.get_all_records_ordered()
    prev_hash = ""
    checked = 0
    
    for r in records:
        expected_hash = compute_record_hash(r, prev_hash)
        if r["record_hash"] != expected_hash:
            return {
                "intact": False,
                "checked": checked,
                "tampered_at": r["case_id"]
            }
        prev_hash = expected_hash
        checked += 1
        
    return {
        "intact": True,
        "checked": checked,
        "tampered_at": None
    }
