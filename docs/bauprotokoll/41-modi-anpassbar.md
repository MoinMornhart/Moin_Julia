# 41 – Modi perfekt anpassbar

**Datum:** 11.10.2026 · **Version:** 0.36.0 · **Status:** fertig und getestet

Philips Wunsch: „Überarbeite das nochmal mit den Modi, dass da auch Flirty und so geht – also dass man die perfekt anpassen kann.“

## Neu: Feineinstellungen pro Modus
Unter Julia → Modi gibt es bei jedem Modus den Bereich „🎛️ Feineinstellungen“. Unter Julia → Einstellungen gibt es denselben Bereich für die Standard-Julia.

| Einstellung | Auswahl |
|---|---|
| Anrede | wie die Person schreibt · immer du · immer Sie |
| Emojis | keine · wenige · normal · viele |
| Tonfall | wie in der Persona · freundlich · frech · förmlich · locker · herzlich · dramatisch · cool |
| Sprache | wie die Person schreibt · Deutsch · Englisch · Plattdeutsch |
| Flirt-Ton | nach den Server-Regeln · in diesem Modus nie · betont (wenn erlaubt) |
| Begrüßung | Text, den Julia beim Umschalten in den Modus sagt |

- **🔊 „So klingt der Modus“:** Ein Knopf an jedem Modus lässt Julia sich mit genau dieser Persona und diesen Einstellungen vorstellen. Das geht auch, bevor man speichert.
- **Begrüßung:** Bei `modus Name` und `/julia modus` folgt nach „Modus gewechselt“ die Begrüßung des Modus.
- **Flirt-Ton im Modus:** Ein Modus kann Flirten **abschalten** oder **betonen**. Die 18+-Voraussetzungen (Rolle, altersbeschränkter Kanal, Zustimmung) gelten immer zusätzlich; ein Modus kann sie nicht umgehen.
- Bestehende Modi behalten ihr Verhalten (alle Feineinstellungen starten auf „Standard“).

## Wie getestet
| Test | Ergebnis |
|---|---|
| Stil steht im Prompt (Sie, keine Emojis, frech, Plattdeutsch) | ✓ neu |
| „betont“ verstärkt den Flirt-Ton nur, wenn alle 18+-Voraussetzungen erfüllt sind | ✓ neu |
| Modus „Flirt nie“ verhindert Flirten trotz Zustimmung | ✓ neu |
| Standard-Julia nutzt ihren eigenen Stil | ✓ neu |
| Klick-Test: Feineinstellungen speichern, Vorschau antwortet | ✓ neu |
| Klick-Test 189/189, Seiten-Durchlauf 42 × 2, Bot 234, Shared 121, DB 6 | ✓ |
