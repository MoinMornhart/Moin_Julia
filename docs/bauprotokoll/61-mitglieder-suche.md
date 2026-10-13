# 61 – Mitglieder-Suche überall (Issue #7)

**Datum:** 13.10.2026 · **Version:** 0.51.0 · **Status:** fertig und getestet

Wunsch von JONIMONI09: „Namen-Vervollständigung muss geladen werden bzw. Mitglieder sollen alle geladen werden, um besser auswählen zu können – überall.“

## Vorher
- Die Personen-Suche nutzte Discords eigene Suche. Die findet nur **Namensanfänge**, höchstens **10 Treffer** und erst ab 2 Buchstaben.
- Bei Limits pro Person und „Herrscher ernennen“ musste man die **Discord-ID** eintippen.

## Jetzt
- **Alle Mitglieder** (ohne Bots, bis 10.000) werden geladen und 60 s zwischengespeichert. Gesucht wird darin:
  - **ab dem ersten Buchstaben**;
  - nach Anzeigename/Spitzname **und** Benutzername;
  - **auch mitten im Namen** („zel“ findet „Der Ozelot“);
  - **mit Tippfehlern** („ozelto“);
  - per ID-Anfang (Ziffern).
- **Reihenfolge:** genau → Anfang → Wortanfang → enthält → ähnlich. Bis zu 15 Treffer.
- Klappt das Laden nicht (z. B. fehlt dem Bot der „Server Members Intent“), nutzt das Dashboard wie bisher Discords Suche.
- **Überall statt Discord-ID:** Personen-Limits und „Herrscher ernennen“ haben jetzt eine Namenssuche. Ein Klick füllt **ID und Name** aus. Die ID kann man weiterhin direkt eintippen.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Rangfolge (Anfang vor Wortanfang vor Mitte), Benutzername, Tippfehler, ID | ✓ neu |
| Klick-Test: „zelo“ und „ozelto“ finden „Der Ozelot“; Herrscher per Namenssuche füllt ID + Name | ✓ neu |
| Klick-Test 234/234, Seiten-Durchlauf 43 × 2 | ✓ |
