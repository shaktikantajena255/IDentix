FROM python:3.12-slim

# Install system dependencies (Tesseract OCR + OpenCV libs) as root
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements from backend directory (works when Docker context = repo root)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/ .

# Run the FastAPI server
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}
