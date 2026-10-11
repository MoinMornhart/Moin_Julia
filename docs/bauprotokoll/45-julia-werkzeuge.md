# 45 – Julia-Werkzeuge: Julia darf handeln (Issue #4, „Tool Calling“)

**Datum:** 11.10.2026 · **Version:** 0.40.0 · **Status:** fertig und getestet

Wunsch aus Issue #4 (Screenshot 1): Julia soll handeln können, also jemandem schreiben, timeouten oder Kanäle anlegen.

## Wie es funktioniert
1. **Einschalten:** Dashboard → Julia → „🛠️ Julia darf handeln“. Ab Werk ist es aus. Die einzelnen Werkzeuge lassen sich abwählen.
2. **Fragen:** z. B. „@Julia gib @Max 10 Minuten Timeout, er spammt“.
3. **Vorschlag:** Julia antwortet und schlägt die Aktion vor. Technisch hängt sie eine Markierung `[[aktion: …]]` an. Der Bot entfernt sie aus dem Text und zeigt stattdessen eine Bestätigung mit „Ja, ausführen“ / „Abbrechen“.
4. **Ausführen:** Erst nach dem Klick und nur durch die Person, die gefragt hat. Nach 5 Minuten verfällt die Anfrage, jeder Knopf wirkt nur einmal.

| Werkzeug | Braucht die fragende Person | Was passiert |
|---|---|---|
| Privatnachricht | „Mitglieder im Timeout“ (Moderieren) | DM mit Absender: Server und wer es ausgelöst hat |
| Timeout | „Mitglieder im Timeout“ | Timeout, höchstens 28 Tage, Grund im Audit-Log: „Julia, bestätigt von …“ |
| Kanal anlegen | „Kanäle verwalten“ | Text- oder Sprachkanal |

## Warum so abgesichert
Ohne Schutz könnte jede Person Julia per Chat zu Moderations-Aktionen überreden. Deshalb entscheidet der **Code**, nicht das Modell:
- Die Anleitung für Aktionen bekommt Julia nur, wenn die fragende Person das passende Discord-Recht hat. Alle anderen bekommen weiter die Regel „du kannst nur schreiben“.
- Selbst wenn Julia trotzdem eine Markierung schreibt, verwirft der Bot sie, wenn das Recht fehlt.
- **Ziele müssen in der Nachricht mit @ erwähnt sein.** Julia kann sich keine Person ausdenken oder eine ID aus dem Verlauf nehmen.
- **Beim Klick wird alles neu geprüft:** Funktion noch an? Recht noch da? Rangfolge wie in Discord (nur Leute unter dir, nie Server-Owner, nie du selbst)? **Herrscher kann Julia nie timeouten.**
- Kein Bann, kein Kick, kein Rollen-Ändern. Das bleibt bei den Moderations-Befehlen.
- Unabhängig vom KI-Anbieter (Claude, Ollama, OpenAI-kompatibel). Es nutzt die Markierungs-Technik, die auch das Gedächtnis (`[[merken: …]]`) verwendet.

Von Philip bestätigt (11.10.2026): Für Privatnachrichten verlange ich das Moderations-Recht, weil der Bot sonst als Spam-Werkzeug taugt.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Markierungen erkennen, Unsinn verwerfen, Grenzen (28 Tage, 3 Aktionen, Kanalnamen) | ✓ neu |
| Nur erlaubte Werkzeuge, nur erwähnte Personen | ✓ neu |
| Bot: Anleitung nur mit Recht im Prompt; ohne Recht keine Vorschläge | ✓ neu |
| Knopf: nur die fragende Person, nur einmal, Abbrechen tut nichts | ✓ neu |
| Beim Klick neu geprüft: Recht weg, Funktion aus, Herrscher, höherer Rang | ✓ neu |
| Klick-Test: Schalter und Auswahl im Dashboard speichern | ✓ neu |
| Klick-Test 195/195, Seiten-Durchlauf 42 × 2, Bot 249, Shared 133 | ✓ |
