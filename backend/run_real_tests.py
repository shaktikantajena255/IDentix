"""Run the real test docs through the pipeline and print results."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent.resolve()))

from pipeline import run_verification_pipeline

TEST_DIR = pathlib.Path(__file__).parent / "test_documents"
FILES    = sorted(TEST_DIR.glob("*.png"))

EXPECTED = {
    "genuine_clean.png":         ("CLEAR",   "all checks PASS"),
    "tampered_visible_edit.png": (None,      "tamper FAILED"),
    "dob_mismatch.png":          (None,      "cross-field FAILED"),
    "expired.png":               (None,      "expiry FAILED"),
    "mrz_checksum_fail.png":     ("HIGH_RISK","MRZ checksum FAILED, score 90+"),
    "watchlist_match.png":       ("HIGH_RISK","watchlist FAILED, score 95+"),
    "insufficient_evidence.png": ("IE",      "Insufficient Evidence"),
    "face_mismatch.png":         (None,      "face FAILED"),
}

def main():
    SEP = "=" * 72
    print(f"\n{SEP}")
    print(f"  IDentix — Real Test Document Pipeline Results")
    print(f"  Files found: {len(FILES)}")
    print(SEP)

    for f in FILES:
        print(f"\n---- {f.name} ----")
        try:
            r = run_verification_pipeline(
                doc_image_path=str(f),
                selfie_image_path=None,
                officer_id=0,
            )

            # ── Extracted fields ──────────────────────────────────────────────
            name    = r.get("extracted_name",        "Not detected")
            doc_num = r.get("extracted_doc_number",  "Not detected")
            dob     = r.get("extracted_dob",         "Not detected")
            expiry  = r.get("extracted_expiry",      "Not detected")
            print(f"  Name={name}  Doc#={doc_num}  DOB={dob}  Expiry={expiry}")

            # ── Check statuses ────────────────────────────────────────────────
            checks = r.get("checks", {})
            def st(key):
                return checks.get(key, {}).get("status", "?")[:4].upper()

            ocr  = st("ocr")
            mrz  = st("mrz")
            xf   = st("cross_field")
            exp  = st("expiry")
            tmpr = st("tamper")
            face = st("face")
            wl   = st("watchlist")
            print(f"  OCR={ocr}  MRZ={mrz}  XFld={xf}  Expiry={exp}  Tmpr={tmpr}  Face={face}  WL={wl}")

            # ── Tamper dual-signal ────────────────────────────────────────────
            td  = checks.get("tamper", {})
            ela = td.get("ela_result", "?")
            ml  = td.get("ml_result",  "?")
            ela_val = td.get("max_ela_value", "?")
            print(f"  Tamper: ELA={ela}  ML={ml}  max_ela={ela_val}")

            # ── MRZ / cross-field detail ──────────────────────────────────────
            mrz_detail = checks.get("mrz", {}).get("detail", "")
            xf_detail  = checks.get("cross_field", {}).get("detail", "")
            wl_detail  = checks.get("watchlist", {}).get("detail", "")
            if mrz_detail:  print(f"  MRZ detail: {mrz_detail[:80]}")
            if xf_detail:   print(f"  XFld detail: {xf_detail[:80]}")
            if wl_detail:   print(f"  WL detail: {wl_detail[:80]}")

            # ── Risk outcome ──────────────────────────────────────────────────
            ie    = r.get("insufficient_evidence", False)
            tier  = r.get("risk_tier",  "?")
            score = r.get("risk_score", "?")
            expl  = r.get("risk_explanation", "")[:80]
            if ie:
                actual_tier = "IE"
                print(f"  => INSUFFICIENT EVIDENCE")
            else:
                actual_tier = tier
                print(f"  => Tier={tier}  Score={score}")
            if expl:
                print(f"     {expl}")

            # ── Match check ───────────────────────────────────────────────────
            exp_tier, exp_label = EXPECTED.get(f.name, (None, "unknown"))
            if exp_tier is None:
                print(f"  [CHECK] Expected: {exp_label}")
            elif actual_tier == exp_tier:
                print(f"  [MATCH] Expected tier={exp_tier} ✓")
            else:
                print(f"  [MISMATCH] Expected tier={exp_tier}, got tier={actual_tier}")

        except Exception as exc:
            import traceback
            print(f"  CRASH: {exc}")
            traceback.print_exc()

    print(f"\n{SEP}\n")

main()
