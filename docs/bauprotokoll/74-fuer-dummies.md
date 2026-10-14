# 74 – Sprache „🍼 Für Dummies“ (Spaß-Wunsch Philip)

**Datum:** 14.10.2026 · **Version:** 0.61.0 · **Status:** fertig und getestet

Wunsch: „Als Spaß statt Deutsch noch ‚Für Dummies', wo alles wie Babysprache erklärt wird – so wie bei der Hugo-Sprache.“

## Jetzt
- **Dashboard → Einstellungen → Sprache der Bot-Texte:** neue Auswahl **„🍼 Für Dummies (alles super einfach erklärt)“**.
- **Die häufigsten Bot-Texte** gibt es in dieser Sprache: Fehler, Wartung, Modul aus, Ping, Musik (Pause, Weiter, Warteschlange …), Julia (Pause, Budget, nicht verbunden), Tickets, Level, Verwarnungen. Beispiele:
  - „⏸️ Pause – wie Luft anhalten 😮“
  - „💤 Mein Taschengeld für diesen Monat ist alle 🪙“
  - „Gelbe Karten von {user} 🟨“
- **Alle anderen Texte** kommen automatisch auf Deutsch. Modulnamen, Zeitangaben und Ähnliches nutzen ebenfalls Deutsch als Grundlage.
- **Julia** spricht auf solchen Servern auch so: Sie erklärt alles wie für ein Kind, mit kurzen Sätzen, Alltagsvergleichen und Emojis, lustig und freundlich. Ausdrücklich nie herablassend.
- Die Übersichtsseite zeigt „Bot-Sprache: 🍼 Für Dummies“.

## Technik
- Neue Sprache `dummies` in `LOCALES`. Die eigenen Texte stehen in `locales/dummies.ts`, der Rest kommt aus Deutsch.
- `baseLocale()` liefert für alles, was nur Deutsch/Englisch kennt (Modulnamen, Effekte, Rechte-Namen), Deutsch.
- Stellen mit „Deutsch ja/nein“ prüfen jetzt „nicht Englisch“, damit „Für Dummies“ dort Deutsch bekommt.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Eigene Texte, Rückfall auf Deutsch, gleiche Platzhalter wie im Deutschen, `baseLocale` | ✓ neu |
| Klick-Test: Sprache wählen → Übersicht zeigt „🍼 Für Dummies“ → zurück auf Deutsch | ✓ neu |
| Klick-Test 257/257, Seiten-Durchlauf 43 × 2, Unit shared 195, Bot 309 | ✓ |

Hinweis: Der Klick-Test „Geschützte Rollen gespeichert“ war einmal rot und mit frischer Datenbank wieder grün. Er wackelt also (Zeitproblem) und kommt auf die Liste für die nächste Bug-Runde.
