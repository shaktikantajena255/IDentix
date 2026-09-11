"""
IDentix Test Document Pipeline Runner
======================================
Runs all 8 synthetic test documents through the REAL pipeline
(OCR → MRZ → cross-field → tamper → face → watchlist → risk score)
and produces a structured results table.

Usage:
    cd backend
    .\\venv312\\Scripts\\python.exe test_synth_pipeline.py
"""
import sys, os, traceback
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# UTF-8 safe output on Windows
if hasattr(sys.stdout, 'buffer'):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import pipeline
import database
import importlib
importlib.reload(pipeline)

VALID_STATES = {"PASSED", "FAILED", "INCONCLUSIVE", "UNAVAILABLE"}
DOC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_documents")

# ── Seed watchlist ────────────────────────────────────────────────────────────
def seed():
    database.init_db()   # this now inserts UT0099887 if absent
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT doc_number, reason, added_at FROM blacklist_cache ORDER BY id")
    rows = cursor.fetchall()
    conn.close()
    print(f"[SETUP] Watchlist entries present ({len(rows)} total):")
    for r in rows:
        print(f"  • {r['doc_number']:<16} — {r['reason'][:60]}")
    print()

seed()

# ── Test case definitions ─────────────────────────────────────────────────────
# (filename, selfie_filename_or_None, expected_failing_check, expected_tier_or_None, expected_ie, description)
CASES = [
    (
        "genuine_clean.png",     None,
        None,              None,    False,
        "Genuine — all checks should PASS → CLEAR"
    ),
    (
        "tampered_visible_edit.png", None,
        "tamper",          None,    False,
        "Tampered — ELA should flag FAILED"
    ),
    (
        "dob_mismatch.png",      None,
        "cross_field",     None,    False,
        "DOB mismatch — Cross-field FAILED"
    ),
    (
        "expired.png",           None,
        "expiry",          None,    False,
        "Expired — Document Validity FAILED"
    ),
    (
        "mrz_checksum_fail.png", None,
        "mrz",             None,    False,
        "MRZ checksum failure — score clamped to 90+"
    ),
    (
        "watchlist_match.png",   None,
        "watchlist",       "HIGH_RISK", False,
        "Watchlist match (UT0099887) — score clamped to 95+"
    ),
    (
        "insufficient_evidence.png", None,
        None,              None,    True,
        "Insufficient Evidence — 2+ checks INCONCLUSIVE/UNAVAILABLE"
    ),
    (
        "face_mismatch.png",     None,
        "face",            None,    False,
        "Face mismatch — Face check FAILED (or UNAVAILABLE if no face lib)"
    ),
]

SEP  = "=" * 74
SEP2 = "-" * 74

def state_tag(s):
    t = {"PASSED": "[PASS]", "FAILED": "[FAIL]", "INCONCLUSIVE": "[INC ]", "UNAVAILABLE": "[UNV ]"}
    return f"{t.get(s, '[??? ]')} {s}"

# ── Runner ────────────────────────────────────────────────────────────────────
print(SEP)
print("IDentix — 8 Synthetic Test Document Pipeline Results")
print(SEP)

summary_rows = []
crashes = 0

