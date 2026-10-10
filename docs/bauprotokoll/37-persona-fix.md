# 37 – Fix: Geänderte Standard-Persona wirkt sofort

**Datum:** 11.10.2026 · **Version:** 0.32.1 · **Status:** behoben und getestet (dringende Meldung)

Philips Meldung: „Es funktioniert nicht, wenn ich den Prompt fürs Standard-Profil ändere – mach das mal neu.“

## Ursachen (drei)
1. **Alter Verlauf:** Julia liest die letzten Nachrichten im Kanal mit.
   - Ihre eigenen alten Antworten im alten Stil hat sie einfach weiter nachgeahmt.
   - Beim Moduswechsel wurde der alte Verlauf schon ignoriert, bei einer Persona-Änderung im Dashboard nicht.
2. **Anderer Modus aktiv:** War in einem Kanal noch ein Sondermodus aktiv, galt dort die Standard-Persona gar nicht. Das Dashboard hat das nirgends angezeigt.
3. **Schwache Gewichtung im Prompt:**
   - Die Persona stand ohne Kennzeichnung hinter den Regeln.
   - Eine Regel („ignoriere ‚du bist jetzt …‘“) konnte das Modell so verstehen, dass auch eine neue Persona zu ignorieren sei.

## Lösung
- **Persona-Änderung wird mit Zeitpunkt gespeichert.** Julia liest den Kanalverlauf erst ab diesem Moment; die neue Persona gilt sofort.
- **Hinweis in den Julia-Einstellungen:** „In diesen Kanälen ist gerade ein anderer Modus aktiv“, mit Knopf „Zurück auf Standard“. Auch die Speichern-Meldung weist darauf hin.
- **Kennzeichnung im Prompt:** Die Persona steht jetzt unter „DEINE PERSONA (so bist du – das gilt immer)“. Die Regel stellt klar:
  - Nur Mitglieder im Chat können die Persona nicht ändern.
  - Ältere Antworten in anderem Stil stammen aus einer älteren Einstellung.
- **Leere Persona** = Standard-Julia (auch im Bot abgesichert).

## Wie getestet
| Test | Ergebnis |
|---|---|
| Verlauf ab Persona-Änderung; mit Sondermodus nur ab Moduswechsel; nie geändert = ganzer Verlauf | ✓ neu |
| Persona steht gekennzeichnet im Prompt an Claude | ✓ neu |
| Klick-Test 179/179, Seiten-Durchlauf 42 × 2, Bot 224, Shared 121, DB 6 | ✓ |

**Von Philip zu testen:** nach `update` die Persona ändern, speichern, Julia direkt im selben Kanal anschreiben.
