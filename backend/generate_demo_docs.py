"""
IDentix Demo Document Generator
================================
Generates 10 synthetic demo passport images using Pillow.

All documents are CLEARLY labeled:
    "IDentix DEMO — NOT A REAL DOCUMENT — FICTIONAL DATA"

ICAO MRZ check digit algorithm is used to generate
valid OR intentionally corrupt MRZ digits depending on test case.

Run:
    python generate_demo_docs.py
"""

import json
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# Output directory
OUT_DIR = Path(__file__).parent / "demo_docs"
OUT_DIR.mkdir(exist_ok=True)

# ── MRZ UTILITIES ────────────────────────────────────────────────────────────

MRZ_WEIGHTS = [7, 3, 1]
MRZ_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ<"

def mrz_check_digit(data: str) -> str:
    """ICAO 9303 check digit."""
    total = 0
    for i, c in enumerate(data.upper()):
        val = int(c) if c.isdigit() else (ord(c) - ord("A") + 10 if c.isalpha() else 0)
        total += val * MRZ_WEIGHTS[i % 3]
    return str(total % 10)


def build_td3_mrz(
    surname: str,
    given_names: str,
    doc_number: str,
    nationality: str,
    dob: str,      # YYMMDD
    sex: str,      # M/F/X
    expiry: str,   # YYMMDD
    personal: str = "<<<<<<<<<<<<<<",
    corrupt_dob_check: bool = False,
    corrupt_doc_check: bool = False,
) -> tuple[str, str]:
    """Build a TD3 (passport) 2x44 MRZ."""

    # Line 1
    issuer = "IDX"  # Fictional issuer code
    name_field = f"{surname.upper().replace(' ','<')}<<{given_names.upper().replace(' ','<')}"
    name_field = name_field[:39].ljust(39, "<")
    line1 = f"P<{issuer}{name_field}"
    line1 = line1[:44].ljust(44, "<")

    # Line 2
    doc_num_field = doc_number.upper().ljust(9, "<")[:9]
    doc_check = mrz_check_digit(doc_num_field)
    if corrupt_doc_check:
        doc_check = str((int(doc_check) + 1) % 10)

    nat = nationality.upper()[:3].ljust(3, "<")
    dob_check = mrz_check_digit(dob)
    if corrupt_dob_check:
        dob_check = str((int(dob_check) + 1) % 10)

    expiry_check = mrz_check_digit(expiry)
    personal_field = personal[:14].ljust(14, "<")
    composite_check = mrz_check_digit(
        doc_num_field + doc_check + dob + dob_check + expiry + expiry_check + personal_field
    )

    line2 = f"{doc_num_field}{doc_check}{nat}{dob}{dob_check}{sex}{expiry}{expiry_check}{personal_field}{composite_check}"
    line2 = line2[:44].ljust(44, "<")

    return line1, line2


# ── DOCUMENT RENDERER ───────────────────────────────────────────────────────

PASSPORT_W, PASSPORT_H = 900, 640
DEMO_WATERMARK = "IDentix DEMO — NOT A REAL DOCUMENT — FICTIONAL DATA"


def _try_font(size: int):
    """Load a font with fallback to default."""
    font_paths = [
        "C:/Windows/Fonts/consola.ttf",
        "C:/Windows/Fonts/cour.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/DejaVuSans.ttf",
    ]
    for fp in font_paths:
        try:
            return ImageFont.truetype(fp, size)
        except Exception:
            pass
    return ImageFont.load_default()


def _try_bold_font(size: int):
    bold_paths = [
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/consolab.ttf",
    ]
    for fp in bold_paths:
        try:
            return ImageFont.truetype(fp, size)
        except Exception:
            pass
    return _try_font(size)


