import os
import cv2
import numpy as np
import base64
import tempfile
from PIL import Image, ImageChops, ImageEnhance
import logging

logger = logging.getLogger(__name__)

def run_ela(image_path: str) -> dict:
    try:
        img = Image.open(image_path).convert('RGB')
        
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            tmp_path = tmp.name
            
        img.save(tmp_path, 'JPEG', quality=90)
        tmp_img = Image.open(tmp_path)
        
        ela_img = ImageChops.difference(img, tmp_img)
        
        extrema = ela_img.getextrema()
        max_diff = max([ex[1] for ex in extrema])
        
        if max_diff == 0:
            max_diff = 1
            
        scale = 255.0 / max_diff
        ela_img = ImageEnhance.Brightness(ela_img).enhance(scale)
        
        # Convert to numpy for cv2 analysis
        ela_cv = np.array(ela_img)
        ela_cv = cv2.cvtColor(ela_cv, cv2.COLOR_RGB2GRAY)
        
        _, thresh = cv2.threshold(ela_cv, int(15.0 * 255/10), 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        suspicious = False
        max_ela_value = np.max(ela_cv)
        suspicious_region = None
        
        # Thresholds:
        # < 30   : normal JPEG recompression noise — not suspicious
        # 30-45  : marginal — could be authentic high-frequency content or mild edit
        # > 45   : elevated — consistent with localized recompression manipulation
        #
        # NOTE: ELA is forensic evidence, not proof. Authentic documents
        # with high-frequency printing (holograms, microprint) may show
        # elevated ELA values. Results are labeled accordingly.
        SUSPICIOUS_THRESHOLD = 45.0
        MARGINAL_THRESHOLD = 30.0
        
        if max_ela_value > SUSPICIOUS_THRESHOLD:
            suspicious = True
            
        if contours:
            largest_contour = max(contours, key=cv2.contourArea)
            x, y, w, h = cv2.boundingRect(largest_contour)
            suspicious_region = {"x": x, "y": y, "w": w, "h": h}
            
        os.remove(tmp_path)
        
        # Create b64 image
        _, buffer = cv2.imencode('.png', ela_cv)
        ela_b64 = base64.b64encode(buffer).decode('utf-8')
        
        if suspicious:
            result_status = "FAILED"
            result_detail = (
                f"ELA detected elevated recompression anomaly (max ELA value: {max_ela_value:.1f}). "
                "Suspicious region identified. Forensic signal: Tampered-like."
            )
        elif max_ela_value > MARGINAL_THRESHOLD:
            result_status = "INCONCLUSIVE"
            result_detail = (
                f"ELA shows marginal anomaly (max ELA value: {max_ela_value:.1f}). "
                "May reflect high-frequency authentic content (holograms, microprint) or mild manipulation. "
                "Forensic signal: Inconclusive."
            )
        else:
            result_status = "PASSED"
            result_detail = (
                f"ELA shows normal recompression noise pattern (max ELA value: {max_ela_value:.1f}). "
                "No elevated manipulation evidence detected."
            )
        
        return {
            "status": result_status,
            "suspicious": suspicious,
            "max_ela_value": float(max_ela_value),
            "suspicious_region": suspicious_region,
            "ela_image_b64": ela_b64,
            "detail": result_detail
        }
    except Exception as e:
        logger.error(f"ELA failed: {e}")
        return {
            "status": "INCONCLUSIVE",
            "suspicious": False,
            "max_ela_value": 0.0,
            "suspicious_region": None,
            "ela_image_b64": "",
            "detail": "Error during ELA analysis"
        }