for doc_file, selfie_file, exp_fail_check, exp_tier, exp_ie, description in CASES:
    doc_path    = os.path.join(DOC_DIR, doc_file)
    selfie_path = os.path.join(DOC_DIR, selfie_file) if selfie_file else None

    print(f"\n{SEP2}")
    print(f"  {doc_file}")
    print(f"  {description}")
    print(SEP2)

    if not os.path.exists(doc_path):
        print(f"  [ERROR] File not found: {doc_path}")
        summary_rows.append({
            "file": doc_file, "description": description,
            "ocr": "N/A", "mrz": "N/A", "cross": "N/A",
            "tamper": "N/A", "face": "N/A", "watchlist": "N/A",
            "tier": "FILE_MISSING", "score": None, "ie": False,
            "match": False, "note": "File not found"
        })
        crashes += 1
        continue

    try:
        result = pipeline.run_verification_pipeline(
            doc_image_path=doc_path,
            selfie_image_path=selfie_path,
            officer_id=1,
        )

        checks = result.get("checks", {})
        insuff = result.get("insufficient_evidence", False)
        tier   = result.get("risk_tier")
        score  = result.get("risk_score")

        def st(key): return checks.get(key, {}).get("status", "MISSING")
        def dt(key): return str(checks.get(key, {}).get("detail", ""))[:90]

        # OCR fields
        print(f"  OCR Extraction:")
        print(f"    Name       : {result.get('extracted_name', 'Not detected')}")
        print(f"    DOB        : {result.get('extracted_dob', 'Not detected')}")
        print(f"    Doc Number : {result.get('extracted_doc_number', 'Not detected')}")
        print(f"    Expiry     : {result.get('extracted_expiry', 'Not detected')}")
        print(f"    Nationality: {result.get('extracted_nationality', 'Not detected')}")
        print(f"    Doc Type   : {result.get('doc_type', '?')}")
        print()

        # All 6 key checks
        print(f"  Check Results:")
        for key, label in [
            ("ocr",         "OCR / MRZ Extraction "),
            ("mrz",         "MRZ Checksum         "),
            ("cross_field", "Cross-Field Validation"),
            ("expiry",      "Document Validity     "),
            ("tamper",      "Tamper Detection      "),
            ("face",        "Face Verification     "),
            ("watchlist",   "Watchlist Check       "),
        ]:
            print(f"    {label}: {state_tag(st(key))}")
            detail = dt(key)
            if detail:
                print(f"    {'':23}  {detail}")

        # Tamper dual-signal
        tc = checks.get("tamper", {})
        ela_s = tc.get("ela_status", "N/A")
        ela_v = tc.get("ela_max_value", "?")
        ml_s  = tc.get("ml_status", "N/A")
        ml_p  = tc.get("ml_probability")
        print()
        print(f"  Tamper Dual-Signal:")
        print(f"    Rule-Based (ELA)         : {ela_s}  (max ELA value: {ela_v})")
        if ml_p is not None:
            print(f"    ML Model (Random Forest) : {ml_s}  ({ml_p:.1f}% tamper probability)")
        else:
            print(f"    ML Model (Random Forest) : UNAVAILABLE — model not loaded (ELA-only)")
        print(f"    Combined decision        : {state_tag(st('tamper'))}")

        # Risk engine
        print()
        if insuff:
            print(f"  Risk Engine : INSUFFICIENT EVIDENCE — Manual Verification Required")
        else:
            print(f"  Risk Engine : Score = {score}  |  Tier = {tier}")
        expl = str(result.get("risk_explanation", ""))
        if expl:
            print(f"  Explanation : {expl[:110]}")

        # Validate no invalid states
        violations = []
        for k, c in checks.items():
            if isinstance(c, dict):
                s = c.get("status", "")
                if s not in VALID_STATES:
                    violations.append(f"{k}={s!r}")
        if violations:
            print(f"\n  [!] FOUR-STATE VIOLATIONS: {', '.join(violations)}")

        # Outcome assessment
        notes = []
        match = True

        if exp_ie and not insuff:
            notes.append(f"Expected IE but got tier={tier}")
            match = False
        if not exp_ie and insuff:
            notes.append("Got IE (unexpected) — check counts INCONCLUSIVE/UNAVAILABLE")
            match = False  # not necessarily wrong but worth flagging
        if exp_tier and not insuff and tier != exp_tier:
            notes.append(f"Expected tier={exp_tier} got {tier}")
            match = False

        # For expected failing check — verify it IS failing (or at least not PASSED)
        if exp_fail_check and not insuff:
            actual = st(exp_fail_check)
            if actual == "PASSED":
                notes.append(f"Expected {exp_fail_check} to NOT be PASSED but got PASSED")
                match = False
            else:
                notes.append(f"{exp_fail_check}={actual} (expected non-PASSED: OK)")

        verdict = "[MATCH]" if match else "[MISMATCH]"
        print(f"\n  {verdict} — {'; '.join(notes) if notes else 'Outcome as expected'}")

        summary_rows.append({
            "file": doc_file.replace(".png.png", ".png"),
            "description": description,
            "ocr":      st("ocr"),
            "mrz":      st("mrz"),
            "cross":    st("cross_field"),
            "tamper":   st("tamper"),
            "face":     st("face"),
            "watchlist":st("watchlist"),
            "tier": "IE" if insuff else (tier or "None"),
            "score": score,
            "ie": insuff,
            "match": match,
            "note": "; ".join(notes) if notes else "OK",
        })

    except Exception as exc:
        print(f"  [CRASH] {exc}")
        traceback.print_exc()
        crashes += 1
        summary_rows.append({
            "file": doc_file, "description": description,
            "ocr": "CRASH", "mrz": "CRASH", "cross": "CRASH",
            "tamper": "CRASH", "face": "CRASH", "watchlist": "CRASH",
            "tier": "CRASH", "score": None, "ie": False,
            "match": False, "note": str(exc)[:60],
        })

# ── Summary table ─────────────────────────────────────────────────────────────
print(f"\n{SEP}")
print("RESULTS SUMMARY TABLE")
print(SEP)

col_w = 34
hdr = f"{'Filename':<34} {'OCR':<5} {'MRZ':<5} {'XFld':<5} {'Tmpr':<5} {'Face':<5} {'WL':<5} {'Tier':<10} {'Sc':<5} {'Match'}"
print(f"  {hdr}")
print(f"  {'-'*len(hdr)}")

def abbr(s):
    return {"PASSED":"PASS","FAILED":"FAIL","INCONCLUSIVE":"INC ","UNAVAILABLE":"UNV ",
            "CRASH":"ERR ","MISSING":"???","N/A":"N/A ","MISSING":"????"}.get(s, s[:4])

for r in summary_rows:
    match_s = "YES" if r["match"] else "NO "
    score_s = str(r["score"]) if r["score"] is not None else "  - "
    fname   = r["file"][:33]
    print(
        f"  {fname:<34} {abbr(r['ocr']):<5} {abbr(r['mrz']):<5} "
        f"{abbr(r['cross']):<5} {abbr(r['tamper']):<5} {abbr(r['face']):<5} "
        f"{abbr(r['watchlist']):<5} {str(r['tier']):<10} {score_s:<5} {match_s}"
    )
    if r["note"] and r["note"] != "OK":
        print(f"  {'':34} NOTE: {r['note'][:65]}")

print(SEP)
print(f"  Crashes / file-not-found : {crashes}")
print(f"  Outcome mismatches       : {sum(1 for r in summary_rows if not r['match'])}")
print(SEP)

sys.exit(1 if crashes > 0 else 0)
