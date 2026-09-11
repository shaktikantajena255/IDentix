"""
IDentix — Synthetic Test Document Generator v2
================================================
Fixes vs v1:
  - JPEG baseline normalisation: all docs go through a JPEG round-trip
    at quality=97 before the final PNG save.  This gives the document the
    same uniform quantisation grid that a real high-quality scanner
    produces, so ELA sees normal noise (PASSED) instead of the huge
    text-edge spikes that raw Pillow PNGs create.
  - Tamper: low-quality JPEG patch is applied AFTER the JPEG baseline,
    creating a genuine ELA anomaly boundary.
  - Labels: "DOCUMENT NUMBER" (longer, unambiguous, in alias list) instead
    of "PASSPORT NO." which OCR renders inconsistently at small sizes.
  - MRZ font: 26pt monospace so Tesseract reads all 44 chars cleanly.
  - Image width: 1100px to fit the full 44-char MRZ without wrapping.

Run:
    cd backend
    .\\venv312\\Scripts\\python.exe generate_test_docs.py
"""
import io
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT_DIR = Path(__file__).parent / "test_documents"
OUT_DIR.mkdir(exist_ok=True)

# ── ICAO 7-3-1 check-digit ────────────────────────────────────────────────────
_W = [7, 3, 1]
def _cd(s: str) -> str:
    t = 0
    for i, c in enumerate(s.upper()):
        v = int(c) if c.isdigit() else (ord(c) - 55 if c.isalpha() else 0)
        t += v * _W[i % 3]
    return str(t % 10)

def td3(surname, given, doc_num, nat, dob6, sex, exp6,
        bad_doc=False, bad_dob=False):
    """44+44 char TD3 MRZ with optional deliberate check-digit corruption."""
    nm = f"{surname.upper()}<<{given.upper().replace(' ','<')}"[:39].ljust(39,'<')
    l1 = f"P<{nat.upper()[:3]}{nm}"[:44].ljust(44,'<')

    dn = doc_num.upper().ljust(9,'<')[:9]
    dc = _cd(dn);  dc = str((int(dc)+1)%10) if bad_doc else dc
    n3 = nat.upper()[:3].ljust(3,'<')
    bc = _cd(dob6); bc = str((int(bc)+1)%10) if bad_dob else bc
    ec = _cd(exp6)
    ps = '<<<<<<<<<<<<<<'   # 14-char personal number field
    pc = _cd(ps)
    comp = _cd(dn + dc + dob6 + bc + exp6 + ec + ps + pc)
    l2 = f"{dn}{dc}{n3}{dob6}{bc}{sex}{exp6}{ec}{ps}{pc}{comp}"

    assert len(l1) == 44, f"l1={len(l1)}"
    assert len(l2) == 44, f"l2={len(l2)}"
    return l1, l2

# ── Fonts ─────────────────────────────────────────────────────────────────────
def _font(sz, bold=False):
    candidates = (
        ["C:/Windows/Fonts/arialbd.ttf","C:/Windows/Fonts/consolab.ttf"] if bold
        else ["C:/Windows/Fonts/consola.ttf","C:/Windows/Fonts/cour.ttf",
              "C:/Windows/Fonts/arial.ttf","C:/Windows/Fonts/lucon.ttf"]
    )
    for p in candidates:
        try: return ImageFont.truetype(p, sz)
        except: pass
    return ImageFont.load_default()

W, H = 1100, 760

