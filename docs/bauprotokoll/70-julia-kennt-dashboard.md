# 70 – Julia kennt das Dashboard (Wunsch Philip)

**Datum:** 14.10.2026 · **Version:** 0.58.0 · **Status:** fertig; Unit-Tests grün. Mit echter KI noch nicht ausprobiert.

Wunsch: „Sorge dafür, dass die KI sich mit dem Dashboard auskennt und – wenn ein Admin, ich oder der Owner schreibt – es automatisch ändern kann.“

## Jetzt
- **Wegweiser:** Fragt jemand nach Einstellungen („Wo stelle ich den Willkommenstext ein?“, „wie schalte ich Level aus?“), bekommt Julia eine Liste aller Dashboard-Seiten mit Links. Sie antwortet dann mit dem passenden Link. Der Wegweiser kommt nur bei solchen Fragen dazu, damit nicht jede Antwort mehr kostet.
- **Selbst ändern lassen:** Wenn **Server-Owner, Admins mit Administrator-Recht oder der Instanz-Admin** fragen, kennt Julia zusätzlich alle Module (an/aus) und deren einfache Einstellungen (an/aus, Zahlen, kurze Texte).
  - Beispiele: „schalte Level aus“, „Musik-Lautstärke auf 40“, „mach Autoplay an“.
  - **Sofort umgesetzt**, danach erscheint „⚙️ Musik: defaultVolume = 40 (vorher 50)“ mit dem Knopf **„↩️ Rückgängig“** (eine Stunde gültig). Drücken darf ihn, wer die Änderung angestoßen hat, oder Owner/Admins.
  - **Heikle Bereiche** (Server-Schutz, Moderation, Owner-Bereich, Kern) ändert Julia nur nach Klick auf den **Bestätigungs-Knopf**.
  - Geprüft wird **mit demselben Schema wie im Dashboard**. Falsche Werte (z. B. Lautstärke 5000) werden abgelehnt, und nichts geht kaputt.
  - Kompliziertes (Listen, Kanäle, Texte mit Platzhaltern) verlinkt Julia aufs Dashboard, statt es selbst zu ändern.
  - Der Bot übernimmt die Änderung sofort (gleiche Nachricht wie aus dem Dashboard).
- Alle anderen Mitglieder bekommen nur den Wegweiser. Ändern geht für sie nicht, auch nicht durch geschicktes Fragen: Die Berechtigung prüft der Code, nicht die KI.

## Entscheidungen (von Philip zu bestätigen)
- Normale Einstellungen sofort mit „Rückgängig“, heikle mit Bestätigungs-Knopf (so wie am 13.10. vorgeschlagen).
- Das Ändern-Werkzeug ist unabhängig vom Schalter „Julia-Werkzeuge“. Es ist für Owner/Admins immer da, weil sie im Dashboard ohnehin alles ändern können.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Fragen erkennen, Links bauen, Felder/Werte umwandeln, Markierung lesen, nur mit Erlaubnis | ✓ neu |
| Bot: wer darf (Owner/Admin/Instanz-Admin), Modul aus + Rückgängig-ID, Feld ändern, ungültigen Wert ablehnen, unbekanntes Modul/Owner-Bereich ablehnen | ✓ neu |
| Unit shared 188, Bot 305, Klick-Test 252/252, Seiten-Durchlauf 43 × 2 | ✓ |
