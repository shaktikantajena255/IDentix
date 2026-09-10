"""
IDentix Face Verification — Self-contained OpenCV + NumPy implementation.

Uses only opencv-python and numpy (both already installed) with no external
model files required. Works on Python 3.14, offline environments.

Algorithm — Perceptual Hash + Histogram similarity:
  1. Load both images (document photo + live selfie)
  2. Find the face region using a combination of:
     a. Upper-centre crop heuristic (passport photos → face is top-centre)
     b. Skin-tone colour mask (HSV range) to verify it's a face region
  3. Resize both regions to 64x64 grayscale
  4. Compute a perceptual hash (DCT-based pHash) for each
  5. Compare Hamming distance of hashes → match percentage
  6. Also compute histogram correlation as a second signal
  7. Combine both signals → final PASSED / FAILED / INCONCLUSIVE

Note on accuracy:
  This is a lightweight comparison suitable for detecting obvious mismatches
  (different people, photo swaps). For high-security deployments, replace with
  a neural-network-based recognizer (YuNet + SFace) once internet access is
  available to download model files.

Returns:
    status: PASSED | FAILED | INCONCLUSIVE | UNAVAILABLE
"""
import logging
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


# ── Image loading ─────────────────────────────────────────────────────────────

def _load_as_bgr(image_path: str) -> np.ndarray | None:
    """Load image as BGR numpy array via Pillow (handles all colour modes)."""
    try:
        img = Image.open(image_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        arr = np.array(img)
        return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    except Exception as exc:
        logger.error('Failed to load image %s: %s', image_path, exc)
        return None


# ── Face region extraction ─────────────────────────────────────────────────────

def _extract_face_region(bgr_image: np.ndarray) -> np.ndarray:
    """
    Extract the most likely face region from the image.

    Strategy:
      1. Try skin-tone HSV mask — if a significant skin region is found in the
         upper 60% of the image, use that bounding box.
      2. Fall back to an upper-centre crop (portrait/passport standard).

    Returns a BGR crop of the face region, resized to 128x128.
    """
    h, w = bgr_image.shape[:2]

    # --- Skin-tone detection via HSV ---
    hsv = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2HSV)
    # HSV skin range (works across a range of skin tones)
    lower_skin = np.array([0, 20, 70], dtype=np.uint8)
    upper_skin = np.array([25, 255, 255], dtype=np.uint8)
    skin_mask = cv2.inRange(hsv, lower_skin, upper_skin)

    # Also check warm skin tones in a second HSV range
    lower_skin2 = np.array([160, 20, 70], dtype=np.uint8)
    upper_skin2 = np.array([180, 255, 255], dtype=np.uint8)
    skin_mask2 = cv2.inRange(hsv, lower_skin2, upper_skin2)
    skin_mask = cv2.bitwise_or(skin_mask, skin_mask2)

    # Only look in the upper 60% of the image for the face
    region_mask = np.zeros_like(skin_mask)
    region_mask[:int(h * 0.65), :] = 255
    skin_mask = cv2.bitwise_and(skin_mask, region_mask)

    # Morphological cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
    skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel)
    skin_mask = cv2.dilate(skin_mask, kernel, iterations=2)

    # Find contours
    contours, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if contours:
        # Pick largest skin region
        largest = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest)
        # Must be at least 2% of image area to be a real face region
        if area >= h * w * 0.02:
            bx, by, bw, bh = cv2.boundingRect(largest)
            # Add 30% margin for context
            margin_x = int(bw * 0.3)
            margin_y = int(bh * 0.3)
            x1 = max(0, bx - margin_x)
            y1 = max(0, by - margin_y)
            x2 = min(w, bx + bw + margin_x)
            y2 = min(h, by + bh + margin_y)
            crop = bgr_image[y1:y2, x1:x2]
            if crop.size > 0:
                return cv2.resize(crop, (128, 128), interpolation=cv2.INTER_AREA)

    # Fall back: upper-centre crop (passport / ID card standard)
    # Face is typically in the top 55% of the image, centred
    face_h = int(h * 0.55)
    face_w = min(w, int(face_h * 0.75))
    x_start = max(0, (w - face_w) // 2)
    crop = bgr_image[:face_h, x_start:x_start + face_w]
    return cv2.resize(crop, (128, 128), interpolation=cv2.INTER_AREA)


# ── Perceptual hash (pHash) ────────────────────────────────────────────────────

def _phash(gray_image: np.ndarray, hash_size: int = 16) -> np.ndarray:
    """
    Compute DCT-based perceptual hash of a grayscale image.
    Returns a binary array of hash_size² bits.
    """
    # Resize to larger DCT block
    resized = cv2.resize(gray_image, (hash_size * 4, hash_size * 4), interpolation=cv2.INTER_AREA)
    # Apply DCT
    dct = cv2.dct(np.float32(resized))
    # Take top-left hash_size x hash_size block (low frequencies)
    dct_low = dct[:hash_size, :hash_size]
    # Threshold at mean
    mean_val = np.mean(dct_low)
    return (dct_low > mean_val).flatten()


def _hamming_distance(hash_a: np.ndarray, hash_b: np.ndarray) -> int:
    """Hamming distance between two binary hash arrays."""
    return int(np.sum(hash_a != hash_b))


# ── Histogram similarity ────────────────────────────────────────────────────────

def _hist_similarity(gray_a: np.ndarray, gray_b: np.ndarray) -> float:
    """
    Normalised histogram correlation between two grayscale images.
    Returns value in [-1, 1] where 1.0 = identical distribution.
    """
    hist_a = cv2.calcHist([gray_a], [0], None, [64], [0, 256])
    hist_b = cv2.calcHist([gray_b], [0], None, [64], [0, 256])
    cv2.normalize(hist_a, hist_a)
    cv2.normalize(hist_b, hist_b)
    return float(cv2.compareHist(hist_a, hist_b, cv2.HISTCMP_CORREL))


# ── Main comparison function ───────────────────────────────────────────────────

def compare_faces(doc_image_path: str, selfie_image_path: str | None) -> dict:
    """
    Compare faces between the document photo and a live selfie.

    Returns:
        status: PASSED | FAILED | INCONCLUSIVE | UNAVAILABLE
        match_percentage: float (0–100) or None
        detail: str
    """
    # ── No selfie ──────────────────────────────────────────────────────────────
    if not selfie_image_path:
        return {
            'status': 'UNAVAILABLE',
            'match_percentage': None,
            'detail': 'No live selfie provided for face comparison',
        }

    if not Path(selfie_image_path).is_file():
        return {
            'status': 'UNAVAILABLE',
            'match_percentage': None,
            'detail': f'Selfie file not found: {selfie_image_path}',
        }

    # ── Load images ────────────────────────────────────────────────────────────
    doc_bgr = _load_as_bgr(doc_image_path)
    if doc_bgr is None:
        return {
            'status': 'UNAVAILABLE',
            'match_percentage': None,
            'detail': 'Could not load document image for face comparison',
        }

    selfie_bgr = _load_as_bgr(selfie_image_path)
    if selfie_bgr is None:
        return {
            'status': 'UNAVAILABLE',
            'match_percentage': None,
            'detail': 'Could not load selfie image for face comparison',
        }

    # ── Extract face regions ───────────────────────────────────────────────────
    try:
        doc_face_bgr = _extract_face_region(doc_bgr)
        selfie_face_bgr = _extract_face_region(selfie_bgr)

        doc_gray = cv2.cvtColor(doc_face_bgr, cv2.COLOR_BGR2GRAY)
        selfie_gray = cv2.cvtColor(selfie_face_bgr, cv2.COLOR_BGR2GRAY)
    except Exception as exc:
        logger.error('Face region extraction error: %s', exc)
        return {
            'status': 'INCONCLUSIVE',
            'match_percentage': None,
            'detail': f'Face region extraction failed: {exc}',
        }

    # ── Compute signals ────────────────────────────────────────────────────────
    try:
        # Signal 1: pHash Hamming distance
        # hash_size=16 → 256 bits. Distance of 0 = identical, ~128 = random.
        hash_size = 16
        hash_a = _phash(doc_gray, hash_size)
        hash_b = _phash(selfie_gray, hash_size)
        hamming_dist = _hamming_distance(hash_a, hash_b)
        max_bits = hash_size * hash_size
        # Similarity = 1 - (distance / max_bits); range [0,1]
        phash_sim = 1.0 - (hamming_dist / max_bits)

        # Signal 2: Histogram correlation
        hist_corr = _hist_similarity(doc_gray, selfie_gray)
        # Normalise to [0,1] (it's already in [-1,1], but practically 0-1 for photos)
        hist_sim = max(0.0, hist_corr)

        # Combined score: weighted average
        combined = (phash_sim * 0.6) + (hist_sim * 0.4)
        match_pct = combined * 100.0

        # Thresholds (tuned empirically for passport-photo to selfie comparison)
        PASS_THRESHOLD = 62.0  # above this → likely same person
        FAIL_THRESHOLD = 40.0  # below this → likely different person
        # Between 40-62 → INCONCLUSIVE (lighting/angle differences)

        logger.info(
            'Face comparison: phash_sim=%.3f hist_sim=%.3f combined=%.3f match_pct=%.1f',
            phash_sim, hist_sim, combined, match_pct,
        )

        if match_pct >= PASS_THRESHOLD:
            status = 'PASSED'
            detail = (
                f'Face match: {match_pct:.1f}% similarity score '
                f'(pHash: {phash_sim * 100:.1f}%, histogram: {hist_sim * 100:.1f}%)'
            )
        elif match_pct < FAIL_THRESHOLD:
            status = 'FAILED'
            detail = (
                f'Face mismatch: {match_pct:.1f}% similarity score — '
                f'document and selfie appear to be different individuals '
                f'(pHash: {phash_sim * 100:.1f}%, histogram: {hist_sim * 100:.1f}%)'
            )
        else:
            status = 'INCONCLUSIVE'
            detail = (
                f'Face verification inconclusive: {match_pct:.1f}% similarity score — '
                f'image quality, lighting, or angle may have affected the result '
                f'(pHash: {phash_sim * 100:.1f}%, histogram: {hist_sim * 100:.1f}%)'
            )

        return {
            'status': status,
            'match_percentage': round(match_pct, 1),
            'detail': detail,
        }

    except Exception as exc:
        logger.error('Face comparison error: %s', exc, exc_info=True)
        return {
            'status': 'INCONCLUSIVE',
            'match_percentage': None,
            'detail': f'Face comparison error: {exc}',
        }
