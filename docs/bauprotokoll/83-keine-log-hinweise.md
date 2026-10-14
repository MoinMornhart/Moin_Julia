# 83 – Keine Betreiber-Hinweise mehr im Log-Kanal

**Wunsch Philip (14.10.2026):** Er hat einen Screenshot mit zwei Meldungen „🔑 Der Instanz-Admin … hat das Dashboard dieses Servers per Generalschlüssel geöffnet“ geschickt: „mach die mal weg, das nervt“. Dann: „allgemein Benachrichtigungen, auch mit Support, das nervt“.

## Entfernt (0.68.1)
Diese Meldungen schreibt der Bot nicht mehr in den Log-Kanal eines Servers:
- **Generalschlüssel:** „Instanz-Admin hat das Dashboard geöffnet“. Die Meldung kam auch doppelt, weil zwei Seitenaufrufe gleichzeitig durchrutschten.
- **Support-Zugang:** an/aus (`/moin support-zugang`) und „Der Bot-Betreiber liest per Support-Zugang mit“.
- **Einladung per DM:** „Der Bot-Betreiber hat sich eine Einladung erstellt“.
- **Server kopieren:** „… hat X hierher kopiert“ und „… wieder entfernt“.

## Bleibt
- Wer `/moin support-zugang` nutzt, bekommt weiter die Bestätigung als Antwort; die sieht nur diese Person.
- **Discord-Audit-Log:** Einladungen, angelegte Rollen und Kanäle haben weiter einen Grund („Einladung für den Bot-Betreiber“, „Server-Kopie von …“). Das ist Discords eigenes Protokoll, kein Kanal.
- Der Support-Zugang selbst bleibt Pflicht für das Mitlesen. Er wird weiterhin nur von Owner/Admin erteilt.

## Tests
- **Unit:** Der Support-Zugang-Test prüft jetzt, dass **keine** Nachricht in den Log-Kanal geht. 536 grün.
- **Klick-Test:** 271/271.
- **Sweep:** ohne Probleme.
