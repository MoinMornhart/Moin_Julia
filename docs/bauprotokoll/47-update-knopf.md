# 47 – „Zum Update“ führt zu 404 (Issue #6)

**Datum:** 11.10.2026 · **Version:** 0.40.2 · **Status:** behoben und getestet

## Fehler
- Gemeldet von JONIMONI09 auf moinjulia.morncloud.de: Im Änderungsverlauf (Klick auf die Version unten) steht „Update verfügbar“ mit dem Knopf **„Zum Update“**. Der Klick endet auf einer **404**.
- Ursache:
  - Der Knopf wurde **allen** Angemeldeten angezeigt.
  - Die Seite `/system` (Updates, Bot-Zugangsdaten) darf aber nur der **Instanz-Admin** öffnen. Das ist die Person, die Moin_Julia eingerichtet hat.
  - Für alle anderen gab die Seite absichtlich eine 404 zurück, ohne Erklärung.

## Lösung
- `/api/version` meldet zusätzlich `canUpdate`. Das ist nur für den Instanz-Admin `true`.
- Der Änderungsverlauf zeigt „Zum Update“ nur noch dann. Alle anderen sehen: „Das Update installiert der Instanz-Admin (wer Moin_Julia eingerichtet hat).“
- Wer `/system` trotzdem öffnet, bekommt statt der 404 die Erklärung „Nur für den Instanz-Admin“ und einen Link zur Server-Auswahl. Einstellungen sind dort weiterhin nicht zu sehen.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Instanz-Admin: `canUpdate` = true | ✓ neu |
| Andere Person: `canUpdate` = false, /system zeigt Erklärung (Status 200), keine System-Einstellungen | ✓ neu |
| Admin-Übernahme-Test, Klick-Test 195/195, Seiten-Durchlauf 42 × 2 | ✓ |
