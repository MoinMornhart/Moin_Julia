# 32 – Alles jede Sekunde

**Datum:** 10.10.2026 · **Version:** 0.29.0 · **Status:** fertig und getestet

Philips Wunsch: „Sorge dafür, dass sich der DC-Bot jede Sekunde aktualisiert.“ Auf die Rückfrage, was genau, lautete die Antwort: **„ALLES“**.

## Was jetzt wie schnell ist
| Bereich | Vorher | Jetzt |
|---|---|---|
| Dashboard-Seiten (Bot-Status, Listen, Statistiken, Musik …) | nur beim Neuladen, Musik alle 5 s | **jede Sekunde** |
| Musik-Panel in Discord (Fortschrittsbalken) | alle 15 s | **jede Sekunde** |
| Bot-Status (Herzschlag: online, Ping, Server) | alle 20 s | **jede Sekunde** |
| Statistik-Zähler (Nachrichten, Beitritte) | jede Minute gespeichert | **jede Sekunde** |
| Giveaways beenden, Erinnerungen senden | alle 30 s geprüft | **jede Sekunde** |
| Statistik-Kanäle umbenennen | alle 10 Minuten | alle 5 s geprüft, umbenannt **sobald Discord es erlaubt** |
| Instanz-Einstellungen (Dashboard), YouTube-Schalter (Bot) | 15 s bzw. 30 s gemerkt | **1 s** |
| Discord-Daten im Dashboard (Kanäle, Rollen, Rechte, Bots) | 30–60 s gemerkt | **5 s** |

## Wo es Grenzen gibt (und warum)
- **Statistik-Kanäle:** Discord erlaubt pro Kanal nur **2 Umbenennungen in 10 Minuten**. Wer mehr schickt, wird für längere Zeit gesperrt.
  - Darum: Die ersten zwei Änderungen gehen sofort raus.
  - Danach kommt der dann aktuelle Wert, sobald wieder ein Platz frei ist.
- **Discord-Daten im Dashboard:** 5 statt 1 Sekunde. Sonst würde jede offene Seite Discord jede Sekunde abfragen und Discord sperrt den Bot.
- **Musik-Panel bei vielen Servern:** Discord erlaubt ~50 Anfragen pro Sekunde für den ganzen Bot.
  - Bis 30 gleichzeitig spielende Server: jede Sekunde.
  - Darüber kommt jeder reihum dran (bei 60 Servern alle 2 Sekunden).
- **Mitgliederliste fürs Team:** 30 s statt 5 Minuten (große Discord-Abfrage).
- **Twitch/YouTube-Meldungen:** bleiben vorerst bei 1 Minute. Sie werden im Modul „Twitch wie GalaxyBot“ neu gebaut.
- **Update-Prüfung (GitHub):** bleibt bei 10 Minuten (GitHub erlaubt ohne Anmeldung nur 60 Abfragen pro Stunde).
- **Sprachminuten / Voice-XP:** zählen weiter pro Minute, das ist ihre Einheit.

## Damit nichts unter den Fingern wegspringt
Die Live-Aktualisierung im Dashboard **pausiert automatisch**, wenn:
- man in ein Feld tippt oder eine Auswahl offen hat,
- ein Dialog offen ist oder Text markiert wird,
- der Tab im Hintergrund liegt.

Eingetippte, noch nicht gespeicherte Werte bleiben erhalten.

## Nebenbei: Mini-Scrollleiste weg (Meldung von Philip)
- **Fehler:** Rechts an den Reitern (z. B. Community, Level) erschien eine winzige Scrollleiste (▲ ≡ ▼).
- **Ursache:** Die Markierung des aktiven Reiters ragte 1 Pixel über die Leiste hinaus, und Windows zeigt dafür eine Scrollleiste.
- **Behoben.** Der Seiten-Durchlauf meldet so etwas jetzt auf allen Seiten.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Statistik-Kanal: 2 Umbenennungen sofort, die 3. erst nach 10 Minuten mit dem dann aktuellen Wert | ✓ neu |
| Regel „2 pro 10 Minuten“ (Shared) | ✓ neu |
| Musik-Panel reihum ab 30 Servern | ✓ neu |
| Klick-Test: Dashboard lädt jede Sekunde neu (4 Abrufe in 3,5 s), pausiert beim Auswählen | ✓ neu |
| Seiten-Durchlauf: keine Mini-Scrollleisten (42 Seiten × Desktop/Handy) | ✓ neu |
| Bot 208, Shared 110, DB 6, Klick-Test 174/174, axe | ✓ |
