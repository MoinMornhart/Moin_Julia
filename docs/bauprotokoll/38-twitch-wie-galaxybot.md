# 38 – Twitch wie GalaxyBot

**Datum:** 11.10.2026 · **Version:** 0.33.0 · **Status:** fertig und getestet

Philips Wunsch:
- Twitch soll 1:1 wie GalaxyBot aussehen.
- Es soll funktionieren und „nicht immer so rumlaggen“.
- Dazu: Jeder Server soll Twitch & Co. selbst einrichten können.

## Was GalaxyBot macht (aus dessen Dokumentation)
GalaxyBot hat für Twitch **vier Darstellungen**:
- **Kategorie** (empfohlen): eigene Kategorie mit Stream-Kanal und Info-Kanälen (Titel, Online-Zeit, Zuschauer).
- **Kanal:** eigener Kanal mit Benachrichtigungs-Rolle.
- **Event:** ein Discord-Event, solange der Stream läuft.
- **Klassisch:** Meldung in einen vorhandenen Kanal; Platzhalter `%PING%`, `%STREAMER%`, `%TITLE%`; in Ankündigungskanälen wird die Meldung auch veröffentlicht.

Dazu gibt es: Aufzeichnungen (VoD) als Thread, den Streamplan, „Neue Rolle erstellen“ und Mitglieder, die selbst entscheiden, ob sie gepingt werden.

## Umgesetzt
- **Alle vier Darstellungen** für Twitch und Kick:
  - **Kategorie:** Der Bot legt die Kategorie „📺 Name“ an, darin den Kanal „🔴│name“ (live) bzw. „⚫│name“ (offline) und drei Info-Kanäle:
    - 📝 Titel,
    - ⏱️ Online: 1 h 20 min,
    - 👀 Zuschauer: 1.234.
    - Die Info-Kanäle kann niemand betreten.
  - **Kanal:** eigener Kanal „🔴│name“ / „⚫│name“, auf Wunsch neben einem gewählten Kanal.
  - **Event:** Discord-Event mit Link, startet mit dem Stream und endet mit ihm. Eine Meldung kommt nur, wenn zusätzlich ein Kanal gewählt ist.
  - **Klassisch:** wie bisher. Neu: Veröffentlichen in Ankündigungskanälen.
- **🔔-Knopf „Benachrichtigungen“** an der Meldung: Mitglieder holen sich die Ping-Rolle selbst oder geben sie wieder ab. Nur Rollen, die ein Feed tatsächlich pingt; keine Rollen mit gefährlichen Rechten.
- **„+ Neue Rolle anlegen“** direkt im Editor (erwähnbar, ohne Rechte).
- **Platzhalter von GalaxyBot** gehen jetzt auch (`%PING%`, `%STREAMER%`, `%TITLE%`). Dazu neu `{ping}`: Steht der Ping im Text, wird er nicht zusätzlich davor gesetzt.
- **Aussehen der Meldung:**
  - Kopfzeile „Name ist jetzt live auf Twitch!“ mit Profilbild,
  - Stream-Titel als Link,
  - Kategorie und Zuschauer,
  - großes Vorschaubild und Profilbild rechts, Fußzeile „Twitch“,
  - Knöpfe „Ansehen“ und „🔔 Benachrichtigungen“.
- **Aufzeichnung (VoD):** Nach dem Stream hängt der Bot die Twitch-Aufzeichnung als Thread an die Meldung.
- **Streamplan:** Eine Nachricht im gewählten Kanal zeigt die nächsten Termine aus dem Twitch-Streamplan (alle 30 Minuten aktualisiert).
- **Schneller und zuverlässiger:**
  - Twitch/Kick werden alle **15 s** statt alle 60 s abgefragt.
  - Ein Stream gilt erst nach **zwei** Abfragen hintereinander als beendet. Ein einzelner Aussetzer der Twitch-API löst also kein „beendet“ und danach keine zweite Meldung mit Ping aus.
  - Kanäle werden höchstens so oft umbenannt, wie Discord erlaubt (2 pro 10 Minuten).
- **Twitch/Kick pro Server:** Unter „Verbindungen“ kann jeder Server eine eigene Twitch-/Kick-App eintragen (verschlüsselt). Ohne eigene App gilt die der Instanz.

## Von Philip zu bestätigen
- **Das genaue Aussehen der GalaxyBot-Meldung** (Farben, Reihenfolge der Felder) steht nicht in deren Doku. Umgesetzt ist der übliche Aufbau. Ein Screenshot einer echten GalaxyBot-Meldung würde helfen, letzte Unterschiede anzugleichen.
- **„Kanäle, die zeigen, ob Mitglieder ihren Ping an haben“** (Kategorie-Darstellung bei GalaxyBot) ist nicht eindeutig beschrieben. Umgesetzt ist das als 🔔-Knopf an der Meldung.
- **Bot-Rechte:** Für Kategorie, Kanal und Event braucht der Bot zusätzlich „Kanäle verwalten“ und „Events verwalten“.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Klassisch: GalaxyBot-Platzhalter, 🔔-Knopf, Ping nicht doppelt, Veröffentlichen im Ankündigungskanal | ✓ neu |
| Kategorie: Kategorie + Stream-Kanal + 3 Info-Kanäle, Namen live/offline, nach Neustart keine doppelten Kanäle | ✓ neu |
| Event: startet aktiv mit Link, endet mit dem Stream | ✓ neu |
| VoD-Thread nach dem Stream, Streamplan-Nachricht | ✓ neu |
| Eigene Twitch-App des Servers vor der der Instanz | ✓ neu |
| 🔔-Knopf: Rolle an/aus, fremde Rollen abgelehnt | ✓ neu |
| „Offline“ erst nach zwei Abfragen | ✓ angepasst |
| Klick-Test: Kategorie ohne Ziel-Kanal, neue Rolle, VoD, eigene Server-App | ✓ neu |
| Bot 224, Shared 121, DB 6, Klick-Test, Seiten-Durchlauf | ✓ |
