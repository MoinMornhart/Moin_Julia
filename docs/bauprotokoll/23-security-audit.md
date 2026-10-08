# 23 – Security-Audit

**Datum:** 09.10.2026 · **Version:** 0.22.0 · **Status:** fertig, Bericht in [SECURITY_AUDIT.md](../../SECURITY_AUDIT.md)

Philips letzter Wunsch: Das ganze Projekt wird auf Sicherheitslücken geprüft, aber nur über Code, Konfiguration und Abhängigkeiten. Laufende Systeme werden nicht angegriffen. Was sich sicher beheben lässt, wird direkt behoben, und alles, was er entscheiden muss, wird markiert.

## Vorgehen
- **Werkzeuge:**
  - gitleaks über die komplette Git-Historie
  - `pnpm audit`
  - semgrep (typescript, nodejsscan, secrets, dockerfile, react)
- **Code-Prüfung in drei Teilen, parallel:**
  1. Zugriffsrechte (alle API-Routen und Server-Actions)
  2. Eingaben, Uploads, SSRF und Injection
  3. Bot-Rechte, Intents, DMs, Docker und Header
- **Nachprüfen:** Jeden Fund habe ich selbst am Code nachgeprüft, erst dann behoben und mit Tests abgesichert.

## Ergebnis
**30 Funde:**
- **0 kritisch**
- **4 hoch:** alle behoben
- **9 mittel:** 8 behoben, 1 teilweise
- **17 niedrig:** 8 behoben, 2 teilweise, 7 offen mit geringem Risiko (in `IDEEN.md`)

Secrets in Code oder Historie, bekannte Lücken in Abhängigkeiten, SQL- oder Command-Injection und Datenlecks über fremde IDs gab es keine.

**Die wichtigsten Fixes:**
- **Keine Rechte-Ausweitung über Rollen-Panels & Co.:** Moin_Julia vergibt automatisch keine Rollen mit gefährlichen Rechten mehr, etwa Administrator, Bannen oder Rollen verwalten.
- **Heimnetz-Schutz für Musik und Willkommensbild, jetzt lückenlos:** Node holt Streams selbst und prüft die IP beim Verbinden. ffmpeg bekommt die Daten nur noch per Pipe, und jede Weiterleitung und jeder Playlist-Link wird geprüft.
- **Einladung ohne „Administrator“:** Neue Einladungen fragen nur die nötigen Rechte an.
- **Einrichtungs-Ticket nicht mehr fälschbar,** wenn `SECRETS_KEY` leer ist.
- **Admin-Rechte im Dashboard werden live geprüft** statt 7 Tage aus dem Login-Stand.
- **Weitere Fixes:**
  - Sicherheits-Header
  - Demo-Modus hinterlässt nichts
  - Starboard holt nichts aus versteckten Kanälen
  - Stream-Titel können nicht @everyone pingen
  - Update-Dienst folgt keinen Symlinks

## Entscheidungen (von Philip zu bestätigen)
- **Einladungs-Rechte:** Die minimalen Rechte (`1409038151414`) sind Standard. Bestehende Bots behalten ihre Rechte, bis Philip sie in Discord ändert.
- **Bewerbungen:** Sie dürfen Rollen mit Moderations-Rechten vergeben (Stelle „Moderator“), aber keine mit Administrator, Server verwalten oder Rollen verwalten.
- **„Links ins eigene Netz“ (Musik):** Das schaltet nur noch der Instanz-Admin.
- **HLS-Streams (`.m3u8`):** Sie gehen nur noch mit dieser Freigabe, weil ffmpeg die Teile selbst holt.

## Wie getestet

| Test | Ergebnis |
|---|---|
| Unit-Tests | Bot 188, Shared 89, DB 5 – alle grün, 16 neu (geschütztes Abrufen mit echtem lokalen Server, versteckte IPv6-Adressen, Rollen-Sperre, Live-Admin-Prüfung, Julia-Gedächtnis, Stream-Titel, GCM-Tag) |
| Echter ffmpeg-Durchlauf über die Pipe, Live-Radio (1LIVE, mit Weiterleitung) | ✓ |
| Klick-Test, Qualitäts-Rundgang (42 Seiten × 2, inkl. CSP-Verstößen in der Konsole) | ✓ |
| Einrichtung, Admin-Übernahme, Update-Simulation 27/27 | ✓ |

**Nicht testbar ohne echten Discord-Server:** Verhalten der minimalen Bot-Rechte. **Nicht testbar unter Windows:** echte Symlinks gegen den Update-Dienst.
