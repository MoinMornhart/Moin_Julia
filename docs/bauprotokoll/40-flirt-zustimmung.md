# 40 – Flirt-Ton per Zustimmungs-Knopf

**Datum:** 11.10.2026 · **Version:** 0.35.0 · **Status:** fertig und getestet

Philips Wünsche dazu:
- „Dann mach halt, dass man davor zustimmen soll.“
- „Mach Flirty Mode noch krasser, sehe bisher noch nichts davon.“
- Hinweis: „Alle auf dem DC von mir sind 18, Ozzy auch.“

## Warum bisher „nichts zu sehen“ war
Der Flirt-Ton braucht fünf Dinge:
- Er ist auf dem Server erlaubt.
- Eine 18+-Rolle ist eingestellt.
- Die Person hat diese Rolle.
- Der Kanal ist altersbeschränkt.
- Die Person hat selbst zugestimmt.

Bisher ging die Zustimmung nur über `/julia flirty an` mit Altersangabe. Kaum jemand hat das gemacht, und nirgends stand, was fehlt.

## Neu
- **Zustimmungs-Knopf:** Schreibt jemand Julia in einem altersbeschränkten Kanal an, hat die 18+-Rolle und es fehlt nur noch die Zustimmung, fragt Julia einmal: „😉 @Name, hier darf ich auch flirten – möchtest du das?“
  - Die Knöpfe sind „Ich stimme zu (18+)“ und „Nein danke“.
  - **Nur die gemeinte Person** kann drücken; alle anderen bekommen „Diese Frage gilt einer anderen Person“.
  - Beim Zustimmen wird die 18+-Rolle noch einmal geprüft.
  - Nach „Nein“ (oder wenn nicht gedrückt wird) fragt Julia 30 Tage nicht erneut.
  - Zurücknehmen geht jederzeit mit `/julia flirty aus`.
- **Spürbarerer Flirt-Ton:** neckische Sprüche, Komplimente, Anspielungen, kokett und frech. Weiterhin **nie sexuell explizit**.
- **„Warum flirtet Julia nicht?“**
  - In Discord zeigt `/julia flirty prüfen` jeder Person genau, was bei ihr fehlt, z. B. „❌ dieser Kanal ist nicht altersbeschränkt · ❌ du hast noch nicht zugestimmt“.
  - Im Dashboard steht unter Julia → Flirt-Ton eine Checkliste: erlaubt? Rolle gewählt? Welche Kanäle sind altersbeschränkt? Wie viele haben zugestimmt?

## Für Philips Server
Da alle 18+ sind:
1. Allen die 18+-Rolle geben.
2. Einen Kanal in Discord auf „Altersbeschränkt“ stellen.
3. Im Dashboard den Flirt-Ton erlauben und die Rolle wählen.

Danach fragt Julia jede Person beim ersten Anschreiben selbst. Jede Person stimmt nur für sich zu, auch Ozzy.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Frage nur, wenn sonst alles passt – und nur einmal | ✓ neu |
| Knopf: andere Person abgelehnt, richtige Person stimmt zu, Knöpfe verschwinden | ✓ neu |
| „prüfen“ nennt genau die fehlenden Punkte | ✓ neu |
| Bisherige Flirt-Regeln (Rolle, Kanal, Alterssperre) | ✓ angepasst |
| Klick-Test: Checkliste im Dashboard; 187/187; Seiten-Durchlauf; Bot 233, Shared 121, DB 6 | ✓ |
