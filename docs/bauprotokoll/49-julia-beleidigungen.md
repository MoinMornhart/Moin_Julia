# 49 – Julia: Beleidigungen löschen und melden (Issue #5)

**Datum:** 11.10.2026 · **Version:** 0.42.0 · **Status:** fertig und getestet

Wunsch von JONIMONI09: Wird Julia beleidigt und der Server erlaubt es, löscht sie die Nachricht und meldet sie.

## So funktioniert es
- **Einschalten:** Dashboard → Julia → „🚫 Beleidigungen gegen Julia“. Ab Werk ist es aus.
- **Was zählt:** Nur Nachrichten **an Julia**, also per @Julia, als Antwort auf sie oder in ihrem Chat-Kanal. Normale Gespräche anderer Leute untereinander fasst sie nicht an.
- **Erkennung im Code, nicht über die KI.** Das kostet nichts, ist zuverlässig und lässt sich nicht überreden:
  - Eine Grundliste eindeutiger Beleidigungen (deutsch und englisch). Alltagswörter wie „dumm“ stehen bewusst nicht drin, ganze Sätze wie „du bist dumm“ schon.
  - Verschleierte Schreibweisen werden mit erkannt: „1d10t“, „IDIOOOT“, „Sch€iß-B0T“.
  - Nur ganze Wörter: „Idiotentest“ oder „Arschbombe“ zählen nicht.
  - Eigene Wörter des Servers, durch Komma getrennt.
- **Was passiert:**
  1. Die Nachricht wird gelöscht. Das braucht „Nachrichten verwalten“; alternativ lässt sich „nur melden“ einstellen.
  2. Im Melde-Kanal erscheint ein Eintrag mit Person, Kanal, erkanntem Wort, „gelöscht ja/nein“ und dem Text. Ohne eigenen Melde-Kanal geht er in Julias Warn-Kanal.
  3. Im Kanal steht kurz „bitte bleib freundlich“. Der Hinweis verschwindet nach 10 Sekunden.
  4. Julia antwortet nicht darauf, es entsteht also kein KI-Aufruf und keine Kosten.
- **Herrscher sind ausgenommen** (Spaß unter sich).

## Wie getestet
| Test | Ergebnis |
|---|---|
| Erkennung: verschleiert, ganze Wörter, keine Fehlalarme, eigene Wörter | ✓ neu |
| Bot: löschen + melden + Hinweis, keine KI-Antwort; „nur melden“; aus/Herrscher/freundlich → normal | ✓ neu |
| Klick-Test: Schalter, eigene Wörter, Melde-Kanal speichern | ✓ neu |
| Klick-Test 202/202, Seiten-Durchlauf 42 × 2, Bot 255, Shared 141 | ✓ |
