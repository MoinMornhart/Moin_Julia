# 87 – „Ansicht“ statt Dummies-Knopf (Issue #10, Teil 2)

**Wunsch JONIMONI09 (Issue #10):** „‚Dummies‘ wegmachen und zu einer besseren Option machen, bessere Ansicht oder so.“

![Ansicht-Auswahl](img/87-ansicht.png)

## Lösung (0.69.1)
- Der auffällige 🍼-Knopf oben rechts ist weg. Stattdessen gibt es eine ruhige Auswahl **„👁️ Ansicht“**:
  - **👁️ Standard:** alles mit den normalen Begriffen.
  - **🍼 Für Dummies:** alles super einfach erklärt (siehe 0.64–0.65).
- Die gewählte Ansicht steht mit Häkchen da und wird pro Person gemerkt, wie bisher.
- Ist „Für Dummies“ an, zeigt der Knopf 🍼 in Gelb. So sieht man sofort, warum alles anders heißt.
- Solange das Menü offen ist, pausiert die Live-Aktualisierung.

## Entscheidung (von Philip zu bestätigen)
- **Den Namen „Für Dummies“ hat Philip ausdrücklich so gewollt** („nein, es soll für Dummies heißen“). Deshalb bleibt die Ansicht erhalten und heißt weiter so. Sie ist jetzt eine von zwei Ansichten statt eines eigenen Knopfs.

## Tests
- **Klick-Test 275/275:** Ansicht → Für Dummies → einfache Namen, Bereiche und Statistik → Ansicht → Standard.
- **Sweep:** ohne Probleme.

## Nachtrag 0.70.2 (17.10.2026): wieder als Knopf
**Philip:** „Chef, mach das Dummi wieder hin, das geht nicht, dass das weg ist.“
- Der **🍼-Knopf „Für Dummies“** oben rechts ist zurück, genau wie vor 0.69.1: ein Klick an, ein Klick aus.
- Die „Ansicht“-Auswahl ist wieder raus. Philips Wunsch geht vor (Issue #10, Teil 2 damit abgelehnt).
- Die Pause der Live-Aktualisierung bei offenen Menüs (`details[open][data-pause-open]`) bleibt drin. Sie schadet nicht.
- **Klick-Test:** wieder mit dem Knopf, 277/277.
