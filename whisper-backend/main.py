import os
import tempfile
import traceback
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# whisper library (openai-whisper)
import whisper

# Configuration
MODEL_SIZE = os.getenv("MODEL_SIZE", "base")  # tiny, base, small, medium, large
# Comma-separated list for allowed origins; if not set, allow all (dev convenience)
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")

app = FastAPI(title="Whisper Transcription API")

# CORS configuration
if ALLOWED_ORIGINS == "*" or not ALLOWED_ORIGINS:
    allow_origins = ["*"]
else:
    # expect comma-separated origins in env var, e.g. "http://localhost:5173,http://127.0.0.1:5173"
    allow_origins = [o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the Whisper model once at startup
print(f"Loading Whisper model '{MODEL_SIZE}' (this may take a while on first run)...")
model = whisper.load_model(MODEL_SIZE)
print("Whisper model loaded.")

@app.get("/")
async def root():
    return {"status": "ok", "model": MODEL_SIZE}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/transcribe/")
async def transcribe(file: UploadFile = File(...)):
    """
    Accepts multipart file upload (field name 'file').
    Returns JSON: {"transcript": "..."}
    Notes:
      - Whisper uses ffmpeg under the hood to read many formats (webm, mp3, wav, m4a, ...).
      - Ensure ffmpeg is installed and on PATH on your machine.
    """
    # Basic content-type allowance — accept audio files (loosely)
    content_type: Optional[str] = file.content_type
    if content_type and not content_type.startswith("audio"):
        # still allow (server/ffmpeg can handle many), but warning
        print(f"Warning: uploaded content type is {content_type}")

    tmp_path = None
    try:
        # Save uploaded file to a temporary file
        suffix = os.path.splitext(file.filename or "")[1] or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        # Run transcribe (blocking). Whisper will call ffmpeg internally to open the file.
        try:
            result = model.transcribe(tmp_path)
            transcript = result.get("text", "")
        except Exception as e:
            tb = traceback.format_exc()
            print("Transcription error:\n", tb)
            raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

        return {"transcript": transcript}
    finally:
        # Ensure temporary file is removed
        try:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass