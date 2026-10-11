# 50 – Automod verbessert (Issue #5)

**Datum:** 11.10.2026 · **Version:** 0.43.0 · **Status:** fertig und getestet

Meldung von JONIMONI09: „Automod funktioniert nicht so gut.“ Bei der Durchsicht kamen vier konkrete Schwächen heraus.

## Was nicht gut lief und was jetzt anders ist
| Problem | Lösung |
|---|---|
| **Schimpfwörter:** Discords AutoMod findet nur exakte Wörter. „1d10t“, „IDIOOOT“ oder „i d i o t“ kamen durch. | Der Bot prüft zusätzlich verschleierte Schreibweisen: Leetspeak, gedehnte Buchstaben, gesperrte Schreibweise. Das ist ab Werk an. Dazu kommt optional eine **eingebaute Liste** eindeutiger Beleidigungen (de/en) und eine eigene Aktion: löschen, löschen + verwarnen, löschen + Timeout. |
| **Links:** Nur Adressen mit `https://` wurden geblockt, „www.seite.de“ nicht. | Die Link-Regel erkennt jetzt auch `www.`-Links. |
| **Spam:** Gezählt wurde nur die Menge an Nachrichten. | Neu: **dieselbe Nachricht x-mal in 30 s** (Standard 3, auch mit anderer Groß-/Kleinschreibung). Neu: **Emoji- und Zeilen-Fluten** mit eigener Grenze und Aktion. |
| **Keine Rückmeldung:** Scheiterte eine Discord-Regel (fehlendes Recht, Server hat schon eine eigene Regel, Discord-Limit), stand das nur im Bot-Log. Im Dashboard sah alles „an“ aus. | Der Bot meldet nach jedem Abgleich, welche Regeln **wirklich** in Discord aktiv sind und welche nicht, mit verständlichem Grund. Das Dashboard zeigt es oben im Automod-Bereich. Fehlt „Server verwalten“, steht das rot da. |

Mitglieder mit „Nachrichten verwalten“ und die Ausnahmen (Rollen/Kanäle) bleiben wie bisher ausgenommen.

## Gemeinsame Text-Prüfung
`packages/shared/src/config/text-filter.ts`: Normalisierung, Wortsuche (nur ganze Wörter), Emojis, Zeilen und „gleiche Nachricht“. Julias Beleidigungs-Schutz (0.42.0) nutzt dieselbe Prüfung und erkennt damit jetzt auch „i d i o t“.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Text-Filter: gesperrt, Punkte, Leetspeak, ganze Wörter, Emojis, Zeilen, gleiche Nachricht | ✓ neu |
| Bot: verschleierte Wörter löschen, Wortteile nicht; „smart“ aus; eingebaute Liste mit Verwarnung | ✓ neu |
| Bot: dieselbe Nachricht 3×, Emoji-/Zeilen-Flut, Moderatoren ausgenommen | ✓ neu |
| Link-Regel mit `www.`, Fehler-Erklärungen, Status (aktiv/fehlgeschlagen/fehlendes Recht) | ✓ neu |
| Klick-Test: neue Felder speichern, ehrlicher Status ohne Bot | ✓ neu |
| Klick-Test 205/205, Seiten-Durchlauf 42 × 2, Bot 265, Shared 144 | ✓ |
