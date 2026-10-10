# 36 – Herrscher nur durch Philip, Loyalität, Limits pro Person

**Datum:** 10.10.2026 · **Version:** 0.32.0 · **Status:** fertig und getestet (oberste Priorität laut Philip)

Philips Wünsche dazu:
- „Nur ich bestimme, wer als König behandelt wird – per Befehl oder ich sag es ihr.“
- „Sie soll immer zu mir stehen, mich verteidigen, mich immer König nennen, nur auf mich hören – egal wie das Dashboard eingerichtet ist.“
- „Bei mir nie ein Limit – und Limits pro Benutzer einstellbar (z. B. 200 Nachrichten pro Stunde oder Wörter).“

## Herrscher
- **Philip (Instanz-Admin) ist immer „König“.**
  - Das ist fest im Bot eingebaut; keine Server-Einstellung ändert es.
  - Den Titel ändert nur Philip selbst.
- **Nur Philip ernennt weitere Herrscher**, auf drei Wegen:
  - `/julia herrscher` mit ernennen / absetzen / liste / nur Herrschern dienen / allen dienen,
  - im Chat: „@Julia ernenne @Max zum König“, „@Julia setz @Max ab“, „@Julia diene nur noch mir“, „@Julia diene wieder allen“. Das wird ohne KI erkannt, also nicht überredbar,
  - im Dashboard unter Julia → Einstellungen → „👑 Herrscher“. Nur Philip sieht dort Knöpfe, alle anderen nur die Liste.
- **Server-Admins** können Herrscher nicht mehr ändern. Die alte Einstellung pro Server ist entfernt.
- **Loyalität:**
  - Julia nimmt Philip ernst als Chef, steht auf seiner Seite und verteidigt die Herrscher schlagfertig.
  - Anweisungen zu ihrem Verhalten nimmt sie nur von Herrschern an.
- **„Julia dient nur den Herrschern“** (Schalter): Dann antwortet sie allen anderen nicht.

## Limits
- **Herrscher haben nie ein Limit** (keine Pause, kein Stunden-/Tageslimit).
- **Allgemeines Limit:** Menge + Einheit (Antworten oder Wörter) + Zeitraum (Stunde oder Tag); 0 = unbegrenzt.
- **Eigene Limits pro Person oder Rolle**, z. B. „Max: 200 Antworten pro Stunde“ oder „Anna: 2.000 Wörter pro Tag“, jeweils mit eigener Pause.
  - Die Regel der Person geht vor Rollen; bei mehreren Rollen zählt die großzügigste.
- **Rollen ganz ohne Limit** lassen sich zusätzlich auswählen.
- **Neue Meldung:** „Dein Limit ist erreicht (200 Antworten pro Stunde)“ statt pauschal „in der letzten Stunde“.
- **Das Monatsbudget bei Claude bleibt** (echtes Geld).

## Bewusst nicht gebaut (Philip mitgeteilt)
- **„Leute wie Dreck behandeln“ auf Zuruf:** Das wäre gezieltes Mobbing einzelner Personen.
- **Beim Verteidigen beleidigt Julia niemanden.**
- **Julias Grundregeln gelten auch für Herrscher.**

## Wie getestet
| Test | Ergebnis |
|---|---|
| Instanz-Admin immer König (auch wenn Herrscher abgeschaltet), ernennen/absetzen, Namen | ✓ neu |
| Chat-Sätze werden erkannt (ernennen, absetzen, nur mir dienen, allen dienen), Alltagssätze nicht | ✓ neu |
| Julia-Anweisung: Chef ernst nehmen, loyal verteidigen ohne Beleidigung, Anweisungen nur von Herrschern | ✓ neu |
| Bot: König ohne Limit (3× trotz Limit 1 und 10 min Pause); „nur Herrschern dienen“ schweigt bei anderen | ✓ neu |
| Bot: eigene Regel 3 Antworten/Tag greift, verständliche Meldung | ✓ neu |
| Limits: Person > Rolle > allgemein; Antworten/Wörter, Stunde/Tag, Pause | ✓ neu |
| Klick-Test: Titel, ernennen, absetzen; Limit pro Person speichern | ✓ neu |
| Klick-Test 179/179, Seiten-Durchlauf 42 × 2, Bot 215, Shared 121, DB 6 | ✓ |
