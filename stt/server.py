"""Spracherkennung für „Mit Julia im Call reden“ – lokal, ohne Schlüssel (faster-whisper).

OpenAI-kompatibel: POST /v1/audio/transcriptions (multipart: file, language) → {"text": "..."}.
Audio wird nur im Speicher verarbeitet und nicht gespeichert.
"""

import io
import os

from fastapi import FastAPI, File, Form, UploadFile
from faster_whisper import WhisperModel

MODEL = os.environ.get("STT_MODEL", "base")
model = WhisperModel(MODEL, device="cpu", compute_type="int8", download_root="/models")
app = FastAPI()


@app.get("/health")
def health() -> dict:
    return {"ok": True, "model": MODEL}


@app.post("/v1/audio/transcriptions")
async def transcribe(file: UploadFile = File(...), language: str = Form("de"), model_name: str = Form("whisper", alias="model")) -> dict:
    data = await file.read()
    if len(data) > 5_000_000:
        return {"text": ""}
    segments, _ = model.transcribe(io.BytesIO(data), language=language or "de", beam_size=1, vad_filter=True)
    return {"text": " ".join(s.text.strip() for s in segments).strip()}
