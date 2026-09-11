"""
IDentix Enhanced Pipeline Integration Test
===========================================
Runs the full 10-stage pipeline on ALL existing demo documents (test_01..test_10).

For every test case reports:
  - All 9 check statuses (must be in {PASSED, FAILED, INCONCLUSIVE, UNAVAILABLE})
  - Tamper dual-signal: ELA status + ML probability separately
  - OCR field extraction: Name, DOB, DocNum, Expiry, Nationality
  - Insufficient Evidence flag
  - Any crashes or exceptions (pipeline must NEVER crash — degrade gracefully)

Exit code: 0 if all pipelines ran without crashing, 1 if any exception/assertion.
"""
import sys
import traceback
sys.path.insert(0, '.')

# UTF-8 output on Windows
if hasattr(sys.stdout, 'buffer'):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import pipeline
import database
import importlib
importlib.reload(pipeline)

VALID_STATES = {"PASSED", "FAILED", "INCONCLUSIVE", "UNAVAILABLE"}
DEMO_DIR = 'demo_docs'

# ── Seed watchlist entries ────────────────────────────────────────────────────
def seed_watchlist():
    try:
        database.init_db()
        conn = database.get_db()
        cursor = conn.cursor()
        for doc_num, name, reason in [
            ('WL999999', 'WATCHLST GRACE', '[Demo Test-07] Synthetic watchlist match'),
        ]:
            cursor.execute('SELECT 1 FROM blacklist_cache WHERE doc_number = ?', (doc_num,))
            if not cursor.fetchone():
                cursor.execute(
                    'INSERT INTO blacklist_cache (doc_number, name, reason, added_at) VALUES (?, ?, ?, ?)',
                    (doc_num, name, reason, '2026-01-01T00:00:00'),
                )
        conn.commit()
        conn.close()
        print('[SETUP] Watchlist seeded (WL999999)')
    except Exception as e:
        print(f'[WARN] Could not seed watchlist: {e}')

seed_watchlist()

# ── Test case definitions ─────────────────────────────────────────────────────
# (test_id, selfie_file_or_None, expected_tier_or_None, expected_ie, note)
TEST_CASES = [
    ('01', 'test_01_selfie.png', None,         False, 'Clean passport — CLEAR (with matching face)'),
    ('02', 'test_02_selfie.png', None,         False, 'DOB mismatch — Cross-field FAILED'),
    ('03', 'test_03_selfie.png', None,         False, 'Tampered photo — ELA anomaly expected'),
    ('04', 'test_04_selfie.png', None,         False, 'Face mismatch — face check degraded (no face_recognition)'),
    ('05', 'test_05_selfie.png', None,         False, 'Expired document — Expiry FAILED'),
    ('06', 'test_06_selfie.png', None,         False, 'MRZ checksum failure — score clamped to 90+'),
    ('07', 'test_07_selfie.png', 'HIGH_RISK',  False, 'Watchlist match — score clamped to 95+'),
    ('08', None,                 None,         True,  'No selfie — face UNAVAILABLE -> IE likely'),
    ('09', 'test_09_selfie.png', None,         False, 'Poor quality / blurred — OCR degraded'),
    ('10', 'test_10_selfie.png', None,         False, 'Recaptured screenshot — double JPEG compression'),
]

SEP  = '=' * 72
SEP2 = '-' * 72

def fmt_state(s):
    """Colour-annotate a state string for terminal output."""
    tags = {
        'PASSED':       '[PASS]',
        'FAILED':       '[FAIL]',
        'INCONCLUSIVE': '[INC ]',
        'UNAVAILABLE':  '[UNV ]',
    }
    return f"{tags.get(s, '[??? ]')} {s}"

def validate_all_states(checks: dict, test_id: str) -> list[str]:
    """Return list of violations where a check returned an invalid state."""
    violations = []
    for check_name, check_dict in checks.items():
        if not isinstance(check_dict, dict):
            continue
        status = check_dict.get('status', 'MISSING')
        if status not in VALID_STATES:
            violations.append(
                f"  [!] Stage '{check_name}': invalid state '{status}' (not in {VALID_STATES})"
            )
    return violations

# ── Main runner ───────────────────────────────────────────────────────────────
print(SEP)
print('IDentix Enhanced Pipeline Integration Test')
print('All 10 demo documents | Four-state validation | Tamper dual-signal')
print(SEP)

total = 0
crash_count = 0
violation_count = 0
results_summary = []

