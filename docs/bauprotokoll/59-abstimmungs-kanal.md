# 59 – Abstimmungen in eigenem Kanal (Issue #7)

**Datum:** 13.10.2026 · **Version:** 0.49.0 · **Status:** fertig und getestet

Wunsch von JONIMONI09 (Issue #7):
- Abstimmungen über Vorschläge sollen nicht im selben Kanal stehen, sondern in einem eigenen Voting-Kanal.
- Der Kanal soll sich anlegen lassen oder ein vorhandener sein.
- Mit anderen Modulen soll es auch gehen.

## Was es gibt
- **Abstimmungs-Kanal pro Vorschlags-Bereich** (Hauptbereich unter Community → Einstellungen, weitere Bereiche im Reiter „Vorschläge“):
  - Der Knopf **„💡 Vorschlag einreichen“** bleibt im Vorschlags-Kanal, z. B. #feedback.
  - Die Vorschläge mit **👍/👎** (und ggf. Entscheidungs-Knöpfen und Thread) landen im **Abstimmungs-Kanal**. Die Bestätigung für die einreichende Person verlinkt dorthin.
  - Leer = alles wie bisher im Vorschlags-Kanal.
- **„📊 Abstimmungs-Kanal anlegen“** (der Kanal bekommt eine echte Existenz):
  - Der Bot legt neben dem Vorschlags-Kanal, in derselben Kategorie, einen Kanal `📊・abstimmung-<bereich>` an.
  - Alle können lesen und per Knopf abstimmen, aber **nicht schreiben**. So bleibt die Abstimmung übersichtlich.
  - Der Kanal wird direkt beim Bereich eingetragen. Alternativ wählt man einen vorhandenen Kanal aus.
- **Auch für andere Module – Umfragen:** „Umfragen immer in diesem Kanal“. `/umfrage` postet dann dort, egal wo der Befehl eingegeben wird. Die Person bekommt eine kurze, nur für sie sichtbare Bestätigung.
- Mit eigenem Abstimmungs-Kanal wird der Einreichen-Knopf nicht mehr nach jedem Vorschlag neu gepostet. Er bleibt ohnehin unten, weil im Vorschlags-Kanal nichts dazukommt.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Vorschlag landet im Abstimmungs-Kanal, Knopf-Kanal bleibt ruhig, Bestätigung verlinkt richtig | ✓ neu |
| Ohne Abstimmungs-Kanal wie bisher | ✓ neu |
| Umfrage geht in den festen Kanal, kurze Bestätigung | ✓ neu |
| Klick-Test: Abstimmungs- und Umfrage-Kanal speichern, „Abstimmungs-Kanal anlegen“ | ✓ neu |
| Klick-Test 228/228, Seiten-Durchlauf 43 × 2, Bot 293 | ✓ |
