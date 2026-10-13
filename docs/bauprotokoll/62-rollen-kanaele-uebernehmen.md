# 62 – Rollen & Kanäle übernehmen (Issue #7)

**Datum:** 13.10.2026 · **Version:** 0.52.0 · **Status:** fertig und getestet

Wunsch von JONIMONI09: „Vorhandene Rollen und Kanäle analysieren – bei Profilen fragen, ob vorhandene beibehalten werden; Rollen anpassen.“

## Vorher
- Ein Server-Profil hat nur Rollen und Kanäle mit **genau gleichem Namen** wiederverwendet.
- Bei Kanälen kam noch dazu: Sie mussten in der gleichen Kategorie liegen.
- Alles andere wurde neu angelegt, zum Beispiel „🛡️ Moderator“ statt „Moderator“ oder „lounge“ in einer anderen Kategorie. Das ergab doppelte Rollen und Kanäle.

## Jetzt
- **„Anwenden …“ prüft zuerst den Server** und zeigt für jede Rolle, Kategorie und jeden Kanal des Profils eine Auswahl:
  - **übernehmen: <vorhandener Name>**. Der Bot schlägt vor:
    - gleiche Namen, ohne Rücksicht auf Emojis, Groß-/Kleinschreibung und Trennzeichen;
    - **ähnliche** Namen, zum Beispiel mit Tippfehlern („ähnlich“ markiert).
  - jede andere vorhandene Rolle bzw. jeden Kanal vom passenden Typ (Sprachkanäle nur für Sprachkanäle).
  - **➕ neu anlegen**.
- **„Übernommene Rollen anpassen“** (Häkchen, standardmäßig aus):
  - Die Farbe wird wie im Profil gesetzt.
  - Team-Rollen bekommen fehlende Moderations-Rechte **dazu**, entfernt wird nie etwas. Außerdem werden sie getrennt angezeigt.
  - Der alte Stand jeder Rolle wird gemerkt. **„Deaktivieren“ setzt ihn zurück**, auch wenn man „angelegte löschen“ nicht anhakt.
  - Liegt eine Rolle über der Bot-Rolle, lässt sie sich nicht anpassen. Das wird gezählt und gemeldet, der Rest läuft weiter.
- Übernommene Rollen und Kanäle werden beim Deaktivieren **nie gelöscht**, nur selbst angelegte.
- Sicherheit: Der Browser schickt nur Bauplan-Schlüssel und Discord-IDs. Der Server prüft beides und nimmt eine Auswahl nur an, wenn es die Rolle bzw. den Kanal vom passenden Typ wirklich gibt.

## Entscheidungen (von Philip zu bestätigen)
- Rollen anpassen ist **aus**, bis man es anhakt. So bleibt der bisherige Ablauf („ändert nichts Vorhandenes“) der Standard.
- Ähnliche Treffer werden **vorausgewählt**. Ob übernommen oder neu angelegt wird, ist pro Zeile umstellbar.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Zuordnung: gleich ohne Emojis/Groß-klein, ähnlich mit Tippfehler, Kanäle nur passender Typ | ✓ neu |
| Klick-Test: Vorschlag „Moderator“, fehlende Rolle → neu, Auswahl umstellen, Rollen anpassen, Deaktivieren setzt zurück | ✓ neu |
| Klick-Test 237/237, Seiten-Durchlauf 43 × 2, Unit-Tests shared 170 | ✓ |
