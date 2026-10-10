# 35 – Eigene API-Schlüssel pro Server + weitere KI-Anbieter

**Datum:** 10.10.2026 · **Version:** 0.31.0 · **Status:** fertig und getestet

Philips Wunsch: Jeder soll seinen eigenen API-Schlüssel verwenden können. Dazu sollen Gemini, ChatGPT und „alles Mögliche“ gehen.

## Neu
- **Neue Anbieter:**
  - Google Gemini, OpenAI (ChatGPT), OpenRouter, Groq, Mistral und xAI (Grok).
  - Dazu „Eigene Adresse“ für alles mit OpenAI-kompatibler Schnittstelle (z. B. LM Studio, vLLM, LocalAI).
- **Eigene Schlüssel pro Server** (Julia → Verbindung → „🔑 Eigene Schlüssel für diesen Server“):
  - Jeder Server-Admin trägt dort seinen Schlüssel ein und zahlt dann selbst beim Anbieter.
  - Der Schlüssel wird beim Speichern geprüft (Modell-Liste laden).
  - Er wird verschlüsselt gespeichert; im Browser erscheint nur ••••1234.
- **Claude:** Hat ein Server einen eigenen Claude-Schlüssel, nutzt er diesen. Sonst gilt der Schlüssel der Instanz wie bisher.
- **Einstellungen:**
  - Anbieter wählen; für die neuen Anbieter ein Modell-Feld mit „Modelle laden“ (leer = Standard des Anbieters).
  - Auch jeder Modus kann ein eigenes Modell haben.
- **Verbrauch:** Bei Gemini & Co. zeigt die Übersicht Antworten und Tokens. Die Kosten rechnet der Anbieter direkt ab.

## Entscheidungen (von Philip zu bestätigen)
- **„Eigene Adresse“ darf nur der Instanz-Admin eintragen.** Sonst könnte ein fremder Server-Admin den Bot Adressen im Heimnetz der Instanz abrufen lassen.
- **Twitch & Co. pro Server** kommt mit dem Twitch-Umbau (eigenes Modul), weil dort ohnehin alles neu gebaut wird.
- **Standard-Modelle** sind nur Startwerte: gemini-2.5-flash, gpt-4.1-mini, openrouter/auto, llama-3.3-70b-versatile, mistral-small-latest, grok-3-mini. „Modelle laden“ zeigt, was es beim Anbieter wirklich gibt.

## Technik
- Alle neuen Anbieter sprechen die OpenAI-kompatible Schnittstelle (`/chat/completions`, `/models`). Gemini nutzt dafür seinen offiziellen OpenAI-Zugang.
- Neue Tabelle `GuildSecret` (Server, Schlüsselname, verschlüsselter Wert), Migration idempotent.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Anfrage richtig aufgebaut (System zuerst, Bearer-Schlüssel), `<think>` entfernt, Tokens gezählt | ✓ neu |
| Fehler verständlich: Schlüssel falsch, Limit/Guthaben, Modell unbekannt, nicht erreichbar | ✓ neu |
| Modell-Liste sortiert, Gemini-Präfix entfernt; ungültige Adresse wird abgelehnt | ✓ neu |
| Bot: Gemini mit Server-Schlüssel antwortet, kein Schlüssel → „nicht verbunden“, eigener Claude-Schlüssel vor Instanz-Schlüssel | ✓ neu |
| Klick-Test: Gemini-Schlüssel speichern (nur maskiert), als Anbieter mit Modell wählen, wieder entfernen | ✓ neu |
| Klick-Test 178/178, Seiten-Durchlauf 42 × 2, Bot 213, Shared 117, DB 6 | ✓ |
