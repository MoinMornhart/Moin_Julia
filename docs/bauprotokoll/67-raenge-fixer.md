# 67 – Ränge-Fixer (Issue #8)

**Datum:** 14.10.2026 · **Version:** 0.56.0 · **Status:** fertig und getestet (mit echtem Discord noch nicht)

Wunsch aus Issue #8: Reihenfolge der Rollen ändern, ein Knopf sortiert die Hierarchie sinnvoll und warnt; Verschieben auch per Discord-Befehl.

## Jetzt
- Auf der Seite **„🎖️ Ränge“** gibt es unten den Bereich **„🧹 Ränge-Fixer“**:
  - Er listet alle Rollen, die man verschieben darf: unter der Bot-Rolle und unter der eigenen höchsten Rolle. Der Server-Owner darf alles unter dem Bot.
  - Die Reihenfolge lässt sich **per Ziehen** oder mit **↑ / ↓** ändern (↑↓ geht auch am Handy und mit Tastatur).
  - **„✨ Sinnvoll sortieren“** ordnet so: Admins (Administrator) → Team (Bannen, Kicken, Timeout …) → Bots → besondere Ränge (getrennt angezeigt) → Mitglieder und Deko. Innerhalb einer Gruppe bleibt die bisherige Reihenfolge.
  - **Hinweise**, wenn z. B. eine Team-Rolle unter einer normalen Rolle steht.
  - **Speichern** schickt nur die geänderten Plätze an Discord. Rollen, die man nicht verschieben darf, bleiben genau, wo sie sind.
- **Discord-Befehl `/raenge verschieben`** (englisch `/ranks move`):
  - Optionen: Rolle, Richtung (hoch, runter, ganz oben, ganz unten) und Schritte.
  - Nur mit „Rollen verwalten“, nur unter der Bot-Rolle und (außer für den Owner) unter der eigenen Rolle.
  - `/rang` ist schon die Rangkarte aus dem Level-Modul, deshalb heißt der neue Befehl `/raenge`.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Gruppen, Vorschlag, Positionen (nur Änderungen, belegte Plätze), Hinweise | ✓ neu |
| `/raenge verschieben`: Zielposition in Grenzen, Befehl nur mit „Rollen verwalten“ | ✓ neu |
| Klick-Test: 5 Rollen, ↑ verschiebt, speichern, „Sinnvoll sortieren“ → Admin oben | ✓ neu |
| Klick-Test 251/251, Seiten-Durchlauf 43 × 2, Unit shared 184, Bot 300 | ✓ |
