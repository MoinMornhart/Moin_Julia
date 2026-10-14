# 79 – 🍼 Für Dummies „für 1 IQ und weniger“

**Wunsch Philip (14.10.2026):** „mach den Dummi-Knopf so für so richtig Dumme, so 1 IQ und weniger“. Dazu kam ein Screenshot der Statistik: „diese Fenster sind noch zu schlau“.

## Was sich ändert (nur mit 🍼 an)
- **Programme und Bereiche:** ganz kurze Baby-Sätze mit Emojis, zum Beispiel:
  - Statistik: „Guck mal, wie viel los ist! Viel = toll! 📈🥳“
  - Moderation: „Frech? Gelbe Karte! 🟨 Ganz frech? Rote Karte! 🟥“
- **Ganze Überschriften, Kästen, Reiter und Knöpfe** (neue Liste `PHRASE_DUMMIES`):

  | Vorher | Mit 🍼 |
  |---|---|
  | Mitgliederzahl | 👥 So viele Leute sind da |
  | Beitritte & Austritte | 🚪 Rein & raus |
  | Nachrichten pro Tag | 💬 So viel wurde geschrieben |
  | Sprachminuten pro Tag | 🎤 So lange wurde gequatscht |
  | kein Vergleich | 🤷 weiß nicht |
  | Statistik-Kanäle | 📺 Zahlen-Schilder |
  | Übersicht | 👀 Gucken |
  | 7 Tage | 7× schlafen 😴 |
  | Speichern | 💾 Merken! |
  | Löschen | 🗑️ Weg damit |
  | Abbrechen | 🙅 Doch nicht |

- **Texte mit Zahlen:**
  - „-1 % zum Zeitraum davor“ wird zu „📉 1 % weniger als vorher“.
  - „144 rein · 30 raus“ wird zu „🚶‍➡️ 144 rein · 🚶 30 raus“.
- **Mehr Fachwörter ersetzt:** Statistik → Zählerei, Beitritte → Reinkommer, automatisch → ganz von allein, deaktiviert → aus 😴 …

## Regeln
- **Immer lieb, nie gemein:** Die Texte sind witzig, aber niemand wird als dumm bezeichnet.
- **Es wird nur angezeigter Text geändert.**
  - Eingaben, Code und Namen aus Discord bleiben gleich (seit 0.64.2).
  - Knopf-Beschriftungen für Screenreader (aria-label) bleiben gleich.
- **Kein endloses Umschreiben:** Ein zweites Umschreiben ändert nichts mehr. Ein Test prüft das für alle Einträge, sonst würde die Seite bei jeder Aktualisierung weiter wachsen.

## Tests
- **Unit:** Überschriften, Zahlen-Texte und „zweimal umschreiben = einmal“.
- **Klick-Test:** Statistik mit 🍼 zeigt „👥 So viele Leute sind da“ und „🎤 So lange wurde gequatscht“.
