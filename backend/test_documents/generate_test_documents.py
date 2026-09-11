"""
IDentix test-document generator.

Fixes ISSUE 1 (MRZ OCR misreads) and ISSUE 2 (false-positive ELA on AI-
composited images) at the ROOT CAUSE, per the project's no-guessing
principle: instead of tweaking detection thresholds/weights, we regenerate
cleaner test images.

- MRZ + VIZ text is drawn programmatically (PIL, monospace font, fixed
  character pitch) -> pixel-perfect, reliably OCR-readable. No AI image
  generation is used for text.
- Each document is composed from clean layers (background rect, photo,
  text) and saved as a SINGLE-PASS PNG (no JPEG recompression, no
  multi-generation compositing) -> minimal/near-zero ELA response, so
  "genuine" documents won't falsely trip the ELA tamper threshold.
- MRZ check digits are computed with the real ICAO 9303 7-3-1 algorithm
  (see mrz_utils.py) -- never guessed or hand-typed.

Usage:
    python3 generate_test_documents.py

Before running for real: set GENUINE_PHOTO and MISMATCH_PHOTO below to
paths of your own real photos (the brief mentions you already have your
real photo). If left as None, a placeholder silhouette is drawn instead
so the script still runs end-to-end for layout/OCR testing.
"""

import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from mrz_utils import build_td3_mrz, check_digit

OUT_DIR = "output_documents"
os.makedirs(OUT_DIR, exist_ok=True)

# ---- Point these at real files when you run this locally -----------------
GENUINE_PHOTO = None       # e.g. "my_photo.jpg" -- your real photo
MISMATCH_PHOTO = None      # e.g. "other_face.jpg" -- a different face, for face_mismatch.png
# ----------------------------------------------------------------------------

CANVAS_W, CANVAS_H = 1200, 750
MONO_FONT_PATH = "/usr/share/fonts/truetype/freefont/FreeMonoBold.ttf"
SANS_FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SANS_REG_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

BASE = dict(
    surname="JENA",
    given="SHAKTIKANTA",
    country="UTO",
    nationality="UTO",
    passport_no="UT0012345",
    dob_yymmdd="070203",       # 03/02/2007
    dob_display="03/02/2007",
    sex="M",
    expiry_yymmdd="310315",    # 15/03/2031
    expiry_display="15/03/2031",
)


MRZ_SUPERSAMPLE = 4  # render MRZ at 4x then downscale -> much cleaner glyph edges for OCR


def render_mrz_line(text: str, pitch: int, font_size: int) -> Image.Image:
    """Render one fixed-pitch MRZ line on its own supersampled white canvas,
    then downscale. Supersampling + FreeMono (which has a distinct slashed/
    open zero vs round O, unlike DejaVu/Liberation Mono) is what actually
    fixes the O/0 misreads, not any correction logic downstream."""
    s = MRZ_SUPERSAMPLE
    font = ImageFont.truetype(MONO_FONT_PATH, font_size * s)
    w, h = pitch * len(text) * s // s * s, int(font_size * 1.6) * s
    # simpler: fixed generous canvas
    w = (pitch * len(text) + 20) * s
    h = int(font_size * 1.6) * s
    layer = Image.new("RGB", (w, h), (255, 255, 255))
    d = ImageDraw.Draw(layer)
    for i, ch in enumerate(text):
        d.text((10 * s + i * pitch * s, 0), ch, font=font, fill=(0, 0, 0))
    layer = layer.resize((w // s, h // s), Image.LANCZOS)
    return layer


def draw_mrz_line(img: Image.Image, text: str, x: int, y: int,
                   pitch: int, font_size: int):
    """Composite a rendered MRZ line onto the document canvas."""
    layer = render_mrz_line(text, pitch, font_size)
    img.paste(layer, (x, y))


def photo_layer(path, size=(220, 280)):
    if path and os.path.exists(path):
        img = Image.open(path).convert("RGB").resize(size)
        return img
    # Placeholder: flat silhouette so the script still runs without real photos
    img = Image.new("RGB", size, (210, 210, 215))
    d = ImageDraw.Draw(img)
    d.ellipse((size[0] * 0.25, size[1] * 0.12, size[0] * 0.75, size[1] * 0.55), fill=(160, 160, 170))
    d.ellipse((size[0] * 0.05, size[1] * 0.55, size[0] * 0.95, size[1] * 1.15), fill=(160, 160, 170))
    return img


def render_document(passport_no, dob_display, dob_yymmdd, expiry_display, expiry_yymmdd,
                     surname=BASE["surname"], given=BASE["given"], sex=BASE["sex"],
                     photo_path=None, corrupt_mrz_char=None, blur_and_rotate=False,
                     visible_tamper_box=False):
    """Build one passport document image and return it (PIL Image, RGB)."""
    img = Image.new("RGB", (CANVAS_W, CANVAS_H), (245, 245, 240))
    draw = ImageDraw.Draw(img)

    # Border / header band
    draw.rectangle((0, 0, CANVAS_W, 90), fill=(20, 45, 90))
    header_font = ImageFont.truetype(SANS_FONT_PATH, 34)
    draw.text((40, 20), "REPUBLIC OF UTOPIA - PASSPORT", font=header_font, fill=(255, 255, 255))
    draw.rectangle((0, 0, CANVAS_W, CANVAS_H), outline=(20, 45, 90), width=6)

    # Photo
    photo = photo_layer(photo_path)
    img.paste(photo, (60, 130))
    draw.rectangle((60, 130, 60 + photo.width, 130 + photo.height), outline=(20, 45, 90), width=3)

    # VIZ fields
    label_font = ImageFont.truetype(SANS_REG_PATH, 16)
    value_font = ImageFont.truetype(SANS_FONT_PATH, 24)
    fields = [
        ("SURNAME / NOM", surname),
        ("GIVEN NAMES / PRENOMS", given),
        ("PASSPORT NO.", passport_no),
        ("NATIONALITY", BASE["nationality"]),
        ("DATE OF BIRTH", dob_display),
        ("SEX", sex),
        ("DATE OF EXPIRY", expiry_display),
    ]
    fx, fy = 330, 140
    for label, value in fields:
        draw.text((fx, fy), label, font=label_font, fill=(90, 90, 90))
        draw.text((fx, fy + 20), value, font=value_font, fill=(15, 15, 15))
        fy += 65

    # Optional visible tamper mark (crude pasted-looking rectangle over a field)
    if visible_tamper_box:
        draw.rectangle((fx, 140 + 65 * 2, fx + 260, 140 + 65 * 2 + 45), fill=(255, 250, 235))
        draw.text((fx, 140 + 65 * 2 + 20), passport_no, font=value_font, fill=(40, 40, 40))
        draw.rectangle((fx - 2, 140 + 65 * 2 - 2, fx + 262, 140 + 65 * 2 + 47), outline=(200, 30, 30), width=2)

    # MRZ zone
    line1, line2 = build_td3_mrz(surname, given, BASE["country"], BASE["nationality"],
                                  passport_no, dob_yymmdd, sex, expiry_yymmdd)
    if corrupt_mrz_char:
        pos, newchar = corrupt_mrz_char
        line2 = line2[:pos] + newchar + line2[pos + 1:]

    draw.rectangle((0, CANVAS_H - 160, CANVAS_W, CANVAS_H), fill=(255, 255, 255))
    pitch = 25
    draw_mrz_line(img, line1, 45, CANVAS_H - 140, pitch, 30)
    draw_mrz_line(img, line2, 45, CANVAS_H - 90, pitch, 30)
    draw = ImageDraw.Draw(img)  # re-bind after paste operations above

    if blur_and_rotate:
        img = img.filter(ImageFilter.GaussianBlur(3.2))
        img = img.rotate(7, expand=True, fillcolor=(245, 245, 240))

    return img.convert("RGB")


def save_flat(img, name):
    """Single-pass PNG save -- no recompression, no alpha, no multi-generation
    compositing, which is what caused the false ELA signal on the old
    AI-generated images."""
    path = os.path.join(OUT_DIR, name)
    img.convert("RGB").save(path, format="PNG", optimize=False)
    print(f"  wrote {path}  ({img.width}x{img.height})")
    return path


def main():
    b = BASE

    # 1. genuine_clean.png -- everything should PASS
    save_flat(render_document(b["passport_no"], b["dob_display"], b["dob_yymmdd"],
                               b["expiry_display"], b["expiry_yymmdd"],
                               photo_path=GENUINE_PHOTO),
              "genuine_clean.png")

    # 2. tampered_visible_edit.png -- Tamper Detection should FAIL
    save_flat(render_document(b["passport_no"], b["dob_display"], b["dob_yymmdd"],
                               b["expiry_display"], b["expiry_yymmdd"],
                               photo_path=GENUINE_PHOTO, visible_tamper_box=True),
              "tampered_visible_edit.png")

    # 3. dob_mismatch.png -- VIZ DOB shown differs from MRZ-encoded DOB -> Cross-Field FAIL
    #    (MRZ still encodes the true 070203; VIZ text displays a different date)
    save_flat(render_document(b["passport_no"], "17/09/1999", b["dob_yymmdd"],
                               b["expiry_display"], b["expiry_yymmdd"],
                               photo_path=GENUINE_PHOTO),
              "dob_mismatch.png")

    # 4. expired.png -- expiry well in the past -> Document Validity FAIL
    save_flat(render_document(b["passport_no"], b["dob_display"], b["dob_yymmdd"],
                               "15/03/2019", "190315",
                               photo_path=GENUINE_PHOTO),
              "expired.png")

    # 5. mrz_checksum_fail.png -- one MRZ digit deliberately wrong -> MRZ FAILED, hard override
    #    Corrupt the passport-number check digit (index 9 in line2, 0-based)
    save_flat(render_document(b["passport_no"], b["dob_display"], b["dob_yymmdd"],
                               b["expiry_display"], b["expiry_yymmdd"],
                               photo_path=GENUINE_PHOTO,
                               corrupt_mrz_char=(9, str((int(check_digit(b["passport_no"])) + 1) % 10))),
              "mrz_checksum_fail.png")

    # 6. watchlist_match.png -- different, clean-looking passport number (seed this
    #    number into blacklist_cache): UT0099887
    save_flat(render_document("UT0099887", b["dob_display"], b["dob_yymmdd"],
                               b["expiry_display"], b["expiry_yymmdd"],
                               photo_path=GENUINE_PHOTO),
              "watchlist_match.png")

    # 7. insufficient_evidence.png -- blurred + rotated -> multiple checks INCONCLUSIVE
    save_flat(render_document(b["passport_no"], b["dob_display"], b["dob_yymmdd"],
                               b["expiry_display"], b["expiry_yymmdd"],
                               photo_path=GENUINE_PHOTO, blur_and_rotate=True),
              "insufficient_evidence.png")

    # 8. face_mismatch.png -- correct document data, different face -> Face Verification FAIL
    save_flat(render_document(b["passport_no"], b["dob_display"], b["dob_yymmdd"],
                               b["expiry_display"], b["expiry_yymmdd"],
                               photo_path=MISMATCH_PHOTO or GENUINE_PHOTO),
              "face_mismatch.png")

    print("\nDone. Remember: for #8 to actually test a face MISMATCH, MISMATCH_PHOTO")
    print("must point to a different face than GENUINE_PHOTO.")


if __name__ == "__main__":
    main()
