# 68 – Bug-Hunting Runde 2 (Issue #8)

**Datum:** 14.10.2026 · **Version:** 0.56.1 · **Status:** behoben und getestet (Klick-Test nach dem Aufräumen der vollen Festplatte nachgeholt)

Vier Prüfer haben parallel gesucht: Dashboard-Aktionen, Musik/Julia/Sprachkanäle, übrige Bot-Module und Oberfläche + gemeinsamer Code. Insgesamt kamen rund 50 Funde zurück. Jeder wurde im Code nachgeprüft, über 40 sind behoben.

## Behoben (Auswahl, nach Schwere)
- **Sprachkanäle:**
  - Sperren und Verstecken haben Kanäle in privaten Kategorien für alle geöffnet. Jetzt wird das abgelehnt.
  - „Übernehmen“ ging auch für Leute außerhalb des Kanals. Jetzt geht es nur noch von innen.
  - Doppelte Rechte-Einträge werden zusammengeführt.
  - Zweimal schnell in den Erstell-Kanal ergab zwei Kanäle. Jetzt entsteht nur noch einer.
  - Fehler beim Umbenennen wurden nicht abgefangen.
- **Julia:**
  - Das Werkzeug „Rolle anlegen“ konnte Mod-Rechte an Leute geben, die selbst keine haben. Das ist jetzt gesperrt (wie in Discord).
  - Die Stimme hat die Musik-Verbindung zerstört. Das passiert nicht mehr.
- **Musik:**
  - Zwei gleichzeitige Befehle haben zwei Player erzeugt.
  - Die Selbstheilung hat sich selbst abgebrochen.
  - Der Such-Zwischenspeicher wuchs ohne Grenze.
- **Sicherheit:**
  - Geschützte Rollen gelten jetzt sofort nach dem Start.
  - Fehlschlagende Befehls-Abgleiche verhindern den Modul-Start nicht mehr.
  - Selbstbedienung sperrt zusätzlich Stummschalten, Verschieben, Spitznamen, Threads, Emojis, Events und Audit-Log.
  - Die Rollen-Panel-Antwort nennt nur Rollen, die wirklich vergeben wurden.
  - „Rollen anpassen“ bei Server-Profilen hält jetzt die Rangfolge ein.
- **Raid-Schutz:**
  - Nach einem Neustart blieben Einladungen für immer aus. Jetzt werden sie wieder freigegeben.
  - Hatte das Team Einladungen schon vorher pausiert, bleiben sie pausiert.
- **Owner-Bereich:** Eine wiederhergestellte oder bewusst angelegte Admin-Rolle wurde sofort wieder umgestellt. Das ist behoben.
- **Wartung:**
  - Tickets schließen nicht mehr automatisch.
  - Probezeit-Erinnerungen, Sprachminuten und DM-Knöpfe pausieren.
- **Tickets:** Geschlossene Ticket-Kanäle werden auch nach einem Neustart gelöscht.
- **Bewerbungen:**
  - Annehmen/Ablehnen geht atomar, wirkt also nur einmal, auch bei gleichzeitigen Klicks.
  - Einladen und Weitergeben prüfen, ob die Bewerbung noch offen ist.
  - Wer nach dem Login beigetreten ist, darf sich bewerben.
- **Dashboard:**
  - Der Export mit „keine Module“ hat bisher alle Module exportiert.
  - Ein leeres XP-Feld hat XP auf 0 gesetzt.
  - Beim Speichern im Knopf-Stil gingen die Rollen-Beschreibungen verloren.
  - Ein neu angelegter Erstell-Kanal wurde beim Speichern überschrieben.
  - Zwei Uploads gleichzeitig: einer ging verloren.
  - Die Mitglieder-Liste wurde nicht mehr live aktualisiert.
  - Neue Abstimmungs-Kanäle haben Eingaben überschrieben.
  - Beim Entfernen einer Personen-Ausnahme rutschte das Suchfeld in die falsche Zeile.
  - Mehrere Aktionen stürzten ab statt eine Meldung zu zeigen (JSON, Discord nicht erreichbar).
  - Bei aktiven Profilen wurden alte Sicherungen gelöscht.
  - Ein erneutes Einrichten hat gespeicherte Schlüssel gelöscht.
- **Julia-Herrscher:** Normale Sätze wie „antworte nur kurz und sag mir …“ oder „mach @Max zum Lachen“ lösten keine Befehle mehr aus.
- **Julia-Einstellungen:** Ein veraltetes KI-Modell setzte nicht mehr die ganze Julia-Konfiguration zurück.
- **Speicher:** Captcha-, Nuke-, Flirt- und XP-Merklisten werden aufgeräumt.

## Bewusst (noch) nicht geändert
- Eskalationsstufen bei zwei gleichzeitigen Verwarnungen (selten; braucht eine Sperre in der Datenbank).
- Starboard zählt höchstens 100 Sterne pro Nachricht (Discord-Limit pro Abruf).
- Doppelte Musik-Panels bei zwei gleichzeitigen Befehlen (nur kosmetisch).
- Leere Embed-Felder: Der Fehler beim Speichern ist korrekt, nur die Meldung ist unklar.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Unit shared 184, Bot 302 (neu: Übernehmen nur im Kanal, Rechte zusammenführen, Mod-Rolle nur mit eigenen Rechten, Herrscher-Sätze) | ✓ |
| Typprüfung Bot + Dashboard (Build kompiliert) | ✓ |
| Klick-Test 251/251, Seiten-Durchlauf 43 × 2 | ✓ |
