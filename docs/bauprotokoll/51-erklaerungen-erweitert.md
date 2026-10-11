# 51 – Erklärungen beim Drüberfahren + Einfach/Erweitert (Issue #5)

**Datum:** 11.10.2026 · **Version:** 0.44.0 · **Status:** fertig und getestet

Wunsch von JONIMONI09:
- „ÜBERALL wo man mit der Maus drüber hovert soll erklärt werden, was es tut.“
- „Überall Advanced-Einstellungen.“
- „Idiotensicher.“

## Erklärungen überall
Statt 170 Stellen einzeln anzufassen, macht das ein zentraler Baustein (`HoverHelp`, im Grundgerüst jeder Seite):
- Jeder Schalter, jedes Feld, jede Auswahl, jeder Knopf und jeder Link ohne eigene Erklärung bekommt automatisch eine. Sie wird gebildet aus:
  - Beschriftung,
  - Beschreibung des Bausteins (bei Schaltern der graue Erklärungstext darunter),
  - Hinweisen je nach Art: „Klicken zum Ein- oder Ausschalten“, „Erlaubt: 2 bis 50“, „Auswählen“, „öffnet eine externe Seite“.
- Auch später nachgeladene Teile bekommen sie (Beobachter auf Seitenänderungen).
- Eigene, bessere Erklärungen bleiben unangetastet.
- Felder ohne Beschriftung bekommen keine automatische Erklärung. Ihr sichtbarer Platzhalter ist zugleich ihr Name für Screenreader und soll nicht verdrängt werden.

## Einfach/Erweitert
- Bereiche, die selten gebraucht werden, sind als **„🧰 Erweitert“** markiert. Im einfachen Modus sind sie ausgeblendet, damit die Seiten übersichtlich bleiben.
- Markiert sind:
  - Ausnahmen (Moderation, Level),
  - Stichwort-Regeln, Julia darf handeln, Beleidigungen gegen Julia,
  - Account-Alter (Schutz),
  - Probezeit (Teams).
- Im Kopf jeder Modulseite steht **„🧰 Erweitert anzeigen (n)“**. Der Knopf blendet alles ein, die Wahl merkt sich der Browser. Er erscheint nur, wenn es auf der Seite erweiterte Bereiche gibt.
- Kein Aufblitzen: Der Modus wird gesetzt, bevor die Seite sichtbar wird.
- Ausgeblendete Einstellungen bleiben wirksam und werden beim Speichern mitgeschickt. Sie sind nur nicht zu sehen.

Von Philip zu bestätigen: Ab Werk gilt der einfache Modus. Wer etwas vermisst, findet es über den Knopf.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Einfacher Modus blendet „Ausnahmen“ aus; Knopf blendet ein; bleibt nach dem Neuladen | ✓ neu |
| Schalter erklärt sich („Schimpfwörter blockieren – … – Klicken zum Ein- oder Ausschalten“) | ✓ neu |
| Zahlenfeld nennt den erlaubten Bereich („Erlaubt: 2 bis 50“) | ✓ neu |
| Klick-Test 210/210 (im Erweitert-Modus), Seiten-Durchlauf 42 × 2 (einfacher Modus, auch Handy) | ✓ |
