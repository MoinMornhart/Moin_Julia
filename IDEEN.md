# Ideen

Ideen, die unterwegs auftauchen – nicht sofort bauen, sondern hier sammeln.

- Engagement Rewards: Rolle für Mitglieder mit Server-Tag (GalaxyBot)
- Konfiguration auch per `/set`-Slash-Command
- Live-Post nach Streamende automatisch durch VOD-Zusammenfassung ersetzen (Streamcord Pro)
- Webhook-Empfang (Kick-Subs, YouTube-Push) über die Dashboard-Domain statt Polling
- Panic-Mode-Knopf im Dashboard (alle Einladungen pausieren, Slowmode überall)
- Julia: Stream-Zusammenfassung im Discord nach Streamende
- Dashboard-Oberfläche auch auf Englisch (Bot-Texte sind es schon)
- Heller Modus fürs Dashboard (aktuell nur dunkel)
- Feinere Dashboard-Rechte pro Modul (z. B. Mods dürfen Tickets verwalten, aber keine Module schalten)
- Installer: Token-Unterstützung, falls das Repo je privat wird
- Update-Kanal wählbar (stable/dev-Branch) im Installer
- Logging: Rechte-Änderungen an Kanälen (Overwrites) im Detail aufschlüsseln
- Logging: Testnachricht-Knopf im Dashboard („Schick eine Probe-Meldung in den Log-Kanal“)
- Logging: Webhook statt Bot-Nachricht für Log-Kanäle (eigener Name/Avatar „Moin_Julia Log“)
- Moderation: zeitlich begrenzte Banns (braucht Zeitplaner, kommt mit Modul 9)
- Moderation: Fälle im Dashboard bearbeiten/zurücknehmen (aktuell per /case)
- Moderation: Kontextmenü „Verwarnen“ per Rechtsklick auf Nachricht/User
- Schutz: Snapshot von Kanälen/Rollen und Wiederherstellung nach einem Nuke
- Schutz: „Panik-Knopf“ im Dashboard (sofort Raid-Modus + Slowmode überall)
- Schutz: Verifizierung zusätzlich per Bild-Captcha
- Willkommensbild: Emoji-/Fallback-Schrift für Namen mit Sonderzeichen
- Embed-Builder: gespeicherte Vorlagen zum Wiederverwenden
- GalaxyBot-Import: Plus-API (Panels, Kategorien, Fälle) für Server mit GalaxyBot Plus

- **Bilder in Vorlagen mitnehmen (08.10.):** Beim Export hochgeladene Bilder als Base64 in die Vorlage-Datei packen (Größenlimit beachten), beim Import neu anlegen und Verweise umschreiben.

- **Ticket-Panels in Vorlagen (08.10.):** Ticket-Panels beim Export/Import mitnehmen (wie Rollen-Panels), inkl. Kanal-/Rollen-Zuordnung.
- Social-Media-Kanäle in Vorlagen (Export/Import) aufnehmen
- Social Media: Stream-Planer (Twitch-Zeitplan als Embed + Discord-Events), Twitch-Sub-Sync → Rollen, Filter nach Spiel/Titel
- Level: XP-Import aus einer MEE6-Bestenliste (öffentliche Seite) per Klick; Level-Rollen in Vorlagen; Wochen-/Monats-Bestenliste
- Community: Starboard-Bestenliste der Woche, Giveaway-Bonus-Lose für Level/Booster, wiederkehrende Erinnerungen, Geburtstagsliste als Kalender-Embed
- Musik: aktuellen Songtitel von Radiosendern anzeigen (ICY-Metadaten), Musikdateien im Dashboard hochladen, Lieblingssender pro Person

**Aus dem Security-Audit (09.10., niedriges Risiko, siehe [SECURITY_AUDIT.md](SECURITY_AUDIT.md)):**
- Rate-Limiting per Redis-Zähler: Einrichtungs-Code, Admin-Übernahme, Bewerbungen, Uploads (N6)
- Sessions härten: ID nur gehasht in der DB, `__Host-`-Cookie, Leerlauf-Ablauf (N7)
- Aufräum-Job für hochgeladene Bilder, die nie zu einer Bewerbung wurden; eigenes Kontingent für Bewerbungs-Uploads (M9)
- Container: Redis-Passwort, Umgebungsvariablen pro Dienst nur nach Bedarf, Migrationen nicht als root (N9)
- Eigene Rechte-Stufe „nur Bewerbungen“ für Prüfer-Rollen (N11)
- Vorlagen-Import: jede Modul-Einstellung per Schema prüfen, gesperrte Module nicht einschalten (N12)
- Eigene Sprachkanäle: Mods/Bot nicht aussperrbar, „Übernehmen“ nur aus dem Kanal heraus, Namen durch den Wortfilter (N14)
- VM-Installer: Prüfsumme des Debian-Images prüfen, Cloud-Init-Laufwerk nach der Einrichtung entfernen (N15)
- Dashboard: Warnung schon beim Speichern, wenn eine Rolle mit gefährlichen Rechten in Panel/Auto-Rolle/Level gewählt wird (der Bot vergibt sie ohnehin nicht)
- Musik: Spotify-/Apple-Playlists und -Alben (Titelliste aus der Einbett-Seite lesen), Crossfade, Last.fm-Scrobbling
