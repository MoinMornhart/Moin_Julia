# Piper – kostenlose, lokale Sprachausgabe für „Julia spricht“ (optional, Docker-Profil „tts“)
# Einschalten: in .env  COMPOSE_PROFILES=tts  eintragen, dann  update
FROM python:3.12-slim
RUN pip install --no-cache-dir "piper-tts[http]<2" \
 && useradd --system --uid 10001 piper \
 && mkdir -p /voices && chown piper /voices
USER piper
# Deutsche Frauenstimme „Kerstin“ (Julia ist eine Frau) (weitere Stimmen: https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/VOICES.md)
RUN python3 -m piper.download_voices de_DE-kerstin-low --data-dir /voices
EXPOSE 5000
CMD ["python3", "-m", "piper.http_server", "-m", "de_DE-kerstin-low", "--data-dir", "/voices", "--host", "0.0.0.0", "--port", "5000"]
