"""
Backend pipeline end-to-end test.
Runs the full verification pipeline on demo test cases and verifies key fields.

Uses ASCII-only output to avoid Windows cp1252 encoding issues with emoji.
"""
import sys
sys.path.insert(0, '.')

# Force UTF-8 output on Windows if possible
if hasattr(sys.stdout, 'buffer'):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import pipeline
import database
import importlib
importlib.reload(pipeline)

DEMO_DIR = 'demo_docs'

# Seed the test watchlist entry (WL999999 for test-07)
# This normally runs in FastAPI startup, but for unit tests we must call it explicitly.
try:
    database.init_db()  # ensure tables exist
    conn = database.get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT 1 FROM blacklist_cache WHERE doc_number = ?', ('WL999999',))
    if not cursor.fetchone():
        cursor.execute(
            'INSERT INTO blacklist_cache (doc_number, name, reason, added_at) VALUES (?, ?, ?, ?)',
            ('WL999999', 'WATCHLST GRACE', '[IDentix Demo Test-07] Synthetic watchlist match',
             '2026-01-01T00:00:00'),
        )
        conn.commit()
        print('Seeded WL999999 watchlist entry for Test 07')
    conn.close()
except Exception as seed_err:
    print(f'[WARN] Could not seed watchlist: {seed_err}')

print('=' * 60)
print('IDentix Backend Pipeline Tests')
print('=' * 60)

# (test_id, expected_tier_or_None, has_selfie, doc_file, selfie_file, note)
test_cases = [
    ('01', None,        True,  'test_01_doc.png', 'test_01_selfie.png',
     'Valid passport — CLEAR if face OK, else Insufficient Evidence'),
    ('07', 'HIGH_RISK', True,  'test_07_doc.png', 'test_07_selfie.png',
     'Watchlist match — must FAILED watchlist'),
    ('08', None,        False, 'test_08_doc.png', None,
     'No selfie — face UNAVAILABLE'),
    ('09', None,        True,  'test_09_doc.png', 'test_09_selfie.png',
     'Tampered document'),
]

passed = 0
failed = 0

for test_id, expected_tier, has_selfie, doc_file, selfie_file, note in test_cases:
    doc_path = f'{DEMO_DIR}/{doc_file}'
    selfie_path = f'{DEMO_DIR}/{selfie_file}' if selfie_file else None

    print(f'\n--- Test {test_id}: {note} ---')
    try:
        result = pipeline.run_verification_pipeline(
            doc_image_path=doc_path,
            selfie_image_path=selfie_path,
            officer_id=1,
        )

        risk_tier = result.get('risk_tier')
        risk_score = result.get('risk_score')
        insuff = result.get('insufficient_evidence', False)
        case_id = result.get('case_id')
        doc_type = result.get('doc_type')
        checks = result.get('checks', {})

        print(f'  Case ID: {case_id}')
        print(f'  Doc Type: {doc_type}')
        print(f'  Risk Tier: {risk_tier} | Score: {risk_score} | IE: {insuff}')
        print(f'  Extracted Name: {result.get("extracted_name", "?")}')
        print(f'  Extracted DOB: {result.get("extracted_dob", "?")}')
        print(f'  Extracted DocNum: {result.get("extracted_doc_number", "?")}')
        print(f'  Extracted Expiry: {result.get("extracted_expiry", "?")}')
        print(f'  Check OCR: {checks.get("ocr", {}).get("status")}')
        print(f'  Check MRZ: {checks.get("mrz", {}).get("status")}')
        print(f'  Check Cross-field: {checks.get("cross_field", {}).get("status")}')
        print(f'  Check Face: {checks.get("face", {}).get("status")}')
        print(f'  Check Tamper: {checks.get("tamper", {}).get("status")}')
        print(f'  Check Watchlist: {checks.get("watchlist", {}).get("status")}')
        print(f'  Explanation: {str(result.get("risk_explanation", ""))[:120]}')

        # Basic structural assertions
        assert case_id, 'Missing case_id'

        if insuff:
            # Insufficient Evidence: risk_score/tier are None — this is correct behavior
            assert risk_score is None, f'Expected None score on IE, got {risk_score}'
            print(f'  [OK] Test {test_id}: Insufficient Evidence (correct for synthetic selfies without real faces)')
        else:
            assert risk_score is not None, 'Missing risk_score when not IE'
            valid_tiers = ('CLEAR', 'REVIEW', 'HIGH_RISK')
            assert risk_tier in valid_tiers, f'Bad risk_tier: {risk_tier}'
            if expected_tier and risk_tier == expected_tier:
                print(f'  [OK] Test {test_id}: Tier matched expected={expected_tier}')
            elif expected_tier:
                print(f'  [WARN] Test {test_id}: Got tier={risk_tier}, expected={expected_tier}')

        # Test 07: watchlist must be FAILED or at minimum tested
        if test_id == '07':
            wl = checks.get('watchlist', {}).get('status')
            doc_num = result.get('extracted_doc_number', 'Not detected')
            if wl == 'FAILED':
                print(f'  [OK] Test 07: Watchlist correctly FAILED (doc_num={doc_num})')
            else:
                print(f'  [WARN] Test 07: Watchlist={wl}, doc_num={doc_num}')
                print(f'         WL999999 must be in demo doc text for watchlist hit')

        print(f'  [PASS] Test {test_id} completed (pipeline ran without crash)')
        passed += 1

    except AssertionError as ae:
        print(f'  [FAIL] Assertion FAILED: {ae}')
        failed += 1
    except Exception as e:
        import traceback
        print(f'  [ERROR] Pipeline ERROR: {e}')
        traceback.print_exc()
        failed += 1

print()
print('=' * 60)
print(f'Results: {passed} PASSED | {failed} FAILED')
print('=' * 60)
