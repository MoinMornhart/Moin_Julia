# 60 – Julia spricht (Issue #7)

**Datum:** 13.10.2026 · **Version:** 0.50.0 · **Status:** fertig, getestet (Piper-Dienst selbst noch nicht auf echtem Server)

Wunsch von JONIMONI09: „Füge ElevenLabs oder Anbieter hinzu, wo man keine Schlüssel verbinden muss, dass Julia sprechen kann – schaue im Web!“

## Recherche
| Anbieter | Schlüssel | Kosten | Entscheidung |
|---|---|---|---|
| **Piper** (Open Home Foundation, GPL-3.0) | keiner | kostenlos, läuft lokal | **Standard** – als optionaler Zusatzdienst |
| **OpenAI** (gpt-4o-mini-tts) | OpenAI-Schlüssel des Servers (gibt es schon) | nach Verbrauch | dabei |
| **ElevenLabs** | eigener Schlüssel | API laut mehreren Quellen erst in bezahlten Tarifen sinnvoll, kostenlos ca. 10.000 Zeichen/Monat | dabei, optional |

Quellen: github.com/OHF-Voice/piper1-gpl (CLI- und HTTP-Doku) sowie mehrere Preisvergleiche zu ElevenLabs 2026 (Angaben widersprüchlich, deshalb nur optional).

## So funktioniert es
- **`/julia sprich <Frage>`**:
  - Julia beantwortet die Frage wie gewohnt, der Text steht im Chat.
  - Sie kommt in den Sprachkanal der Person, spricht die Antwort und geht wieder.
  - Höchstens 600 Zeichen werden gesprochen. Links, Emojis, Erwähnungen und Markdown werden nicht vorgelesen.
- **Nicht dazwischenfunken:** Ist der Bot im Server schon in einem Sprachkanal (z. B. Musik), gibt es nur den Text plus einen kurzen Hinweis.
- **Dashboard → Julia → „🗣️ Stimme“:**
  - An/aus (ab Werk aus), Anbieter, Stimme (OpenAI-Auswahl, Piper-Stimmenname oder ElevenLabs-Voice-ID), Tempo.
  - **„🔊 Probe hören“** spielt einen Beispielsatz im Browser ab.
  - ElevenLabs-Schlüssel wird verschlüsselt gespeichert, wie die anderen Server-Schlüssel.
  - Die Piper-Adresse kann nur der Instanz-Admin ändern (Adressen im Heimnetz).

## Piper einschalten (kostenlos, ohne Schlüssel)
- Piper läuft als eigener kleiner Docker-Dienst `tts` (Python + deutsche Frauenstimme „Kerstin“, seit 0.52.2; vorher „Thorsten“). Der Bot-Container bleibt schlank.
- Einschalten:
  1. `moin-julia config`
  2. Zeile `COMPOSE_PROFILES=tts` eintragen, speichern.
  3. `update` ausführen.
- Danach findet der Bot ihn unter `http://tts:5000`.
- Alternativ läuft ein Piper-Server auf einem anderen Rechner (`pip install "piper-tts[http]"`, `python3 -m piper.http_server …`). Dessen Adresse trägst du im Dashboard ein.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Text fürs Vorlesen (Markdown/Links/Emojis raus, Kürzen am Satzende) | ✓ neu |
| Piper-Anfrage (Adresse, Stimme, Tempo), Piper nicht erreichbar → Hinweis | ✓ neu |
| OpenAI: Schlüssel nötig, Stimme, Anfrage; ElevenLabs: Schlüssel + Voice-ID, 401 → „Schlüssel ungültig“ | ✓ neu |
| Bot: spricht; ohne Sprachkanal / Bot schon im Sprachkanal → nicht dazwischen; nicht eingerichtet vs. Fehler | ✓ neu |
| Klick-Test: Probe ohne Piper → Hinweis; Stimme an + OpenAI + „onyx“ speichern | ✓ neu |
| Klick-Test 231/231, Seiten-Durchlauf 43 × 2, Bot 296, Shared 166 | ✓ |
| Piper-Docker-Dienst auf echtem Server | offen – kein Docker auf dem Entwicklungsrechner; optionales Profil, stört das normale Update nicht |

## Nachtrag 0.52.3 – „Probe hören“ blieb stumm (Meldung Philip 13.10.)
- **Ursache 1:** Die Sicherheitsregeln des Dashboards (Content-Security-Policy) hatten keine `media-src`-Regel. Deshalb hat der Browser das Probe-Audio (`data:audio/…`) blockiert, und der Fehler wurde verschluckt. Jetzt gilt `media-src 'self' data: blob:`. Klappt das Abspielen trotzdem nicht, steht der Grund im Dashboard.
- **Ursache 2:** Der Piper-Webserver (piper1-gpl) nimmt Anfragen über `POST /` an, nicht über `/synthesize`. Jetzt geht die Anfrage an `/`. Nur wenn es dort 404/405 gibt, weicht sie auf `/synthesize` aus.
- Läuft der Piper-Dienst nicht, steht jetzt direkt dabei, wie man ihn einschaltet (`COMPOSE_PROFILES=tts` in `.env`, dann `update`).
- Getestet: Unit-Tests shared 172 und Bot 296; die CSP-Kopfzeile enthält `media-src`; Klick-Test 237/237. Mit echtem Piper bzw. OpenAI noch ungetestet.
