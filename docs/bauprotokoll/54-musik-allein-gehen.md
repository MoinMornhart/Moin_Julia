# 54 – Musik: Bot geht, wenn keiner mehr im Sprachkanal ist

**Datum:** 11.10.2026 · **Version:** 0.46.1 · **Status:** fertig und getestet

Wunsch von Philip: „Der Bot checkt, wenn keiner mehr im Call ist, und geht dann auch raus.“

## Vorher
- Es gab nur eine gemeinsame Wartezeit für „nichts läuft“ und „allein“ (Standard 120 s).
- Ein schon laufender „nichts läuft“-Timer blockierte den „allein“-Timer.
- Geprüft wurde nur, wenn jemand den Sprachkanal betritt oder verlässt. Ging ein Ereignis verloren (z. B. beim Wiederverbinden), blieb der Bot im leeren Kanal.

## Jetzt
- **Eigene Wartezeit „allein im Kanal“:** Standard **30 Sekunden**, einstellbar unter Musik → „Kanal verlassen, wenn keiner mehr da ist“. Der Bot geht auch dann, wenn noch Musik läuft. Für niemanden zu spielen ergibt keinen Sinn.
- **Zweite Prüfung beim Ablauf:** Ist inzwischen jemand gekommen, bleibt der Bot.
- **Regelmäßige Prüfung alle 30 Sekunden** (zusammen mit der Selbstheilung). Damit bleibt er auch bei verpassten Ereignissen nicht hängen.
- Bots im Kanal zählen nicht als Zuhörer.
- **24/7-Modus** bleibt die bewusste Ausnahme: Dort bleibt der Bot.
- Die Wartezeit „nichts läuft“ (Standard 120 s) gibt es weiter, getrennt davon.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Allein → geht nach genau der eigenen Wartezeit (auch während Musik) | ✓ neu |
| Jemand kommt zurück → bleibt; 24/7 → bleibt | ✓ neu |
| Zurückgekommen ohne Ereignis → zweite Prüfung verhindert das Gehen | ✓ neu |
| Klick-Test: Standard 30 s, Wert speichern | ✓ neu |
| Klick-Test 220/220, Seiten-Durchlauf 43 × 2, Bot 274 | ✓ |
