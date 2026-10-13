# 55 – Dashboard: „Kanäle oder Rollen konnten nicht geladen werden“ + React-Fehler #418 (Issue #7/#8/#9)

**Datum:** 13.10.2026 · **Version:** 0.46.2 · **Status:** behoben und getestet

## Meldungen von JONIMONI09
- Moderation: roter Hinweis „Kanäle oder Rollen konnten nicht geladen werden“.
- Konsole: „Minified React error #418“ (Text vom Server ≠ Text im Browser).
- Konsole: Content-Security-Policy blockiert „eval“.

## Ursachen und Lösungen
| Ursache | Lösung |
|---|---|
| Die Rechte-Daten für Rechte-Check und Schutz-Vorschläge (0.41/0.46) wurden **ohne Zwischenspeicher** geladen. Die Seiten aktualisieren sich jede Sekunde, also kamen zwei Discord-Abfragen pro Sekunde und Besucher. Discord bremste (429), danach scheiterten auch die normalen Abfragen. | 5 s zwischenspeichern wie die anderen Discord-Daten. Bei „zu viele Anfragen“ wartet das Dashboard jetzt kurz und versucht es erneut, statt sofort den roten Hinweis zu zeigen. |
| Die Uhrzeit im AutoMod-Status wurde auf dem Server (UTC) anders formatiert als im Browser (Berlin). Das löst React-Fehler #418 aus. | Feste Zeitzone Europe/Berlin (auch im Import-Assistenten). |
| zod versucht im Browser, Prüfungen per `new Function` zu beschleunigen. Die Sicherheitsregel (CSP) verbietet das zu Recht, deshalb erschien die Meldung. Es fiel still auf den normalen Weg zurück. | Im Browser schaltet zod das jetzt von vornherein ab. Die Meldung ist weg, die Sicherheitsregel bleibt streng. |

Die „preload“-Hinweise zu Schriften sind nur Browser-Hinweise, kein Fehler.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Klick-Test 220/220, Seiten-Durchlauf 43 × 2 (Konsole ohne Fehler) | ✓ |
