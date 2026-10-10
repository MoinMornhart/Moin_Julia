# 33 – Julia verehrt den Herrscher

**Datum:** 10.10.2026 · **Version:** 0.30.0 · **Status:** fertig und getestet

Philips Wunsch: Julia soll ihn auf jedem Server als Herrscher behandeln.

## Was Julia jetzt macht
- **Wer:** die Person, die Moin_Julia installiert hat (Instanz-Admin, also Philip).
- **Wie:** Julia begrüßt ihn mit seinem Titel (Standard: „Großer Herrscher“) und verneigt sich (*verneigt sich tief*). Sie schmeichelt herrlich übertrieben, wie eine treue Hofdame im Theater.
- **Wo:** auf jedem Server mit dem Bot, in jedem Modus.
- **Im Dashboard** unter Julia → Einstellungen → „👑 Julia verehrt den Herrscher“:
  - an/aus (Standard: an),
  - eigener Titel (z. B. „Kaiser von Moin“),
  - auf Wunsch zusätzlich den Owner des jeweiligen Servers verehren.
- **„Julia testen“** im Dashboard zeigt das Verhalten direkt.

## Grenzen (mit Philip besprochen)
- **Nie sexuell.** Es bleibt humorvoll und mit Augenzwinkern.
- **Julias Grundregeln gelten auch für den Herrscher.** Lehnt sie etwas ab, dann besonders untertänig und charmant.
- **Abgelehnt:**
  - Flirt immer an ohne Altersprüfung,
  - sexuelle Inhalte,
  - jemanden ohne dessen Zustimmung anmachen,
  - Sicherheitsregeln abschalten.
- **Stattdessen geplant:** Flirt-Ton per Zustimmungs-Knopf (jede Person stimmt für sich selbst zu), siehe FORTSCHRITT.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Instanz-Admin ist Herrscher, andere nicht; Server-Owner nur wenn eingeschaltet; aus = niemand | ✓ neu |
| Anweisung enthält Titel, Verneigung, „niemals sexuell“, Grundregeln; bei anderen kein Herrscher-Text | ✓ neu |
| Klick-Test: Titel ändern bleibt gespeichert | ✓ neu |
| Klick-Test 175/175 (zweimal hintereinander), Seiten-Durchlauf 42 × 2, Bot 208, Shared 112, DB 6 | ✓ |
