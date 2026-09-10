## IDentix

> **Identity & Document Screening** — Offline-first AI-assisted checkpoint screening platform

---

## Quick Start (Development)

Open **two separate terminals** in the `identix/` directory.

### Terminal 1 — Backend (FastAPI)

```powershell
cd backend
pip install -r requirements.txt
pip install aiosqlite
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

API docs available at: [http://127.0.0.1:8000/api/docs](http://127.0.0.1:8000/api/docs)

### Terminal 2 — Frontend (Vite + React)

```powershell
cd frontend
npm install
npm run dev
```

Application available at: [http://localhost:5173](http://localhost:5173)

---

## Project Structure

```
identix/
├── shared/               # Shared TypeScript domain types
│   └── types.ts
├── frontend/             # React + Vite + Tailwind CSS PWA
│   ├── public/
│   │   ├── manifest.json # PWA web manifest
│   │   └── sw.js         # Service Worker (offline caching)
│   └── src/
│       ├── App.tsx       # Router — all 21 pages wired
│       ├── components/common/
│       ├── hooks/
│       ├── layouts/
│       ├── pages/
│       │   ├── officer/  # 7 Officer Portal pages
│       │   ├── admin/    # 8 Admin Portal pages
│       │   └── traveller/# 6 Traveller Vault pages
│       └── services/
│           └── db.ts     # Dexie IndexedDB (offline storage)
├── backend/              # Python FastAPI
│   ├── main.py
│   ├── requirements.txt
│   └── app/
│       ├── api/v1/
│       ├── core/         # config, database, security
│       ├── models/       # SQLAlchemy ORM
│       ├── schemas/      # Pydantic DTOs
│       └── utils/        # audit (SHA-256 chain)
├── start_backend.ps1
└── start_frontend.ps1
```

---

## Portals

| Portal | URL | Role |
|---|---|---|
| Officer Portal | `/officer/dashboard` | Checkpoint officer — screening, alerts, history |
| Admin Portal | `/admin/overview` | Supervisor — RBAC, watchlist, audit, sync |
| Traveller Vault | `/vault` | Traveller — document storage, QR transfer |

---

## Phase Status

| Phase | Description | Status |
|---|---|---|
| **Phase 1** | UI architecture, routing, IndexedDB, PWA, FastAPI foundation | ✅ **Complete** |
| Phase 2 | Document capture — upload, webcam, drag-drop | ⏳ Next |
| Phase 3 | OCR (PaddleOCR) + MRZ extraction (ICAO 9303) | Pending |
| Phase 4–14 | Forensics, biometrics, watchlist, risk engine, vault, sync | Pending |
