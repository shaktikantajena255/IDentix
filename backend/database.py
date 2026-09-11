import sqlite3
import os
import bcrypt
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

DB_PATH = str(Path(__file__).parent / "identix.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS officers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        badge_number TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS verification_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id TEXT UNIQUE NOT NULL,
        officer_id INTEGER NOT NULL,
        doc_type TEXT,
        extracted_name_enc TEXT,
        extracted_dob TEXT,
        extracted_doc_number_enc TEXT,
        extracted_expiry TEXT,
        extracted_nationality TEXT,
        check_doc_type TEXT,
        check_ocr TEXT,
        check_mrz TEXT,
        check_cross_field TEXT,
        check_expiry TEXT,
        check_tamper TEXT,
        check_face TEXT,
        check_watchlist TEXT,
        risk_score INTEGER,
        risk_tier TEXT,
        risk_explanation TEXT,
        processing_time REAL,
        record_hash TEXT,
        previous_hash TEXT,
        synced INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS blacklist_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_number TEXT UNIQUE NOT NULL,
        name TEXT,
        reason TEXT,
        added_at TEXT NOT NULL
    )
    ''')

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        retry_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    )
    ''')

    # Seed officers if empty
    cursor.execute("SELECT COUNT(*) FROM officers")
    if cursor.fetchone()[0] == 0:
        pw_hash = bcrypt.hashpw(b"password123", bcrypt.gensalt(rounds=4)).decode('utf-8')  # DEV: rounds=4
        cursor.execute('''
        INSERT INTO officers (username, password_hash, full_name, badge_number, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ''', ("officer1", pw_hash, "Officer James Carter", "BDR-001"))

    # Seed blacklist if empty
    cursor.execute("SELECT COUNT(*) FROM blacklist_cache")
    if cursor.fetchone()[0] == 0:
        blacklist_data = [
            ("AB1234567", "SUSPECTED TRAFFICKER", "Suspected human trafficking ring"),
            ("P9876543X", "STOLEN PASS", "Stolen passport — reported 2024-03-15"),
            ("DL-555-FAKE", "FRAUDULENT DOC", "Known fraudulent document series")
        ]
        for doc_num, name, reason in blacklist_data:
            cursor.execute('''
            INSERT INTO blacklist_cache (doc_number, name, reason, added_at)
            VALUES (?, ?, ?, datetime('now'))
            ''', (doc_num, name, reason))

    # Upsert guaranteed entries — always present regardless of table age.
    # New entries added here are inserted on each init_db() call if absent.
    guaranteed_entries = [
        (
            "UT0099887",
            "UNKNOWN SUSPECT",
            "Suspected identity fraud — flagged at Checkpoint BDR-003 on 12/08/2025",
            "2025-08-12T00:00:00",
        ),
    ]
    for doc_num, name, reason, flagged_at in guaranteed_entries:
        cursor.execute(
            "SELECT 1 FROM blacklist_cache WHERE doc_number = ?", (doc_num,)
        )
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO blacklist_cache (doc_number, name, reason, added_at) VALUES (?, ?, ?, ?)",
                (doc_num, name, reason, flagged_at),
            )

    conn.commit()
    conn.close()
    logger.info("Database initialized.")

def get_last_record_hash():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT record_hash FROM verification_records ORDER BY id DESC LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else ""

def get_dashboard_stats():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM verification_records")
    total = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM verification_records WHERE risk_tier='CLEAR'")
    clear = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM verification_records WHERE risk_tier='REVIEW'")
    review = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM verification_records WHERE risk_tier='HIGH_RISK'")
    high = cursor.fetchone()[0]
    
    conn.close()
    return {
        "total_screenings": total,
        "clear_count": clear,
        "review_count": review,
        "high_risk_count": high
    }

def get_recent_screenings(limit=10):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM verification_records ORDER BY id DESC LIMIT ?", (limit,))
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def get_all_records_ordered():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM verification_records ORDER BY id ASC")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

def insert_verification_record(data: dict):
    conn = get_db()
    cursor = conn.cursor()
    
    keys = list(data.keys())
    placeholders = ",".join(["?"] * len(keys))
    values = tuple(data[k] for k in keys)
    
    cursor.execute(f"INSERT INTO verification_records ({','.join(keys)}) VALUES ({placeholders})", values)
    record_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return record_id

def get_record_by_case_id(case_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM verification_records WHERE case_id = ?", (case_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_all_records():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM verification_records ORDER BY id DESC")
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows

