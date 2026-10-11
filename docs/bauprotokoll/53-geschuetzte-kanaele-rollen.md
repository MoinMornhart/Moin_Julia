# 53 – Geschützte Kanäle & Rollen (Issue #5)

**Datum:** 11.10.2026 · **Version:** 0.46.0 · **Status:** fertig und getestet

Wünsche von JONIMONI09 (Kommentare in Issue #5):
- Kanäle bzw. Rollen als sicher kennzeichnen; normale Nutzer dürfen sie nicht nutzen; „intelligent machen“.
- „Mache das über die Moderation, sie soll das auch verwalten können, Sicherheit einbauen.“
- „Mit Befehl kann man die über Discord auch als Mod hinzufügen.“

## Was es gibt
**Dashboard → Moderation → „🛡️ Geschützte Kanäle & Rollen“**
- **Geschützte Rollen** (z. B. Moderator):
  - Moin_Julia gibt sie **nie per Selbstbedienung** heraus: keine Rollen-Panels, Auto-Rollen, Verifizierung, Level-Belohnungen, Geburtstag, Live-Rolle oder eigene Sprachkanäle. Das gilt auch, wenn die Rolle selbst keine gefährlichen Rechte hat.
  - Einzige Ausnahme: Bewerbungen. Dort nimmt das Team jemanden bewusst auf.
- **Geschützte Kanäle:**
  - @everyone sieht sie nicht, die geschützten Rollen schon (sehen und schreiben).
  - Der Bot setzt die Rechte beim Speichern und beim Start. Alle anderen Rechte im Kanal bleiben, wie sie sind.
- **„Rechte sofort wiederherstellen“** (ab Werk an): Macht jemand einen geschützten Kanal für alle sichtbar, stellt der Bot die Rechte sofort wieder her und meldet es im Mod-Log. Ausgeschaltet meldet er nur.
- **Intelligent – Vorschläge:**
  - Rollen mit Moderations- oder Verwaltungsrechten (keine Bot-Rollen) und Kanäle, die @everyone schon jetzt nicht sieht, werden erkannt.
  - „Vorschläge übernehmen“ hakt sie an. Gespeichert wird erst mit „Speichern“.

**Discord-Befehl `/geschuetzt`** (nur mit „Server verwalten“):
- `/geschuetzt kanal #kanal schützen|nicht mehr schützen`
- `/geschuetzt rolle @rolle schützen|nicht mehr schützen`
- `/geschuetzt liste`

## Sicherheit
- @everyone und Bot-Rollen lassen sich nicht als „geschützte Rolle“ eintragen. Sonst stünden Team-Kanäle allen offen.
- Wer einen Kanal schützt, ohne dass es eine geschützte Rolle gibt, bekommt einen Hinweis. Sonst sehen ihn nur Admins.
- Eigene Rechte-Änderungen des Bots lösen den Wächter nicht aus (keine Endlosschleife).
- Ist das Moderations-Modul aus, greift nichts davon.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Vorschläge (Team-Rollen, private Kanäle), „sieht @everyone den Kanal?“, nötige Ausnahmen ohne Doppelungen | ✓ neu |
| Geschützte Rolle wird bei Selbstbedienung blockiert, bei Bewerbungen nicht | ✓ neu |
| Absichern beim Laden; zweites Mal nichts zu tun; Modul aus → nichts | ✓ neu |
| Wächter: wiederherstellen + melden; nur melden; fremde Kanäle/eigene Änderungen ignoriert | ✓ neu |
| `/geschuetzt`: nur „Server verwalten“, @everyone abgelehnt, Rolle wird gespeichert | ✓ neu |
| Klick-Test: Vorschlag übernehmen, speichern, Vorschlag verschwindet, Standard „wiederherstellen“ an | ✓ neu |
| Klick-Test 218/218, Seiten-Durchlauf 43 × 2, Bot 271, Shared 152 | ✓ |