for test_id, selfie_file, expected_tier, expected_ie, note in TEST_CASES:
    doc_path    = f'{DEMO_DIR}/test_{test_id}_doc.png'
    selfie_path = f'{DEMO_DIR}/{selfie_file}' if selfie_file else None

    print(f'\n{SEP2}')
    print(f'TEST {test_id} — {note}')
    print(SEP2)

    total += 1
    try:
        result = pipeline.run_verification_pipeline(
            doc_image_path=doc_path,
            selfie_image_path=selfie_path,
            officer_id=1,
        )

        checks = result.get('checks', {})
        insuff = result.get('insufficient_evidence', False)
        tier   = result.get('risk_tier')
        score  = result.get('risk_score')

        # ── OCR field extraction ──────────────────────────────────────────────
        print(f'  Doc Type    : {result.get("doc_type", "?")}')
        print(f'  Case ID     : {result.get("case_id", "?")}')
        print()
        print('  OCR Field Extraction:')
        print(f'    Name        : {result.get("extracted_name", "Not detected")}')
        print(f'    DOB         : {result.get("extracted_dob", "Not detected")}')
        print(f'    Doc Number  : {result.get("extracted_doc_number", "Not detected")}')
        print(f'    Expiry      : {result.get("extracted_expiry", "Not detected")}')
        print(f'    Nationality : {result.get("extracted_nationality", "Not detected")}')
        print()

        # ── Per-stage four-state status ───────────────────────────────────────
        print('  Stage Results:')
        stage_order = [
            ('preprocessing', 'Stage 1: Preprocessing'),
            ('doc_type',      'Stage 2: Doc Type'),
            ('ocr',           'Stage 3: OCR/MRZ'),
            ('mrz',           'Stage 4: MRZ Checksum'),
            ('cross_field',   'Stage 5: Cross-Field'),
            ('expiry',        'Stage 6: Expiry'),
            ('tamper',        'Stage 7: Tamper'),
            ('face',          'Stage 8: Face'),
            ('watchlist',     'Stage 9: Watchlist'),
        ]
        for key, label in stage_order:
            ch = checks.get(key, {})
            st = ch.get('status', 'MISSING')
            detail = str(ch.get('detail', ''))[:80]
            print(f'    {label:<28} : {fmt_state(st)}')
            if detail:
                print(f'    {"":28}   {detail}')

        # ── Tamper dual-signal detail ─────────────────────────────────────────
        tamper_ch = checks.get('tamper', {})
        ela_status = tamper_ch.get('ela_status', 'N/A')
        ela_max    = tamper_ch.get('ela_max_value', '?')
        ml_status  = tamper_ch.get('ml_status', 'N/A')
        ml_prob    = tamper_ch.get('ml_probability')
        print()
        print('  Tamper Dual-Signal Detail:')
        print(f'    Rule-Based (ELA)          : {ela_status}  (max ELA value: {ela_max})')
        if ml_prob is not None:
            print(f'    ML Model (Random Forest)  : {ml_status}  ({ml_prob:.1f}% tamper probability)')
        else:
            print(f'    ML Model (Random Forest)  : UNAVAILABLE  (model not loaded — ELA-only)')
        print(f'    Combined decision         : {fmt_state(tamper_ch.get("status", "?"))}')

        # ── Risk engine output ────────────────────────────────────────────────
        print()
        if insuff:
            print('  Risk Engine: INSUFFICIENT EVIDENCE — Manual Verification Required')
        else:
            print(f'  Risk Engine: Score={score}  Tier={tier}')
        expl = str(result.get('risk_explanation', ''))
        if expl:
            print(f'  Explanation: {expl[:120]}')

        # ── Four-state validation ─────────────────────────────────────────────
        violations = validate_all_states(checks, test_id)
        if violations:
            print()
            print('  [!] FOUR-STATE VIOLATIONS:')
            for v in violations:
                print(v)
            violation_count += len(violations)

        # ── Expected outcome check ────────────────────────────────────────────
        outcome_ok = True
        if expected_ie and not insuff:
            print(f'  [WARN] Expected Insufficient Evidence but got tier={tier}')
            outcome_ok = False
        if expected_tier and tier != expected_tier:
            print(f'  [WARN] Expected tier={expected_tier} but got tier={tier}')
            outcome_ok = False
        if not expected_ie and not expected_tier:
            outcome_ok = True  # no firm expectation

        verdict = '[OK]  ' if (not violations and outcome_ok) else '[WARN]'
        print(f'\n  {verdict} TEST {test_id} completed — no crash')
        results_summary.append((test_id, note, tier, score, insuff, not violations and outcome_ok))

    except Exception as exc:
        print(f'  [CRASH] Pipeline raised an exception:')
        traceback.print_exc()
        crash_count += 1
        results_summary.append((test_id, note, 'CRASH', None, False, False))

# ── Final summary ─────────────────────────────────────────────────────────────
print(f'\n{SEP}')
print('SUMMARY')
print(SEP)
print(f'  Total tests     : {total}')
print(f'  Pipeline crashes: {crash_count}')
print(f'  State violations: {violation_count}')
print()
print(f'  {"ID":<4}  {"Tier":<12}  {"Score":<6}  {"IE":<5}  {"OK":<5}  Note')
print(f'  {"-"*4}  {"-"*12}  {"-"*6}  {"-"*5}  {"-"*5}  {"-"*40}')
for tid, note, tier, score, ie, ok in results_summary:
    ie_s  = 'YES' if ie else 'no'
    ok_s  = 'YES' if ok else 'WARN'
    sc_s  = str(score) if score is not None else 'None'
    print(f'  {tid:<4}  {str(tier):<12}  {sc_s:<6}  {ie_s:<5}  {ok_s:<5}  {note[:45]}')
print(SEP)

sys.exit(1 if crash_count > 0 else 0)
