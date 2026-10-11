# 44 – Issue #4: Wer darf Julia nutzen, Stichwort-Regeln, Ollama Cloud pro Server

**Datum:** 11.10.2026 · **Version:** 0.39.0 · **Status:** fertig und getestet

GitHub-Issue #4 (von JONIMONI09) enthält viele Wünsche. Umgesetzt sind die, die klar und sinnvoll sind; der Rest steht unten mit Begründung.

## Umgesetzt
- **Blacklist und Whitelist mit Personen, nicht nur Rollen** (Julia → Einstellungen → „Wer darf Julia nutzen?“):
  - Personen per Namenssuche hinzufügen (Discord-Mitgliedersuche über den Bot).
  - **Blacklist:** Diese Personen/Rollen ignoriert Julia.
  - **Whitelist:** Steht hier jemand, antwortet Julia **nur** diesen Personen/Rollen.
  - Herrscher dürfen immer.
- **Stichwort-Regeln** („wenn besondere Wörter erwähnt werden“):
  - Fällt ein Stichwort, bekommt Julia eine Zusatzanweisung, z. B. „Regeln“ → „Verweise auf #regeln“.
  - Auf Wunsch antwortet sie dabei in einem bestimmten Modus.
  - Erkannt werden ganze Wörter, Groß/klein ist egal, Umlaute gehen.
  - Julias Grundregeln lassen sich damit nicht aushebeln.
- **Ollama Cloud pro Server** (Screenshot 2: Server-Admins konnten Ollama nicht nutzen):
  - Unter Verbindung → „Eigene Schlüssel“ kann jeder Server-Admin seinen Ollama-Cloud-Schlüssel eintragen.
  - Die Adresse ist fest (`https://ollama.com/v1`), deshalb gibt es kein Heimnetz-Risiko. Eigene Ollama-Server im Heimnetz bleiben dem Instanz-Admin vorbehalten.

## Nicht oder anders umgesetzt
- **„WebGPU nutzen“:** Bereits in 0.27.0 geprüft. Der Bot-Container hat keine Grafikkarte; schneller wird Julia mit Ollama auf einem Rechner mit GPU (Anleitung im Dashboard).
- **„Tool Calling“ (Julia schickt Nachrichten, timeoutet, legt Kanäle an; Screenshot 1):** sinnvoll, aber missbrauchbar. Ohne Absicherung könnte jeder Julia per Chat zu Moderations-Aktionen überreden. Kommt als eigenes Modul: nur für Personen mit den passenden Discord-Rechten und mit Bestätigungs-Knopf.
- **„GitHub Pages“:** eigener Schritt (Projekt-Webseite).
- **„Systemprompt und Personas erstellen und optimieren“, „Flirt mit Prompts“, „mehr Limits“:** gibt es seit 0.32–0.36 (Persona, Modi mit Feineinstellungen, Vorschau, Flirt-Ton per Zustimmung, Limits pro Person).
- **„Manches wird nicht aktualisiert“:** seit 0.29.0 aktualisiert sich das Dashboard jede Sekunde; 0.32.1 behebt die nicht wirkende Persona-Änderung. Konkrete weitere Fälle bitte mit Screenshot melden.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Wer darf: ohne Listen alle; Blacklist Person/Rolle; Whitelist; Blacklist geht vor | ✓ neu |
| Stichwörter: ganze Wörter, Groß/klein, Umlaute, Sonderzeichen | ✓ neu |
| Bot: gesperrte Person / nicht auf der Whitelist → keine Antwort; Regel fügt Anweisung + Modus hinzu, ohne Stichwort nicht | ✓ neu |
| Ollama Cloud als eigener Anbieter mit fester Adresse | ✓ neu |
| Klick-Test: Person per Suche auf die Blacklist, Regel speichern, Liste wieder leeren; Ollama Cloud in „Eigene Schlüssel“ | ✓ neu |
| Klick-Test 193/193, Seiten-Durchlauf 42 × 2, Bot 244, Shared 128, DB 6 | ✓ |
