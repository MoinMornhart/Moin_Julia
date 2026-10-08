# 20 – Musik (wie Euphony)

**Datum:** 09.10.2026 · **Version:** 0.20.0 · **Status:** gebaut und getestet (Abspielkette echt getestet, Discord-Sprachverbindung erst auf Philips Server)

Moin_Julia spielt Musik im Sprachkanal: mit Warteschlange, Steuer-Panel und Steuerung im Dashboard.

![Musik im Dashboard](img/20-musik/62-musik.png)

## Entscheidung ohne Rückfrage (von Philip zu bestätigen)
**YouTube und Spotify sind nicht dabei.** Beide verbieten in ihren Nutzungsbedingungen das Abspielen über Bots, deshalb wurden Rythm und Groovy abgeschaltet. Würde Moin_Julia das trotzdem tun, drohen Sperren des Bots.

Stattdessen gibt es:
- **Internet-Radio:** über 50.000 Sender aus dem freien Verzeichnis radio-browser.info, ohne Schlüssel. Beim Tippen von `/musik play` erscheinen passende Sender als Vorschläge, beliebteste zuerst.
- **Direkte Audio-Links:** MP3, OGG, Opus, M4A, AAC, FLAC, WAV sowie Playlists (.m3u, .pls, HLS), z. B. eigene Dateien.
- **Favoriten:** Im Dashboard angelegt, erscheinen sie in Discord ganz oben.

## Bedienung
- `/musik play suche:…`: Sender (mit Vorschlägen), Favorit oder Link. Dabei gilt:
  - **Ohne Sprachkanal:** Wer in keinem Sprachkanal ist, bekommt einen Hinweis.
  - **Ohne Rechte:** Darf der Bot den Kanal nicht betreten, sagt er das.
- `/musik skip`, `stop`, `pause`, `lautstaerke`, `loop` (aus / Titel / Warteschlange), `warteschlange`, `panel`.
- **Steuer-Panel** im Kanal: ⏯ ⏭ ⏹ 🔁 🔉 🔊. Es aktualisiert sich selbst (jetzt läuft, Lautstärke, die nächsten 5).
- **Dashboard → Musik:**
  - **„Jetzt läuft“:** mit Pause, Weiter, Lauter/Leiser, Wiederholen und Stopp, aktualisiert sich alle 5 Sekunden.
  - **Favoriten:** mit Sendersuche.
  - **Einstellungen:** DJ-Rollen, Start-Lautstärke, Länge der Warteschlange und Zeit bis zum Verlassen.
- **Wer steuern darf:** „Server verwalten“ und DJ-Rollen. Gibt es keine DJ-Rollen, dürfen alle steuern, die im selben Sprachkanal sind.
- **Verlassen:** Der Bot geht von selbst, wenn nichts mehr läuft oder er allein im Kanal ist (Standard 2 Minuten).

## Sicherheit
- **Heimnetz geschützt:** Links ins eigene Netz werden standardmäßig abgelehnt. Gemeint sind `192.168.x.x`, `10.x`, `localhost`, NetBird/Tailscale-Adressen und Namen, die dorthin auflösen.
  - **Warum:** Sonst könnte jemand den Bot Geräte in deinem Heimnetz abrufen lassen (SSRF).
  - **Für Musik vom NAS:** lässt sich im Dashboard freischalten, mit Warnhinweis.
- **Keine Zugangsdaten:** Links mit Zugangsdaten (`user:pass@`) sind gesperrt.

## Technik
- **Wiedergabe:**
  - **Pakete:** `@discordjs/voice` 0.19, mit der von Discord verlangten Ende-zu-Ende-Verschlüsselung **DAVE**.
  - **Verschlüsselung:** AES-256-GCM aus Node selbst.
- **Kein nativer Opus-Encoder:**
  - **ffmpeg** holt den Stream (mit automatischem Wiederverbinden) und liefert direkt **Ogg/Opus**.
  - **Lautstärke** regelt ffmpeg. Eine Änderung startet ffmpeg neu, bei Dateien an derselben Stelle.
- **Docker:** Das Bot-Image enthält jetzt `ffmpeg`.
- **Titelwechsel abgesichert:** Beim Überspringen meldet der Player kurz „leer“. Das würde sonst einen zweiten Titel überspringen.
- **Dashboard-Anzeige:** Der Zustand für „Jetzt läuft“ liegt in Redis. Die Steuerung läuft über Modul-Aufträge.
- **Neu im Bot-Kern:** **Autovervollständigung** für Befehle (wird auch für die Sendervorschläge genutzt).

## Wie getestet

| Test | Ergebnis |
|---|---|
| Logik: private Adressen (IPv4/IPv6, CGNAT, IPv4-in-IPv6), Link-Prüfung (Protokoll, Zugangsdaten, YouTube/Spotify), Titel aus Dateinamen, Zeitanzeige | ✓ 3 neu |
| Warteschlange: nacheinander, voll, Titel wiederholen (skip geht trotzdem weiter), Schlange wiederholen | ✓ 3 |
| Quellen: Radio-Suche + Sender per ID (mit Schutz gegen manipulierte IDs), Heimnetz-Sperre auch über DNS-Auflösung, Playlists, ffmpeg-Argumente; Rechte (DJ-Rollen, gleicher Kanal) | ✓ 5 |
| **Echt mit ffmpeg:** Testton per HTTP → Ogg/Opus → von `@discordjs/voice` in über 80 Opus-Pakete zerlegt | ✓ |
| **Echt mit Internet:** radio-browser findet „1LIVE“ (auch per ID); der echte 1LIVE-Stream wurde 4 Sekunden lang in 350 abspielbare Opus-Pakete umgewandelt | ✓ |
| Klick-Test: Modul an, „Jetzt läuft“ + Warteschlange, Steuerung aus dem Dashboard, Sendersuche + Favorit, YouTube-Favorit abgelehnt, entfernen | ✓ 4 neu (gesamt 140/140, zweimal hintereinander) |
| Qualitäts-Rundgang (jetzt 41 Seiten × 2) | ✓ ohne Befund |
| Regression: Bot 172, Shared 77, DB 4, Einrichtung, Admin-Übernahme, Update-Simulation 27/27 | ✓ |

## Bekannte Grenzen
- **Discord-Sprachverbindung:** Die eigentliche Verbindung (Beitreten, Sprechen) lässt sich ohne echten Bot nicht testen. Bitte nach dem Update einmal `/musik play` mit einem Radiosender probieren.
- **Kein „Was läuft gerade im Radio“:** Den aktuellen Songtitel eines Senders zeigt der Bot noch nicht an (ICY-Metadaten). Das steht in `IDEEN.md`.
- **Keine Dateien über das Dashboard:** Musikdateien lassen sich (noch) nicht hochladen. Das geht über eigene Links, z. B. vom NAS mit Freischaltung.
