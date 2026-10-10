# 34 – Fix: Musik läuft beim Lauter/Leiser nahtlos weiter

**Datum:** 10.10.2026 · **Version:** 0.30.1 · **Status:** behoben und getestet (dringende Meldung)

Philips Meldung: „Fixe, dass es nahtlos weitergeht mit der Musik, wenn ich Musik lauter, leiser oder sonst was mache – das nervt.“

## Ursache
Jede Lautstärke-Änderung hat die komplette Wiedergabe neu gestartet:
- ffmpeg wurde neu gestartet,
- bei YouTube wurde sogar der Download neu begonnen.

Das ergab jedes Mal eine Pause von bis zu mehreren Sekunden.

## Lösung
| Aktion | Vorher | Jetzt |
|---|---|---|
| Lauter / Leiser / Lautstärke setzen | Neustart, Pause | **sofort im laufenden Ton**, kein Neustart, keine Lücke |
| Effekt wechseln (Bassboost, Nightcore …) | Neustart, Stille | Neustart im Hintergrund, **der alte Ton läuft weiter**, bis der neue da ist |
| Spulen / Springen | Stille bis geladen | wie bei den Effekten: alter Ton läuft weiter |

**Technik in einem Satz:** ffmpeg liefert jetzt rohen Ton, und die Lautstärke regelt der Bot selbst in Echtzeit. Dafür kam der Opus-Kodierer `opusscript` dazu (reines JavaScript, kein Zusatz im Docker-Image nötig).

**Effekt-Wechsel:** Die neue Wiedergabe startet um die gemessene Ladezeit weiter vorn. Beim Umschalten geht es so ungefähr an der Stelle weiter, an der man gerade war.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Lautstärke 3× ändern → kein neues ffmpeg, alter Ton läuft, neue Lautstärke greift | ✓ neu |
| Effekt-Wechsel → alter Ton läuft weiter, bis der neue Ton da ist; Start etwas weiter vorn | ✓ neu |
| Echtes ffmpeg: MP3 → rohes PCM → Live-Lautstärke → Opus-Pakete für Discord | ✓ angepasst |
| Echtes ffmpeg: alle 10 Effekte liefern Ton | ✓ angepasst |
| Bot 210 Tests | ✓ |

**Von Philip zu testen:** nach `update` Musik abspielen und mehrmals lauter/leiser drücken.
