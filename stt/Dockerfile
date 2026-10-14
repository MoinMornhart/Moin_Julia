# Whisper – kostenlose, lokale Spracherkennung für „Mit Julia im Call reden“ (optional, Docker-Profil „stt“)
# Einschalten: in .env  COMPOSE_PROFILES=tts,stt  eintragen, dann  update
# Braucht etwa 1 GB Platz und spürbar CPU; Modell über STT_MODEL wählbar (tiny, base, small – größer = genauer, langsamer)
FROM python:3.12-slim
RUN pip install --no-cache-dir "faster-whisper<2" "fastapi<1" "uvicorn<1" "python-multipart<1" \
 && useradd --system --uid 10001 stt \
 && mkdir -p /models /app && chown stt /models
COPY server.py /app/server.py
USER stt
ENV STT_MODEL=base
# Modell beim Bauen laden, damit der erste Satz nicht minutenlang dauert
RUN python3 -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8', download_root='/models')"
WORKDIR /app
EXPOSE 8000
CMD ["python3", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