# ── Core renderer ─────────────────────────────────────────────────────────────
def render(cfg) -> Image.Image:
    bg  = cfg.get('bg',  (232, 241, 255))
    hdr = cfg.get('hdr', (18, 52, 140))
    img = Image.new('RGB', (W, H), bg)
    d   = ImageDraw.Draw(img)

    # Header
    d.rectangle([(0,0),(W,68)], fill=hdr)
    d.text((20,15), "REPUBLIC OF UTOPIA — TRAVEL DOCUMENT",
           fill=(255,255,255), font=_font(22,bold=True))
    d.text((W-250,20), "NOT A REAL DOCUMENT", fill=(255,210,80), font=_font(13))

    # Watermark (diagonal strips)
    wm = Image.new('RGBA',(W,H),(0,0,0,0))
    wd = ImageDraw.Draw(wm)
    wf = _font(30)
    for y in range(90, H, 170):
        wd.text((50, y), "SYNTHETIC TEST DOCUMENT", fill=(170,0,0,50), font=wf)
    img = Image.alpha_composite(img.convert('RGBA'), wm).convert('RGB')
    d   = ImageDraw.Draw(img)

    # Photo box with simple face silhouette
    px,py,pw,ph = 32,85,150,190
    fc = cfg.get('face_color',(195,175,155))
    pc_box = cfg.get('photo_color',(160,175,200))
    d.rectangle([(px,py),(px+pw,py+ph)], fill=pc_box, outline=(80,100,140), width=2)
    d.ellipse([(px+22,py+18),(px+128,py+110)], fill=fc)      # head
    d.ellipse([(px+25,py+102),(px+125,py+182)], fill=fc)     # shoulders
    d.text((px+8,py+83),"[SYNTHETIC\nFACE]", fill=(55,65,90), font=_font(11))

    # VIZ fields — larger labels, "DOCUMENT NUMBER" explicitly
    lf = _font(12)
    vf = _font(16, bold=True)
    fx,fy = 210,86
    lh = 47

    flds = cfg['fields']
    rows = [
        ("SURNAME",           flds['surname']),
        ("GIVEN NAME(S)",     flds['given']),
        ("DATE OF BIRTH",     flds['dob_display']),   # DD MMM YYYY
        ("NATIONALITY",       "UTOPIAN"),
        ("DOCUMENT NUMBER",   flds['doc_num']),        # ICAO: "document number"
        ("DATE OF EXPIRY",    flds['expiry_display']), # DD MMM YYYY
        ("SEX",               flds.get('sex','M')),
    ]
    for i,(label,val) in enumerate(rows):
        y = fy + i*lh
        d.text((fx,y),    label, fill=(75,88,130), font=lf)
        d.text((fx,y+15), val,   fill=(8,8,38),    font=vf)

    d.text((210, fy+7*lh+4),
           "Issued by: Utopia Passport Authority  |  Checkpoint BDR-001",
           fill=(85,90,110), font=_font(11))

    # Test label
    lc = cfg.get('label_color',(150,0,0))
    d.text((32, 322), f"[TEST] {cfg['label']}", fill=lc, font=_font(12,bold=True))

    # MRZ zone — larger font, full width
    mz = 455
    d.rectangle([(0,mz),(W,H)], fill=(225,237,255))
    d.line([(0,mz),(W,mz)], fill=(95,118,158), width=2)
    d.text((18,mz+5), "MACHINE READABLE ZONE — ICAO 9303 TD3", fill=(95,118,158), font=_font(10))
    mf = _font(26)   # larger = Tesseract reads all 44 chars
    l1,l2 = cfg['mrz']
    d.text((18,mz+22), l1, fill=(4,4,28), font=mf)
    d.text((18,mz+58), l2, fill=(4,4,28), font=mf)

    return img

# ── JPEG normalisation (simulate real scanner) ────────────────────────────────
def jpeg_normalise(img: Image.Image, quality=97) -> Image.Image:
    """
    Round-trip through JPEG at high quality.
    Gives the image a uniform quantisation baseline so ELA detects
    ONLY anomalies added AFTER this step, not text-edge rendering
    artefacts from Pillow.
    """
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=quality)
    buf.seek(0)
    return Image.open(buf).copy().convert('RGB')

def add_tamper_patch(img: Image.Image) -> Image.Image:
    """
    Replace photo region with a low-quality JPEG patch AFTER the
    JPEG baseline.  Creates a hard ELA boundary that scores > 45.
    """
    patch_box = (32, 85, 182, 275)
    crop = img.crop(patch_box)
    buf = io.BytesIO()
    crop.save(buf, 'JPEG', quality=15)   # very low quality → big difference
    buf.seek(0)
    patched = Image.open(buf).copy().convert('RGB')
    out = img.copy()
    out.paste(patched, (32, 85))
    return out

def save(img: Image.Image, path: Path):
    img.save(str(path), 'PNG')
    print(f"  {path.name:<40} {path.stat().st_size//1024:>5} KB")

# ── Case definitions ──────────────────────────────────────────────────────────
BASE = dict(
    surname='JENA', given='SHAKTIKANTA K',
    dob_display='03 FEB 2007', dob6='070203',
    expiry_display='15 MAR 2031', exp6='310315',
    doc_num='UT0012345', sex='M',
)

def cases():
    return [
        # ── 1. Genuine ────────────────────────────────────────────────────
        dict(name='genuine_clean', label='Genuine — all checks PASS',
             label_color=(0,120,0), bg=(228,241,255), hdr=(18,52,145),
             fields=BASE,
             mrz=td3(BASE['surname'],BASE['given'],BASE['doc_num'],'UTO',
                     BASE['dob6'],BASE['sex'],BASE['exp6']),
             tamper=False, blur=False),

        # ── 2. Tampered ───────────────────────────────────────────────────
        dict(name='tampered_visible_edit', label='Tampered — ELA should FAIL',
             label_color=(160,0,0), bg=(255,238,238), hdr=(140,22,22),
             fields=BASE,
             mrz=td3(BASE['surname'],BASE['given'],BASE['doc_num'],'UTO',
                     BASE['dob6'],BASE['sex'],BASE['exp6']),
             tamper=True, blur=False),

        # ── 3. DOB mismatch ───────────────────────────────────────────────
        # VIZ shows 1985; MRZ encodes 2007 → cross-field FAILED
        dict(name='dob_mismatch', label='DOB Mismatch — Cross-Field FAIL',
             label_color=(160,80,0), bg=(255,248,228), hdr=(140,88,18),
             fields=dict(BASE, dob_display='03 FEB 1985'),
             mrz=td3(BASE['surname'],BASE['given'],BASE['doc_num'],'UTO',
                     BASE['dob6'],BASE['sex'],BASE['exp6']),
             tamper=False, blur=False),

        # ── 4. Expired ────────────────────────────────────────────────────
        dict(name='expired', label='Expired — Document Validity FAIL',
             label_color=(100,100,0), bg=(245,248,228), hdr=(78,98,18),
             fields=dict(BASE, expiry_display='01 JAN 2020'),
             mrz=td3(BASE['surname'],BASE['given'],BASE['doc_num'],'UTO',
                     BASE['dob6'],BASE['sex'],'200101'),
             tamper=False, blur=False),

        # ── 5. MRZ checksum fail ──────────────────────────────────────────
        dict(name='mrz_checksum_fail', label='MRZ Checksum FAIL — score 90+',
             label_color=(200,0,0), bg=(255,232,228), hdr=(158,22,8),
             fields=BASE,
             mrz=td3(BASE['surname'],BASE['given'],BASE['doc_num'],'UTO',
                     BASE['dob6'],BASE['sex'],BASE['exp6'],bad_doc=True),
             tamper=False, blur=False),

        # ── 6. Watchlist match ────────────────────────────────────────────
        dict(name='watchlist_match', label='Watchlist Match UT0099887 — score 95+',
             label_color=(180,0,0), bg=(255,224,224), hdr=(178,0,0),
             fields=dict(BASE, doc_num='UT0099887'),
             mrz=td3(BASE['surname'],BASE['given'],'UT0099887','UTO',
                     BASE['dob6'],BASE['sex'],BASE['exp6']),
             tamper=False, blur=False),

        # ── 7. Insufficient evidence ──────────────────────────────────────
        # No MRZ, no readable fields, blurred → OCR INC, MRZ INC,
        # Watchlist INC (no doc#), Face UNV → 3+ → IE
        dict(name='insufficient_evidence', label='Insufficient Evidence — Manual Verification',
             label_color=(80,80,80), bg=(238,238,238), hdr=(68,68,68),
             fields=dict(surname='UNKNOWN',given='UNKNOWN',
                         dob_display='UNKNOWN',expiry_display='UNKNOWN',
                         doc_num='UNKNOWN',sex='?'),
             mrz=('',''),
             tamper=False, blur=True),

        # ── 8. Face mismatch ─────────────────────────────────────────────
        # Distinct face colour so a live selfie of a real person won't match
        dict(name='face_mismatch', label='Face Mismatch — Face FAIL',
             label_color=(100,0,160), bg=(248,230,255), hdr=(98,18,140),
             fields=BASE,
             mrz=td3(BASE['surname'],BASE['given'],BASE['doc_num'],'UTO',
                     BASE['dob6'],BASE['sex'],BASE['exp6']),
             photo_color=(55,170,75), face_color=(40,155,60),
             tamper=False, blur=False),
    ]

# ── Generate ──────────────────────────────────────────────────────────────────
def main():
    print(f"\nIDentix Synthetic Test Document Generator v2")
    print(f"Output: {OUT_DIR}\n")
    print(f"{'Filename':<40} {'Size':>7}")
    print("-" * 50)

    for cfg in cases():
        path = OUT_DIR / f"{cfg['name']}.png"
        img  = render(cfg)

        # STEP 1: JPEG baseline (simulate real scanner for honest ELA)
        img = jpeg_normalise(img, quality=97)

        # STEP 2: tamper patch AFTER baseline (creates real ELA anomaly)
        if cfg.get('tamper'):
            img = add_tamper_patch(img)

        # STEP 3: blur / rotate for insufficient-evidence case
        if cfg.get('blur'):
            img = img.filter(ImageFilter.GaussianBlur(radius=5))
            img = img.rotate(7, expand=False, fillcolor=(238,238,238))

        save(img, path)

    print("-" * 50)
    print(f"\nMRZ: all lines 44 chars, ICAO 7-3-1 check digits.")
    print(f"Only mrz_checksum_fail.png has a deliberate bad check digit.")
    print(f"ELA baseline: JPEG q=97 round-trip applied to all docs.")

if __name__ == '__main__':
    main()
