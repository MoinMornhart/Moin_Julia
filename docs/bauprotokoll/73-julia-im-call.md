# 73 – Mit Julia im Call reden (Wunsch Philip)

**Datum:** 14.10.2026 · **Version:** 0.60.0 · **Status:** fertig; Unit-Tests grün. **Mit echtem Discord-Call, Whisper-Dienst und KI noch nicht ausprobiert.**

Wunsch: „Dass man richtig mit ihr sprechen kann – sie bleibt im Call und hört zu.“

## So geht es
1. Julias **Stimme einschalten** (Dashboard → Julia → Stimme).
2. **Spracherkennung wählen** (gleiche Karte):
   - **Whisper auf deinem Server:** kostenlos, ohne Schlüssel. Dafür in `.env` `COMPOSE_PROFILES=tts,stt` eintragen und `update` ausführen. Der Zusatzdienst braucht ca. 1 GB Platz.
   - **OpenAI:** mit dem OpenAI-Schlüssel des Servers.
3. Im Sprachkanal: **`/julia gespraech aktion:starten`**.
   - Julia kommt dazu und sagt an: „Hallo! Ich bin Julia und höre jetzt zu. Sagt ‚Julia' und dann eure Frage.“
   - Im Textkanal steht derselbe Hinweis.
4. **„Julia, wie wird das Wetter morgen?“** → Julia antwortet mit Stimme. Frage und Antwort stehen zusätzlich im Textkanal.
5. **Ende:** `/julia gespraech aktion:beenden`.
   - Beenden darf jede Person im selben Sprachkanal und alle mit „Kanäle verwalten“.
   - Julia geht außerdem von selbst, wenn 5 Minuten keine Frage kam, wenn niemand mehr im Kanal ist oder wenn die Wartung beginnt.

## Datenschutz (fest eingebaut)
- **Nur auf Befehl**, mit **Ansage** in Stimme und Text.
- Julia reagiert **nur auf Sätze, die mit „Julia“ beginnen** (auch „Hey Julia …“). Alles andere wird erkannt und **sofort verworfen**: kein Text, keine Antwort.
- **Nichts wird gespeichert.** Audio liegt nur kurz im Speicher (höchstens 15 s pro Satz) und geht an die Spracherkennung. Bei „lokal“ verlässt es den eigenen Server nicht.
- Es gelten dieselben Regeln wie im Chat: Limits pro Person, Monatsbudget, Sperrlisten, Sicherheitsregeln.
- Läuft schon Musik (der Bot ist im Sprachkanal), startet kein Gespräch.

## Technik
- `packages/shared/src/config/julia-listen.ts`:
  - Weckwort-Erkennung (mit Tippfehlern, nur am Anfang);
  - 48 kHz Stereo → 16 kHz Mono WAV;
  - Spracherkennung, OpenAI-kompatibel (`/v1/audio/transcriptions`).
- `apps/bot/src/modules/julia/conversation.ts`:
  - Sitzung pro Server;
  - Discord-Empfang (`receiver.subscribe`, Satzende nach 0,9 s Stille);
  - Opus → PCM mit `opusscript`;
  - Antwort über denselben Player, ohne neu beizutreten.
- `stt/`: kleiner Whisper-Dienst (faster-whisper, Modell „base“, `STT_MODEL` änderbar), Docker-Profil `stt`.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Weckwort (nur am Satzanfang, „Hey Julia“, „Julie“), WAV-Umwandlung, Spracherkennung lokal/OpenAI/nicht erreichbar | ✓ neu |
| Bot: Satz mit „Julia …“ → fragen + Text + Stimme; ohne Weckwort oder zu kurz → nichts | ✓ neu |
| Unit shared 194, Bot 309, Klick-Test 256/256 (inkl. Auswahl Spracherkennung), Seiten-Durchlauf 43 × 2 | ✓ |
| Echter Call, Whisper-Container, Ansage | ⏳ bitte bei dir ausprobieren |