def render_passport(config: dict, output_path: Path):
    """
    Render a synthetic passport image.
    """
    bg_color = config.get("bg_color", (220, 235, 255))
    img = Image.new("RGB", (PASSPORT_W, PASSPORT_H), color=bg_color)
    draw = ImageDraw.Draw(img)

    # Header bar
    header_color = config.get("header_color", (30, 50, 120))
    draw.rectangle([(0, 0), (PASSPORT_W, 60)], fill=header_color)
    title_font = _try_bold_font(22)
    draw.text((20, 16), "FICTITIOUS TRAVEL DOCUMENT", fill=(255, 255, 255), font=title_font)
    draw.text((PASSPORT_W - 280, 16), "IDentix Demo System", fill=(200, 220, 255), font=_try_font(16))

    # Watermark (diagonal)
    wm_font = _try_font(28)
    wm_img = Image.new("RGBA", (PASSPORT_W, PASSPORT_H), (0, 0, 0, 0))
    wm_draw = ImageDraw.Draw(wm_img)
    wm_draw.text((80, 250), DEMO_WATERMARK, fill=(200, 0, 0, 60), font=wm_font)
    img.paste(Image.alpha_composite(img.convert("RGBA"), wm_img).convert("RGB"), (0, 0))
    draw = ImageDraw.Draw(img)

    # Photo area (placeholder)
    photo_x, photo_y = 30, 80
    photo_w, photo_h = 140, 170
    photo_color = config.get("photo_color", (150, 170, 200))
    draw.rectangle([(photo_x, photo_y), (photo_x + photo_w, photo_y + photo_h)], fill=photo_color, outline=(100, 120, 160), width=2)
    face_font = _try_font(11)
    draw.text((photo_x + 20, photo_y + 80), "[FICTIONAL\nPHOTO]", fill=(80, 90, 110), font=face_font)

    # Fields
    lf = _try_font(11)
    vf = _try_bold_font(14)
    fx = 200
    fy = 80

    def field(label, value, y_offset=0):
        draw.text((fx, fy + y_offset), label.upper(), fill=(80, 80, 120), font=lf)
        draw.text((fx, fy + y_offset + 14), value, fill=(10, 10, 40), font=vf)
        return y_offset + 40

    fields = config.get("fields", {})
    yo = 0
    yo = field("Surname", fields.get("surname", "DEMO"), yo)
    yo = field("Given Name", fields.get("given_name", "FICTIONAL"), yo)
    yo = field("Date of Birth", fields.get("dob_display", "01 JAN 1990"), yo)
    yo = field("Nationality", fields.get("nationality", "IDX"), yo)
    yo = field("Passport No", fields.get("doc_number", "IDX000001"), yo)
    yo = field("Date of Expiry", fields.get("expiry_display", "01 JAN 2030"), yo)
    field("Sex", fields.get("sex", "M"), yo)

    # Issuer line
    draw.text((200, 355), f"Issued by: IDentix Demo Authority | Checkpoint Alpha", fill=(80, 80, 80), font=_try_font(11))

    # Test case label
    label_color = config.get("label_color", (180, 0, 0))
    label_font = _try_bold_font(12)
    draw.text((30, 380), f"[TEST CASE {config['test_id']}]  {config['label']}", fill=label_color, font=label_font)

    # MRZ area
    mrz_bg = (230, 240, 255)
    draw.rectangle([(0, 430), (PASSPORT_W, 640)], fill=mrz_bg)
    draw.line([(0, 430), (PASSPORT_W, 430)], fill=(100, 120, 160), width=2)
    mrz_font = _try_font(18)
    mrz_label = _try_font(10)
    draw.text((20, 435), "MRZ (Machine Readable Zone)", fill=(100, 120, 160), font=mrz_label)

    mrz1, mrz2 = config.get("mrz", ("", ""))
    draw.text((20, 452), mrz1, fill=(10, 10, 40), font=mrz_font)
    draw.text((20, 478), mrz2, fill=(10, 10, 40), font=mrz_font)

    # Tamper region (for TEST 03)
    if config.get("tamper_photo"):
        draw.rectangle([(photo_x, photo_y), (photo_x + photo_w, photo_y + photo_h)], fill=(100, 200, 100))
        draw.text((photo_x + 10, photo_y + 70), "[REPLACED\nPHOTO\nREGION]", fill=(0, 80, 0), font=face_font)

    # Blur if needed (TEST 09)
    if config.get("blur"):
        from PIL import ImageFilter
        img = img.filter(ImageFilter.GaussianBlur(radius=3))
        img = img.rotate(5, expand=False, fillcolor=(220, 235, 255))

    img.save(str(output_path), "PNG", dpi=(150, 150))
    return output_path


# ── TEST CASE DEFINITIONS ─────────────────────────────────────────────────

def make_cases():
    cases = []

    # ── TEST 01: Clean Demo Passport ──────────────────────────────────────
    mrz1, mrz2 = build_td3_mrz(
        surname="DEMOUSER", given_names="ALICE JANE",
        doc_number="IDX100001", nationality="IDX",
        dob="900115", sex="F", expiry="301215",
    )
    cases.append({
        "test_id": "01", "id": "test_01",
        "label": "Clean Demo Passport — All checks should PASS",
        "expected": "CLEAR",
        "description": "Fictional identity. Internally consistent fields. Valid MRZ.",
        "bg_color": (220, 235, 255), "header_color": (20, 60, 140),
        "label_color": (0, 120, 0),
        "fields": {
            "surname": "DEMOUSER", "given_name": "ALICE JANE",
            "dob_display": "15 JAN 1990", "nationality": "IDX",
            "doc_number": "IDX100001", "expiry_display": "15 DEC 2030", "sex": "F",
        },
        "mrz": (mrz1, mrz2),
        "selfie_color": (200, 170, 140),
    })

    # ── TEST 02: DOB Mismatch ──────────────────────────────────────────────
    # Visible DOB says 1985, MRZ says 1990
    mrz1, mrz2 = build_td3_mrz(
        surname="MISMATCH", given_names="BOB CHARLIE",
        doc_number="IDX100002", nationality="IDX",
        dob="900220", sex="M", expiry="301215",  # MRZ: 1990-02-20
    )
    cases.append({
        "test_id": "02", "id": "test_02",
        "label": "DOB Mismatch — Cross-field FAILED expected",
        "expected": "REVIEW",
        "description": "Visible DOB 20 FEB 1985 differs from MRZ DOB 20 FEB 1990.",
        "bg_color": (255, 245, 220), "header_color": (140, 80, 20),
        "label_color": (160, 80, 0),
        "fields": {
            "surname": "MISMATCH", "given_name": "BOB CHARLIE",
            "dob_display": "20 FEB 1985",  # <-- deliberately wrong vs MRZ 900220
            "nationality": "IDX",
            "doc_number": "IDX100002", "expiry_display": "15 DEC 2030", "sex": "M",
        },
        "mrz": (mrz1, mrz2),
        "selfie_color": (190, 160, 140),
    })

    # ── TEST 03: Tampered Photo ────────────────────────────────────────────
    mrz1, mrz2 = build_td3_mrz(
        surname="TAMPERTEST", given_names="CHARLIE",
        doc_number="IDX100003", nationality="IDX",
        dob="850312", sex="M", expiry="301215",
    )
    cases.append({
        "test_id": "03", "id": "test_03",
        "label": "Tampered Photo — Forensic anomaly expected",
        "expected": "REVIEW",
        "description": "Photo region replaced. ELA should detect anomaly.",
        "bg_color": (255, 235, 235), "header_color": (120, 30, 30),
        "label_color": (180, 0, 0),
        "tamper_photo": True,
        "fields": {
            "surname": "TAMPERTEST", "given_name": "CHARLIE",
            "dob_display": "12 MAR 1985", "nationality": "IDX",
            "doc_number": "IDX100003", "expiry_display": "15 DEC 2030", "sex": "M",
        },
        "mrz": (mrz1, mrz2),
        "selfie_color": (160, 130, 110),
        "selfie_mismatch": True,
    })

    # ── TEST 04: Face Mismatch ─────────────────────────────────────────────
    mrz1, mrz2 = build_td3_mrz(
        surname="PERSONA", given_names="DIANA",
        doc_number="IDX100004", nationality="IDX",
        dob="920505", sex="F", expiry="301215",
    )
    cases.append({
        "test_id": "04", "id": "test_04",
        "label": "Face Mismatch — Face FAILED expected",
        "expected": "HIGH_RISK",
        "description": "Doc: fictional Person A. Selfie: fictional Person B. Face check should FAIL.",
        "bg_color": (255, 240, 255), "header_color": (100, 20, 120),
        "label_color": (120, 0, 160),
        "fields": {
            "surname": "PERSONA", "given_name": "DIANA",
            "dob_display": "05 MAY 1992", "nationality": "IDX",
            "doc_number": "IDX100004", "expiry_display": "15 DEC 2030", "sex": "F",
        },
        "mrz": (mrz1, mrz2),
        "selfie_color": (120, 80, 180),  # very different color = different person
        "selfie_mismatch": True,
    })

    # ── TEST 05: Expired ──────────────────────────────────────────────────
    mrz1, mrz2 = build_td3_mrz(
        surname="EXPIRED", given_names="EDGAR",
        doc_number="IDX100005", nationality="IDX",
        dob="800601", sex="M", expiry="200101",  # Expired 2020-01-01
    )
    cases.append({
        "test_id": "05", "id": "test_05",
        "label": "Expired Document — Expiry FAILED (not fraud)",
        "expected": "REVIEW",
        "description": "Synthetic doc expired Jan 2020. Expiry != fraud.",
        "bg_color": (235, 240, 220), "header_color": (80, 100, 20),
        "label_color": (90, 100, 0),
        "fields": {
            "surname": "EXPIRED", "given_name": "EDGAR",
            "dob_display": "01 JUN 1980", "nationality": "IDX",
            "doc_number": "IDX100005", "expiry_display": "01 JAN 2020", "sex": "M",
        },
        "mrz": (mrz1, mrz2),
        "selfie_color": (180, 160, 140),
    })

    # ── TEST 06: MRZ Checksum Failure ─────────────────────────────────────
    mrz1, mrz2 = build_td3_mrz(
        surname="CHECKSUM", given_names="FRANK",
        doc_number="IDX100006", nationality="IDX",
        dob="750712", sex="M", expiry="301215",
        corrupt_doc_check=True,   # intentionally corrupt
    )
    cases.append({
        "test_id": "06", "id": "test_06",
        "label": "MRZ Checksum FAILED — Risk 90+ expected",
        "expected": "HIGH_RISK",
        "description": "Check digit on document number is intentionally wrong.",
        "bg_color": (255, 230, 220), "header_color": (150, 30, 10),
        "label_color": (200, 0, 0),
        "fields": {
            "surname": "CHECKSUM", "given_name": "FRANK",
            "dob_display": "12 JUL 1975", "nationality": "IDX",
            "doc_number": "IDX100006", "expiry_display": "15 DEC 2030", "sex": "M",
        },
        "mrz": (mrz1, mrz2),
        "selfie_color": (170, 150, 130),
    })

    # ── TEST 07: Watchlist Match ───────────────────────────────────────────
    mrz1, mrz2 = build_td3_mrz(
        surname="WATCHLST", given_names="GRACE",
        doc_number="WL999999", nationality="IDX",  # WL999999 added to blacklist
        dob="881010", sex="F", expiry="301215",
    )
    cases.append({
        "test_id": "07", "id": "test_07",
        "label": "Watchlist Match — Risk 90+ expected",
        "expected": "HIGH_RISK",
        "description": "Doc number WL999999 is in the synthetic mock watchlist.",
        "bg_color": (255, 220, 220), "header_color": (180, 0, 0),
        "label_color": (200, 0, 0),
        "fields": {
            "surname": "WATCHLST", "given_name": "GRACE",
            "dob_display": "10 OCT 1988", "nationality": "IDX",
            "doc_number": "WL999999", "expiry_display": "15 DEC 2030", "sex": "F",
        },
        "mrz": (mrz1, mrz2),
        "selfie_color": (160, 130, 120),
    })

    # ── TEST 08: Insufficient Evidence ────────────────────────────────────
    # Doc image is barely readable, no selfie
    cases.append({
        "test_id": "08", "id": "test_08",
        "label": "Insufficient Evidence — Manual verification required",
        "expected": "INSUFFICIENT",
        "description": "No selfie. Minimal document info. Expected: Insufficient Evidence.",
        "bg_color": (240, 240, 240), "header_color": (80, 80, 80),
        "label_color": (100, 100, 100),
        "fields": {
            "surname": "UNKNOWN", "given_name": "UNKNOWN",
            "dob_display": "UNKNOWN", "nationality": "UNK",
            "doc_number": "UNKNOWN", "expiry_display": "UNKNOWN", "sex": "?",
        },
        "mrz": ("", ""),
        "selfie_color": None,  # no selfie
        "no_selfie": True,
    })

    # ── TEST 09: Poor Quality Image ───────────────────────────────────────
    mrz1, mrz2 = build_td3_mrz(
        surname="POORIMG", given_names="HENRY",
        doc_number="IDX100009", nationality="IDX",
        dob="910815", sex="M", expiry="301215",
    )
    cases.append({
        "test_id": "09", "id": "test_09",
        "label": "Poor Quality Image — OCR/forensic degraded",
        "expected": "INCONCLUSIVE",
        "description": "Blurred and rotated. OCR may be degraded.",
        "bg_color": (220, 220, 210), "header_color": (60, 60, 60),
        "label_color": (80, 80, 80),
        "blur": True,
        "fields": {
            "surname": "POORIMG", "given_name": "HENRY",
            "dob_display": "15 AUG 1991", "nationality": "IDX",
            "doc_number": "IDX100009", "expiry_display": "15 DEC 2030", "sex": "M",
        },
        "mrz": (mrz1, mrz2),
        "selfie_color": (180, 155, 135),
    })

    # ── TEST 10: Screenshot / Recapture ──────────────────────────────────
    mrz1, mrz2 = build_td3_mrz(
        surname="RECAPTUR", given_names="IRIS",
        doc_number="IDX100010", nationality="IDX",
        dob="951120", sex="F", expiry="301215",
    )
    cases.append({
        "test_id": "10", "id": "test_10",
        "label": "Recaptured Screenshot — Forensic INCONCLUSIVE likely",
        "expected": "REVIEW",
        "description": "Screenshot of a document. Double-compression artefacts visible.",
        "bg_color": (200, 210, 230), "header_color": (40, 60, 100),
        "label_color": (40, 60, 140),
        "recapture": True,
        "fields": {
            "surname": "RECAPTUR", "given_name": "IRIS",
            "dob_display": "20 NOV 1995", "nationality": "IDX",
            "doc_number": "IDX100010", "expiry_display": "15 DEC 2030", "sex": "F",
        },
        "mrz": (mrz1, mrz2),
        "selfie_color": (195, 165, 145),
    })

    return cases


def render_selfie(color: tuple, path: Path):
    """Render a simple synthetic selfie (colored circle on neutral background)."""
    img = Image.new("RGB", (300, 400), color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    # Face oval
    draw.ellipse([(50, 50), (250, 300)], fill=color, outline=(100, 100, 100), width=2)
    # Eyes
    draw.ellipse([(100, 130), (130, 155)], fill=(40, 30, 20), outline=(20, 20, 20), width=1)
    draw.ellipse([(170, 130), (200, 155)], fill=(40, 30, 20), outline=(20, 20, 20), width=1)
    # Mouth
    draw.arc([(110, 200), (190, 240)], start=10, end=170, fill=(100, 50, 50), width=3)
    # Label
    font = _try_font(12)
    draw.text((60, 350), "IDentix DEMO SELFIE", fill=(150, 150, 150), font=font)
    img.save(str(path), "PNG")


def render_recapture_doc(doc_img: Image.Image, path: Path):
    """Simulate a screenshot recapture by saving to JPEG at low quality then reloading."""
    import io
    buf = io.BytesIO()
    doc_img.save(buf, format="JPEG", quality=40)
    buf.seek(0)
    reloaded = Image.open(buf).convert("RGB")
    # Add screen bezel effect
    bordered = Image.new("RGB", (reloaded.width + 60, reloaded.height + 60), color=(30, 30, 30))
    bordered.paste(reloaded, (30, 30))
    bordered.save(str(path), "PNG")


# ── MANIFEST ──────────────────────────────────────────────────────────────────

def generate_all():
    cases = make_cases()
    manifest = []

    for case in cases:
        doc_path = OUT_DIR / f"{case['id']}_doc.png"
        selfie_path = OUT_DIR / f"{case['id']}_selfie.png"

        # Render doc
        img_path = render_passport(case, doc_path)

        # Handle recapture variant
        if case.get("recapture"):
            orig = Image.open(str(doc_path))
            render_recapture_doc(orig, doc_path)

        # Render selfie
        selfie_exists = False
        if not case.get("no_selfie") and case.get("selfie_color"):
            render_selfie(case["selfie_color"], selfie_path)
            selfie_exists = True

        manifest.append({
            "id": case["id"],
            "test_id": case["test_id"],
            "label": case["label"],
            "description": case["description"],
            "expected": case["expected"],
            "doc_file": f"{case['id']}_doc.png",
            "selfie_file": f"{case['id']}_selfie.png" if selfie_exists else None,
            "watchlist_doc_number": "WL999999" if case["id"] == "test_07" else None,
        })
        print(f"  [TEST {case['test_id']}] Generated: {doc_path.name}")

    # Write manifest
    manifest_path = OUT_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\n  Manifest: {manifest_path}")
    return manifest


if __name__ == "__main__":
    print("\nIDentix Demo Document Generator\n" + "=" * 36)
    manifest = generate_all()
    print(f"\n  {len(manifest)} test cases generated in: {OUT_DIR}")
