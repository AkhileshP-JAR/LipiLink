import os

# Fix for Windows OS: Prevents HuggingFace from crashing due to Symlink Privileges (WinError 1314)
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS"] = "1"

import tempfile
import traceback
from typing import Optional
import shutil

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware

from faster_whisper import WhisperModel
from transformers import AutoModel
import torch
import librosa

# 1. FFmpeg Check (Crucial for Windows)
if not shutil.which("ffmpeg"):
    print("CRITICAL ERROR: ffmpeg is not installed or not in PATH!")
    print("Whisper cannot run without it.")
else:
    print(f"ffmpeg found at: {shutil.which('ffmpeg')}")

# Configuration
MODEL_SIZE = os.getenv("MODEL_SIZE", "base")  # tiny, base, small, medium, large
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")
SUPPORTED_LANGUAGES = {"en", "hi", "mr", "ta", "te", "gu", "bn", "ja"}

app = FastAPI(title="Transcription API (Smart Router)")

# CORS configuration
if ALLOWED_ORIGINS == "*" or not ALLOWED_ORIGINS:
    allow_origins = ["*"]
else:
    allow_origins = [o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# LOAD MODELS ON STARTUP
# ---------------------------------------------------------
print(f"Loading Faster-Whisper model '{MODEL_SIZE}'...")
whisper_model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
print("Faster-Whisper model loaded.")

AI4BHARAT_MODEL_NAME = "ai4bharat/indic-conformer-600m-multilingual"
print(f"Loading AI4Bharat model '{AI4BHARAT_MODEL_NAME}' (Will require trust_remote_code)...")
# Custom Conformer model loading natively processes audio without external processors
ai4bharat_model = AutoModel.from_pretrained(AI4BHARAT_MODEL_NAME, trust_remote_code=True)
ai4bharat_model.eval()
print("AI4Bharat model loaded.")

# ---------------------------------------------------------
# AI4BHARAT HELPERS (Using Librosa to bypass torchaudio crash)
# ---------------------------------------------------------
def load_audio(path):
    # librosa automatically handles mono conversion and 16000Hz resampling
    speech_array, _ = librosa.load(path, sr=16000, mono=True)
    # The conformer model expects shape (1, num_samples)
    return torch.from_numpy(speech_array).unsqueeze(0)

def transcribe_ai4bharat(path, lang_code):
    wav = load_audio(path)
    
    # Use the custom inference method exposed by indic-conformer
    # You can change "ctc" to "rnnt" for better accuracy if preferred
    with torch.no_grad():
        transcription = ai4bharat_model(wav, lang_code, "ctc")
        
    # the model returns a list of texts for batches: ['transcript']
    temp_text = transcription[0] if isinstance(transcription, list) else str(transcription)
    return temp_text.replace("  ", " ").strip()

# ---------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------
@app.get("/")
async def root():
    return {"status": "ok", "whisper_model": MODEL_SIZE, "indic_model": AI4BHARAT_MODEL_NAME}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/transcribe/")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    prompt: Optional[str] = Form(None)
):
    """
    Smart Router: 
    - Hindi, English, Japanese, auto -> Whisper
    - Marathi, Tamil, Telugu, Gujarati, Bengali -> AI4Bharat
    """
    content_type: Optional[str] = file.content_type
    if content_type and not content_type.startswith("audio"):
        print(f"Warning: uploaded content type is {content_type}")

    tmp_path = None
    try:
        suffix = os.path.splitext(file.filename or "")[1] or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        # Smart Routing Logic
        if language and language != "auto":
            if language not in SUPPORTED_LANGUAGES:
                raise HTTPException(status_code=400, detail=f"Unsupported language code: {language}")

        # Choose Engine
        use_whisper = (language in ["hi", "en", "ja", "auto", None])
        
        if use_whisper:
            options = {}
            if language and language != "auto":
                options["language"] = language
            if prompt:
                options["initial_prompt"] = prompt
                
            print(f"Routing to Faster-Whisper (Lang: {language})")
            segments, info = whisper_model.transcribe(tmp_path, **options)
            
            text_segments = []
            for segment in segments:
                text_segments.append(segment.text)
                
            transcript = "".join(text_segments).strip()
            detected_lang = info.language
            engine = "faster-whisper"
        else:
            print(f"Routing to AI4Bharat (Lang: {language})")
            transcript = transcribe_ai4bharat(tmp_path, language)
            detected_lang = language
            engine = "ai4bharat"

        print(f"Success. Engine: {engine}, Detected/Routed: {detected_lang}")

        return {
            "transcript": transcript,
            "detected_language": detected_lang,
            "engine": engine
        }

    except Exception as e:
        tb = traceback.format_exc()
        print("Transcription error:\n", tb)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    finally:
        try:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass