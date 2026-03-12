import os
import tempfile
import traceback
from typing import Optional
import shutil

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware

# faster-whisper library (CTranslate2)
from faster_whisper import WhisperModel

# 1. FFmpeg Check (Crucial for Windows)
if not shutil.which("ffmpeg"):
    print("CRITICAL ERROR: ffmpeg is not installed or not in PATH!")
    print("Whisper cannot run without it.")
else:
    print(f"ffmpeg found at: {shutil.which('ffmpeg')}")

# Configuration
MODEL_SIZE = os.getenv("MODEL_SIZE", "base")  # tiny, base, small, medium, large
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")

SUPPORTED_LANGUAGES = {"en", "hi", "mr", "ta", "te", "ja"}

app = FastAPI(title="Whisper Transcription API")

# CORS configuration
if ALLOWED_ORIGINS == "*" or not ALLOWED_ORIGINS:
    allow_origins = ["*"]
else:
    allow_origins = [o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (good for development)
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Load the Faster-Whisper model once at startup
print(f"Loading Faster-Whisper model '{MODEL_SIZE}' (this may take a while on first run)...")
# Run on CPU by default for broader compatibility, use 'cuda' if GPU is guaranteed
model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
print("Faster-Whisper model loaded.")

@app.get("/")
async def root():
    return {"status": "ok", "model": MODEL_SIZE}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/transcribe/")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None), # <--- New: Accepts language code (e.g., 'hi', 'en')
    prompt: Optional[str] = Form(None)    # <--- New: Accepts context prompt to fix hallucinations
):
    """
    Accepts multipart file upload (field name 'file').
    Optional fields: 'language' (ISO code) and 'prompt' (string).
    Returns JSON: {"transcript": "...", "detected_language": "..."}
    """
    
    # Basic content-type allowance
    content_type: Optional[str] = file.content_type
    if content_type and not content_type.startswith("audio"):
        print(f"Warning: uploaded content type is {content_type}")

    tmp_path = None
    try:
        # Save uploaded file to a temporary file
        suffix = os.path.splitext(file.filename or "")[1] or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        # --- NEW LOGIC START ---
        options = {}
        
        # 1. Apply Language if provided (and not 'auto')
        if language and language != "auto":
            if language not in SUPPORTED_LANGUAGES:
                raise HTTPException(status_code=400, detail=f"Unsupported language code: {language}")
            options["language"] = language
            print(f"Processing with forced language: {language}")
        
        # 2. Apply Prompt if provided
        if prompt:
            options["initial_prompt"] = prompt
            print(f"Processing with context prompt: {prompt[:50]}...")

        # Run transcribe with these options
        try:
            # We unpack **options into the transcribe method
            segments, info = model.transcribe(tmp_path, **options)
            
            # faster-whisper returns a generator, so we must iterate
            text_segments = []
            for segment in segments:
                text_segments.append(segment.text)
                
            transcript = "".join(text_segments).strip()
            detected_lang = info.language
            
            print(f"Success. Detected: {detected_lang}")

            return {
                "transcript": transcript,
                "detected_language": detected_lang
            }
        # --- NEW LOGIC END ---

        except Exception as e:
            tb = traceback.format_exc()
            print("Transcription error:\n", tb)
            raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    finally:
        # Ensure temporary file is removed
        try:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass