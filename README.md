# IDentix

**AI-Powered, Cybersecurity-First Document Verification System for Border Checkpoint Officers**

Built for Smart India Hackathon — Problem Statement **SIH26188** (Theme: Blockchain & Cybersecurity)

---

## Overview

IDentix is an offline-first, officer-facing web application that helps border checkpoint officers verify the authenticity of travel documents (passports, IDs) in real time. It combines OCR, MRZ validation, computer-vision tamper detection, facial verification, and a mock watchlist check into a single explainable screening pipeline — producing a clear, auditable risk verdict instead of a black-box score.

The system is designed around one core principle: **every decision must be explainable**. There is no opaque, end-to-end ML "trust score" — each check is independently verifiable, and the final risk score is a transparent, rule-based formula rather than a trained model.

---

## Key Features

- 🔍 **9-step explainable screening pipeline** — every document runs through preprocessing, OCR/MRZ extraction, checksum validation, cross-field checks, expiry validation, dual-signal tamper detection, face verification, and watchlist screening, in a fixed, auditable order
- 🧾 **Four-state verdict system** — PASSED / FAILED / INCONCLUSIVE / UNAVAILABLE on every check, with an automatic "Insufficient Evidence — Manual Verification Required" fallback instead of a forced guess
- 🕵️ **Dual-signal tamper detection** — combines a deterministic OpenCV ELA check with a Random Forest ML model, showing both signals separately rather than merging them into a black box
- 👤 **Mandatory face verification** — no skip option anywhere in the flow, powered by `face_recognition` (dlib-based) matching
- 🧮 **Transparent, rule-based risk scoring** — Face Match (40%) + Tamper (35%) + OCR/Cross-field (25%), with a hard override that clamps the score to 90+ on MRZ checksum failure or a watchlist match
- ⛓️ **Tamper-evident audit trail** — every verification event is SHA-256 hash-chained, with a built-in `verify_chain_integrity()` check
- 🔐 **Field-level encryption** — sensitive fields (`document_number`, `extracted_name`) encrypted at rest with Fernet
- 🔑 **JWT + bcrypt officer authentication** — simple, secure login without biometric complexity
- 📡 **Offline-first architecture** — OCR, tamper detection, and face verification all run with zero internet dependency; only watchlist sync degrades gracefully when offline
- 📄 **One-click Investigation Report** — generates a per-case PDF (ReportLab) summarizing every check and the final verdict
- ⏱️ **Speed-comparison timer** — tracks and displays "time saved today" versus manual document verification
- 🖥️ **Officer dashboard** — Dashboard, New Screening, History, Alerts, Analytics, and Settings, all in one clean sidebar-driven UI
- 🧪 **Realistic synthetic test suite** — 8 watermarked, fictional test documents covering every pipeline branch, run through the exact same upload/camera flow as real documents (no separate demo mode)

---

## Key Design Principles

- **Explainable over black-box** — the risk engine is a weighted, rule-based formula, not an ML-trained risk model. Officers can see exactly why a document was flagged.
- **Never guess, never crash** — every check resolves to one of four explicit states, and any component failure degrades gracefully instead of forcing a verdict or crashing the app.
- **Offline-first** — all AI processing (OCR, tamper detection, face verification) runs with zero internet dependency. Only the watchlist sync can fail gracefully when offline.
- **Security by default** — hash-chained audit logs, field-level encryption, and JWT-based auth are built in, not bolted on.
- **Scoped tightly** — this is a single-document screening tool for one officer-facing app. It intentionally does not attempt cross-document identity graphs, real government database integration, or a traveler-facing app.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Tailwind CSS |
| Backend | Python + FastAPI + Uvicorn |
| Database | SQLite — `verification_records`, `blacklist_cache`, `officers`, `sync_queue` |
| OCR | Tesseract (`pytesseract`) |
| Tamper Detection | OpenCV (Error Level Analysis) + a Random Forest model (14-dim forensic feature vector) as a second signal |
| Face Verification | `face_recognition` (dlib-based) |
| Auth | JWT + bcrypt |
| Audit Trail | SHA-256 hash-chain, with `verify_chain_integrity()` |
| Encryption | Fernet (applied to `document_number` and `extracted_name`) |
| Reports | ReportLab (PDF generation) |

---

## Screening Pipeline

Every document passes through the following steps, in this exact order:

1. **Image Preprocessing**
2. **Document Type Detection**
3. **OCR + MRZ Extraction**
4. **MRZ Checksum Validation** (ICAO 9303, 7-3-1 modulus — deterministic, rule-based)
5. **Cross-Field Validation** (VIZ vs. MRZ consistency)
6. **Document Validity Check** (expiry vs. today)
7. **Tamper Detection** — "Forensic Evidence Heatmap" (ELA + ML dual signal)
8. **Face Verification** (mandatory — no skip option)
9. **Mock Watchlist Check**

### The Four-State Model

Every individual check resolves to exactly one of:

| State | Meaning |
|---|---|
| ✅ **PASSED** | Check ran and confirmed validity |
| ❌ **FAILED** | Check ran and found a definite problem |
| ⚠️ **INCONCLUSIVE** | Check ran but couldn't reach a confident verdict |
| ⏸️ **UNAVAILABLE** | Check couldn't run at all (e.g., offline, model unavailable) |

> **UNAVAILABLE is never treated as FAILED.** If two or more checks land as INCONCLUSIVE or UNAVAILABLE, the system does not force a verdict — it instead returns:
> **"Insufficient Evidence — Manual Verification Required."**

### Tamper Detection: Dual-Signal Design

The Forensic Evidence Heatmap combines two independent signals:

- **Rule-Based (ELA):** OpenCV Error Level Analysis — deterministic, explainable
- **ML Model (Random Forest):** trained on a real passport dataset + synthetically tampered variants, using a 14-dimensional forensic feature vector (ELA stats, texture, edge density, color/HSV, blur/noise, geometry)

| ELA Result | ML Result | Combined Outcome |
|---|---|---|
| Tampered | Tampered | **FAILED** |
| Tampered | Genuine | **INCONCLUSIVE** ("ELA and ML model disagree") |
| Genuine | Tampered | **INCONCLUSIVE** ("ELA and ML model disagree") |
| Genuine | Genuine | **PASSED** |
| Any | Model fails to load | **UNAVAILABLE** for the ML signal → falls back to ELA-only result |

Both signals are shown separately on the results screen — the officer sees both the rule-based verdict and the ML model's tampering probability, never a merged black box.

---

## Explainable Risk Engine

The final risk score is a **transparent weighted formula** — not a trained ML model:

```
Risk Score = (Face Match × 40%) + (Tamper Signal × 35%) + (OCR / Cross-Field × 25%)
```

| Score Range | Tier | Color |
|---|---|---|
| 0–25 | CLEAR | 🟢 Green |
| 26–65 | REVIEW | 🟡 Amber |
| 66–100 | HIGH RISK | 🔴 Red |

**Hard override:** If the MRZ checksum fails, or the document matches the watchlist, the score is automatically clamped to **90+**, regardless of how other checks score — this is a security guarantee, not something that can be diluted by averaging.

---

## Security & Integrity

- **Hash-chain audit log** — every verification event is chained via SHA-256, so any tampering with historical records is detectable via `verify_chain_integrity()`.
- **Field-level encryption** — `document_number` and `extracted_name` are encrypted at rest using Fernet.
- **Authentication** — officer accounts use JWT + bcrypt (no biometric officer login; this is intentionally out of scope).

---

## What This Project Deliberately Does *Not* Do

To keep the system tightly scoped for the hackathon problem statement, IDentix does **not** include:

- A traveler-facing app or QR-based document transfer
- A marketing website or separate "Authority Portal"
- Multi-document cross-referencing or a full identity graph/timeline
- Real blockchain integration or real government database connectivity
- Heavy pretrained models (YOLO, ArcFace-ResNet100, MiniFASNet, Grad-CAM)
- A separate "Demo Lab" UI — all test documents (including synthetic ones) go through the same upload/camera flow as real documents

---

## Testing

The project is validated using a set of **8 fictional, watermarked synthetic test documents** ("SYNTHETIC TEST DOCUMENT"), built on a fictional country template with valid ICAO 9303 MRZ structure and placeholder (non-real) faces, covering:

1. Genuine — passes all checks
2. Tampered — fails Tamper Detection
3. DOB mismatch — fails Cross-Field Validation
4. Face mismatch — fails Face Verification
5. Expired — fails Document Validity
6. MRZ checksum failure — deliberately invalid check digit
7. Watchlist match — hard-override case
8. Insufficient evidence — exercises the "Manual Verification Required" path

All test documents flow through the same upload/camera pipeline as real documents — there is no special test mode.

---

## Additional Features

- **Investigation Report export** — generates a per-case PDF report (ReportLab) for documentation and follow-up.
- **Speed comparison** — a timer and "time saved today" counter, quantifying the efficiency gain over manual verification.
- **Officer dashboard** — with sidebar navigation across Dashboard, New Screening, History, Alerts, Analytics, and Settings.

---

## Status

Core pipeline is functional end-to-end (Document Type, OCR & Field Extraction, MRZ Checksum, Tamper Detection, Face Verification, and Watchlist Check all verified working). Current focus: dual-signal tamper detection (ELA + ML) integration and OCR field-extraction robustness improvements.

---

## Project Structure

```
identix/
├── backend/
│   ├── main.py                    # FastAPI entry point
│   ├── pipeline.py                # Orchestrates the 9-step screening pipeline
│   ├── ocr.py                     # OCR + MRZ field extraction
│   ├── tamper.py                  # ELA + ML dual-signal tamper detection
│   ├── document_authenticity.py   # Random Forest tamper model wrapper
│   ├── face.py                    # Face verification logic
│   ├── security.py                # Hash-chain, encryption helpers
│   ├── auth.py                    # JWT + bcrypt authentication
│   ├── database.py                # SQLite models/queries
│   ├── report.py                  # PDF investigation report generation
│   ├── models/                    # Trained model files (.pkl / .joblib)
│   ├── ocr_ml/                    # Supporting ML-assisted OCR/field-classification code
│   └── requirements.txt
└── frontend/
    ├── src/
    └── ...                        # React + Tailwind officer dashboard
```

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js + npm
- Tesseract OCR installed and available on PATH

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

By default the backend serves the API (FastAPI/Uvicorn) and the frontend connects to it for the officer dashboard and screening flow.

---

## Why This Approach

Most document-verification demos lean entirely on a single trained model producing a confidence score — fast to build, but hard to trust in a security context because the reasoning is opaque. IDentix instead treats ML as **one input among several explainable checks**, keeps every security-critical decision (MRZ checksum, risk-tier thresholds, hard overrides) deterministic and rule-based, and never lets a model silently produce a false sense of certainty — if a signal can't be trusted, the system says so (`UNAVAILABLE`/`INCONCLUSIVE`) rather than guessing.

---

## Team & Acknowledgments

Built for Smart India Hackathon 2026, Problem Statement SIH26188 (Blockchain & Cybersecurity theme). Tamper-detection Random Forest model trained by a teammate on a Hugging Face passport dataset with synthetic tampering augmentation.

---

## License

Internal hackathon project — license to be determined by the team before any public release.
