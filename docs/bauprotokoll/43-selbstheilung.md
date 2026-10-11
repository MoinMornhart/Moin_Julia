# 43 – Selbstheilung

**Datum:** 11.10.2026 · **Version:** 0.38.0 · **Status:** fertig und getestet

Philips Wunsch: „Baue Julia eine Art Selbstreparatur ein, dass sie sich selbst fixen kann bei einem Bug oder so.“

## Entscheidung (von Philip zu bestätigen)
Umgesetzt als **Selbstheilung**: Der Bot erkennt typische Hänger und behebt sie selbst. **Nicht** umgesetzt: dass die KI ihren eigenen Programmcode umschreibt. Auf einem öffentlichen Bot könnte sonst jemand Julia per Chat dazu bringen, sich Schadcode einzubauen.

## Was der Bot jetzt selbst repariert
| Problem | Vorher | Jetzt |
|---|---|---|
| Eine Prüf-Runde hängt (z. B. Twitch-Abfrage antwortet nie) | Das Modul blieb bis zum Neustart **für immer still** (Sperre gegen Doppelstart wurde nie frei) | Nach einer Höchstdauer wird die Runde abgelöst und neu gestartet. Gilt für Social Media (5 min), Statistik-Speichern (1 min), Statistik-Kanäle (3 min), Giveaways/Erinnerungen/Geburtstage (2 min), Voice-XP (5 min) |
| Musik-Player steht still, obwohl ein Titel aktiv ist | Stille bis jemand „Skip“ drückt | Wächter alle 30 s: zweimal hintereinander Stillstand → weiter mit dem nächsten Titel |
| Sprachverbindung bricht weg | Player räumte alles ab, die Warteschlange war weg | Neu verbinden (bis 2-mal), der Titel läuft an derselben Stelle weiter |
| Ollama-Server nicht erreichbar | Julia meldete einen Fehler | Julia versucht die anderen eingetragenen Ollama-Server der Reihe nach |

Dazu (schon vorher vorhanden): Ein Lied, das mittendrin abbricht, setzt wieder an (0.34.0). Ein unerwarteter Fehler führt zu einem sauberen Neustart (0.28.0). Bei einem fehlerhaften Update rollt `update` automatisch zurück.

## Bericht
Jede Heilung landet im Dashboard unter **System → 🩹 Selbstheilung** (Zeit, Bereich, Problem → was getan wurde; die letzten 50, 30 Tage). Zusätzlich steht sie im Bot-Log.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Hängende Runde: vorher kein Doppelstart, nach Höchstdauer abgelöst + gemeldet, danach normal | ✓ neu |
| Fehler in einer Runde gibt die Sperre frei | ✓ neu |
| Bericht: neueste zuerst, höchstens 50 | ✓ neu |
| Musik: zweimal Stillstand → nächster Titel | ✓ neu |
| Julia: Ollama-Server weg → nächster Server antwortet, Heilung gemeldet | ✓ neu |
| Klick-Test: Bericht auf der System-Seite; 190/190; Seiten-Durchlauf; Bot 243 | ✓ |
