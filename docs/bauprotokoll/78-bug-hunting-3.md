# 78 – Bug-Hunting Runde 3

**Wunsch Philip (14.10.2026):** „intensiven Bug-Test, wirklich jede Lücke, und schau die Issues an“.

Fünf Prüf-Durchgänge parallel (Sicherheit/Rechte, Bot-Module, Dashboard-UI, Infrastruktur/Skripte, neue Funktionen seit 0.57). Rund 90 Funde; abgearbeitet in Teilen, jeweils mit eigener Version.

Issues: #7 und #8 sind erledigt und geschlossen, #1 (Sammel-Issue) bleibt offen.

## Teil 1 – Sicherheit (0.64.2)

### Rechte im Dashboard
- **Mitglieder-Rollen:** Admins ohne Owner-Status durften Rollen an Leute über sich geben oder Rollen mit Rechten verteilen, die sie selbst nicht haben. Jetzt gilt dasselbe wie in Discord:
  - nur Personen unter dir;
  - nur Rechte, die du selbst hast (`canGrantPermissions`);
  - Entfernen nur mit „Rollen verwalten“.
  - Die Liste zeigt danach die echten Rollen der Person.
- **Ränge bauen/ändern:** gleiche Rechte-Prüfung.
- **Höchste Rolle:** Rollen von Bots/Integrationen zählen jetzt mit (vorher konnte die Reihenfolge falsch berechnet werden).
- **Owner-Status:** kommt nur noch aus den aktuellen Server-Daten, nicht mehr aus dem Login-Schnappschuss. Wer die Owner-Rolle abgegeben hat, ist sofort kein Owner mehr.
- **Vorlagen und Julia:** Felder, die nur der Instanz-Admin setzen darf, können weder per Vorlage noch per Julia geändert werden:
  - Julia: eigene KI-Adresse;
  - Musik: private Adressen;
  - alles mit URL/Key/Token/Passwort.
- **Julia:**
  - Kanalverlauf kann keine versteckten Befehle mehr einschleusen (Marker werden entschärft).
  - Das Einstellungs-Werkzeug bekommt nur, wer es darf.
- **„Probe hören“** zählt jetzt zum KI-Verbrauch.
- **Probezeit:** Zwei gleichzeitige Klicks führen nur noch zu EINER Entscheidung.
- **Profil anwenden:** gesperrt gegen Doppelklick/zwei Tabs.

### Datenbank
- **Schlüssel:** Verschlüsselte Einstellungen bleiben lesbar, wenn sie noch mit dem alten, aus dem Datenbank-Passwort abgeleiteten Schlüssel gespeichert wurden.

### Update-Skript (`scripts/moin-julia`)
- **Restore:** Das gewählte Backup wird vorher beiseitegelegt. Vorher konnte die Backup-Rotation ausgerechnet diese Datei löschen. Scheitert der Restore, wird der Stand von vorher wieder eingespielt.
- **Update-Knopf im Dashboard:** Das Update läuft als eigener Prozess. In `( … ) || rc=$?` schaltet bash `set -e` ab, Fehler wären still übergangen worden.
- **Image-Sicherung:** Fehlt ein Image, endet das Skript nicht mehr still (`if … then` statt `a && b`).
- **Austausch-Datei:** Rechte werden schon beim Anlegen gesetzt (umask) statt danach per `chmod`, das einem Symlink folgen könnte.
- **`.env`-Ergänzungen:** Wenn die Datei ohne Zeilenumbruch endet, wird der neue Eintrag nicht mehr an die letzte Zeile geklebt.

### Neue Funktionen (seit 0.57)
- **Julia im Call:**
  - Fehler der Sprachverbindung bringen den Bot nicht mehr zum Absturz.
  - Zwei Sätze gleichzeitig werden nicht mehr doppelt verarbeitet.
  - Bei Wartung geht Julia aus dem Call; auf Test-Servern bleibt sie.
  - Einstellungen per Stimme werden wie im Text angewendet (Ergebnis + „Rückgängig“ im Textkanal).
- **Musik:** nimmt Julia den Call nicht mehr weg. Stattdessen kommt eine Meldung: „erst dort beenden“.
- **Weckwort:**
  - feste Liste statt Tippfehler-Suche: „Julian“ und „Julias“ wecken Julia nicht mehr;
  - „Ähm Julia …“ und „Äh Julia …“ gehen jetzt.
- **„Rückgängig“ (Julia-Einstellungen):**
  - geht auch, nachdem Julia sich selbst ausgeschaltet hat;
  - dreht nichts zurück, was inzwischen jemand anders geändert hat.
- **Bewerbungsfragen aus Text:**
  - Sind einzelne Fragen mit `*` markiert, sind nur diese Pflicht.
  - `(optional)` macht eine Frage freiwillig.
  - Vorher war immer alles Pflicht.
  - „… über dich“ wird als langes Feld erkannt.
- **Für Dummies:** Namen aus Discord (Mitglieder, Rollen, Kanäle, Nachrichten) werden nicht mehr umgeschrieben. Das Umschreiben beginnt erst, wenn die Seite fertig geladen ist.
- **Server-Übersicht:** „Mitlesen“ wählt den Kanal per ID. Zwei Kanäle mit gleichem Namen sind jetzt eindeutig.

### Tests
- **Unit:** 528 grün (shared 210, db 7, bot 311). Neu sind Tests für Weckwort, Pflichtfragen und `canGrantPermissions`.
- **Klick-Test:** bestanden.
- **Sweep:** 43 Seiten × 2, keine Probleme.
- **Update-Simulator:** 31/31.

## Noch offen (nächste Teile)
- **Bot-Module:**
  - Moderation: `/case pardon` des eigenen Falls, Eskalationsstufen (`>=`), Anti-Nuke bei Bot-eigenem `/ban`.
  - Kanäle und Rollen: Rollen-Schutz bei Kanal-Overwrites, Tempvoice-Kick von Team/Bot.
  - Tickets und Gewinnspiele: Ticket hängt in „schließt“, Gewinnspiele sauber beenden.
  - Weitere kleinere Punkte.
- **Dashboard-UI:**
  - Formulare dürfen keine Rollen löschen, wenn Discord-Daten nicht geladen wurden.
  - Löschen erst nach Bestätigung.
  - Enter in Suchfeldern löst nichts aus.
  - Veraltete Musik-Positionen.
  - Weitere kleinere Punkte.
