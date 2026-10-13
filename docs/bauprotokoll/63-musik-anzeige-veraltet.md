# 63 – Musik-Anzeige hängt nicht mehr (Fehler von Philips Installation)

**Datum:** 13.10.2026 · **Version:** 0.52.1 · **Status:** behoben und getestet

## Fehler
- Die Musik-Seite im Dashboard zeigte „Pausiert“ samt Radiosender an, obwohl der Bot schon lange nicht mehr im Call war.
- Ursache:
  - Der Bot speichert den Musik-Stand für das Dashboard in Redis, gültig 6 Stunden.
  - Wird der Bot neu gestartet (z. B. durch ein Update) oder stürzt er ab, kann er den Stand nicht mehr aufräumen. Der alte Eintrag bleibt stehen.

## Lösung
- Solange Musik läuft, frischt der Bot den Stand **alle 30 s** auf (Lebenszeichen).
- Das Dashboard zeigt den Stand nur, wenn er **höchstens 90 s alt** ist. Ist er älter, erscheint „Gerade still“.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Veralteter Stand wird ausgeblendet, frischer angezeigt (Unit-Test) | ✓ neu |
| Unit-Tests shared 171, Bot 296, Klick-Test 237/237 | ✓ |
