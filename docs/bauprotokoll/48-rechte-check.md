# 48 – Rechte-Check, Nur-lesen-Kanäle, Rechte-Wächter (Issue #5)

**Datum:** 11.10.2026 · **Version:** 0.41.0 · **Status:** fertig und getestet

Wunsch von JONIMONI09 (Issue #5): Warnungen, damit normale Mitglieder nicht z. B. über einen Kanal Admin-Rechte bekommen. Dazu ein Knopf, der Kanäle wie #feedback schnell schreibgeschützt macht.

## Was es gibt
Alles steht im Dashboard unter **Server-Schutz**.

- **🔐 Rechte-Check** listet verständlich auf, wo normale Mitglieder gefährliche Rechte haben:
  - **⛔ hoch:** Die Rolle @everyone hat z. B. „Kanäle verwalten“, „Rollen verwalten“ oder „@everyone erwähnen“. Oder ein Kanal erlaubt @everyone so ein Recht ausdrücklich.
  - **⚠️ mittel:** Eine (Nicht-Bot-)Rolle hat Administrator. Das ist oft gewollt, aber man sollte es wissen.
  - Jeder Fund hat eine Erklärung („kann Kanäle löschen …“) und eine Anleitung, wo man es in Discord ändert.
- **📖 Nur-lesen-Kanäle:**
  - Pro Textkanal ein Knopf: „✏️ Alle schreiben“ ↔ „📖 Nur lesen“.
  - „Nur lesen“ verbietet @everyone das Schreiben und Threads. Lesen, Verlauf und Reaktionen bleiben erlaubt, andere Rechte des Kanals bleiben unverändert.
  - Team-Rollen mit eigenen Rechten können weiter schreiben.
  - Im Audit-Log steht „Nur lesen an/aus (Dashboard, Name)“.
- **Rechte-Wächter (Bot):**
  - Gibt jemand @everyone über eine Kanal-Ausnahme oder die @everyone-Rolle ein gefährliches Recht, meldet der Bot das sofort im Alarm-Kanal.
  - Schalter „Warnen, wenn alle Mitglieder gefährliche Rechte bekommen“, ab Werk an.
  - Eigene Änderungen des Bots lösen keine Warnung aus.
  - Administrator-Vergaben an Personen fängt weiterhin Anti-Nuke ab.

## Entscheidungen
- Der Rechte-Check **ändert nichts automatisch**. Er zeigt nur, was und wo. Automatisches Zurücksetzen könnte gewollte Einstellungen kaputtmachen. Von Philip bestätigt (11.10.2026).
- „Administrator“ kann man in Discord nicht pro Kanal vergeben, nur über Rollen. Deshalb prüft der Kanal-Teil die Rechte, die dort tatsächlich gehen (Kanäle/Rollen/Webhooks/Nachrichten verwalten, @everyone erwähnen).

## Wie getestet
| Test | Ergebnis |
|---|---|
| Prüf-Logik: @everyone, Admin-Rolle, Bot-Rollen ausgenommen, Kanal-Ausnahmen | ✓ neu |
| „Nur lesen“ an/aus lässt andere Rechte unverändert | ✓ neu |
| Bot-Wächter: Kanal und @everyone-Rolle → Warnung; harmlos, eigene Änderung oder ausgeschaltet → keine | ✓ neu |
| Klick-Test: Funde sichtbar, Schalter an, #regeln „Nur lesen“, #allgemein umschalten und zurück | ✓ neu |
| Klick-Test 200/200, Seiten-Durchlauf 42 × 2 (auch Handy), Bot 252, Shared 137 | ✓ |
