# 01 – Recherche

**Datum:** 08.10.2026 · **Phase:** 1 (kein Code) · **Status:** wartet auf Bestätigung der Funktionsliste

## Was gemacht wurde
Vier parallele Recherchen gegen aktuelle Quellen (Stand Oktober 2026):
1. GalaxyBot und vergleichbare Bots (MEE6, Carl-bot, Ticket Tool, Streamcord, Dyno, Sapphire, Wick, Pingcord)
2. discord.js und Discord-API (Intents, Rate-Limits, altersbeschränkte Kanäle, OAuth2)
3. Plattform-APIs für Live-Alerts und Sub-Sync (Twitch, YouTube, TikTok, Kick)
4. Proxmox Community Scripts (Aufbau, Stil, Update-Mechanismus)
5. Anthropic API (Modelle, Preise, Caching, Kostenkontrolle)

---

## 1. Marktüberblick

| Bot | Stärken | Dashboard | Bezahlschranke |
|---|---|---|---|
| **GalaxyBot** | 15 Module: Tickets (Transcripts, Feedback), Voice-Support mit Öffnungszeiten, Team/Bewerbungen, Twitch/YT (~45 s Verzögerung), Captcha, Engagement Rewards | Modul-Kacheln an/aus, zusätzlich alles per `/set` | Alles gratis; „Plus“ = eigenes Branding |
| **MEE6** | Leveling, viele Social Alerts | Plugin-Marktplatz | Twitch-Alerts und Level-Rollen kosten (~12 $/Monat/Server) |
| **Carl-bot** | Reaction Roles, Automod, Logging, Embed-Builder | klassisch | ~8 $ für Komfort |
| **Ticket Tool** | Panels, Transcripts, Web-Bearbeitung von Tickets | Voll im Web | KI/SLA kostenpflichtig (Zuordnung unsicher) |
| **Streamcord** | Twitch/YT/Kick, Live-Rolle, Schedule-Sync | einfach | Free nur 5 Streamer, Stream-Plan nur Pro |
| **Wick** | Anti-Nuke mit Schwellen, Panic Mode, Wiederherstellung | Web | ~5 $ |
| **Pingcord** | 8+ Plattformen inkl. TikTok | Nachrichten-Vorschau | Kick und volle Embed-Kontrolle nur Premium |

Quellen: [galaxybot.app/en/features](https://galaxybot.app/en/features), [top.gg GalaxyBot](https://top.gg/bot/576764876924387328), [MEE6 Limits](https://help.mee6.xyz/articles/620058-mee6-social-alerts-for-discord-limits-and-restrictions), [streamcord.io/pro](https://streamcord.io/pro/), [pingcord.xyz](https://pingcord.xyz)

> Nicht prüfbar: Das GalaxyBot-Dashboard selbst ist nur mit Login sichtbar, Navigation und Embed-Builder konnten nicht direkt angesehen werden.

### Lücken für Streamer
1. **Kick und TikTok** sind schlecht abgedeckt (GalaxyBot: nur Twitch/YT; Kick oft Premium).
2. **Sub-Rollen-Sync** gibt es außer für Twitch kaum.
3. **Clip-Kanäle** brauchen einen extra Bot.
4. **Stream-Plan als Discord-Events** nur bezahlt (Streamcord Pro).
5. **Basisfunktionen hinter Bezahlschranke** (Level-Rollen, Alerts) – Hauptgrund für Wechsel.
6. **Feste Limits und Alert-Verzögerung.**
7. **KI-Chat** praktisch nirgends (nur bezahlte KI-Zusammenfassungen).

### UX-Ideen, die wir übernehmen
- Modul-Kacheln mit Schalter + Detailseite pro Modul
- Embed-Builder mit Discord-Optik-Vorschau und Variablen (`{user}`, `{streamer}`, `{game}`)
- Live-Rolle mit Whitelist; Alert-Filter nach Spiel/Titel; Live-Post nach Stream durch VOD-Zusammenfassung ersetzen
- Anti-Nuke verständlich als „X Aktionen in Y Sekunden → Aktion“
- Öffnungszeiten für Voice-Support

---

## 2. Discord / discord.js

| Thema | Stand | Auswirkung |
|---|---|---|
| discord.js | **14.27.0** stabil; v15 nur `dev`-Builds | v14 nehmen, aber v15-kompatibel schreiben (`clientReady`, `MessageFlags.Ephemeral`, `withResponse`) |
| Node | v15 braucht ≥ 24.17 | **Node 24 LTS** |
| API | v10, Doku jetzt unter docs.discord.com/developers | – |
| Components V2 | in v14 unterstützt (Container, Sections, max. 40 Komponenten) | moderne Panels für Tickets/Alerts möglich |
| Modals | Selects, Checkboxen, Radio, **Datei-Upload** | Ticket-/Bewerbungs-Formulare ohne Web-Umweg |
| Privilegierte Intents | Seit 06/2026: Prüfung erst ab **10.000 Nutzern**, jährlich | Für einen selbst gehosteten Bot reicht Einschalten im Developer Portal |
| Channel-Verschleierung | ab 16.11.2026 Pflicht: Kanäle ohne VIEW_CHANNEL heißen `___hidden___` | Bot braucht in Log-/Ticket-Kanälen Leserechte; Dashboard muss das anzeigen |

**Benötigte Intents:** Guilds, GuildMessages, **MessageContent** (Logging, Julia, Automod), **GuildMembers** (Willkommen, Auto-Rollen, Anti-Raid), GuildVoiceStates (Voice-XP, Warteraum), GuildModeration (Audit-Log → Anti-Nuke), AutoModerationConfiguration/-Execution, GuildMessageReactions (Starboard), GuildPresences **nicht** nötig (Live-Rolle läuft über die Plattform-APIs).

**Rate-Limits:** 50 Req/s global; 10.000 ungültige Requests (401/403/429) in 10 min → IP-Sperre; Kanal umbenennen **2× pro 10 min** (praktisch bestätigt, nicht offiziell) → Statistik-Kanäle höchstens alle 10 min aktualisieren; 1000 Identifies/24 h.

**Altersbeschränkte Kanäle & Flirty-Modus:**
- Kanäle haben das Feld `nsfw` (= „altersbeschränkt“), in discord.js `channel.nsfw`.
- Seit **22.09.2026 gilt weltweit „Teen-by-default“**: Nur von Discord altersverifizierte Erwachsene sehen altersbeschränkte Kanäle. Das ist eine **zusätzliche, von Discord durchgesetzte Sicherung** für den Flirty-Modus.
- Apps bekommen **kein Alters-Feld** per API → wir verlassen uns auf `nsfw`-Kanal + eigene 18+-Rolle + Opt-in + Sperrliste.
- Discord-Richtlinien: sexuelle Inhalte nur in altersbeschränkten Kanälen; Sexualisierung Minderjähriger verboten, ausdrücklich auch KI-generiert. Unser Flirty-Modus bleibt ohnehin „verspielt, nie explizit“.
- Developer Policy (nicht abrufbar, aus Kenntnisstand): Nachrichteninhalte nicht zum KI-Training nutzen, Datenminimierung. → Julia speichert nur, was nötig ist; Gedächtnis pro User ist einsehbar und löschbar.

**OAuth2 (Dashboard):** Scopes `identify guilds` (+ `guilds.members.read` für Rollenprüfung); Redirect-URI muss exakt eingetragen sein, in Produktion HTTPS; `state` als CSRF-Schutz.

Quellen: [npm discord.js](https://www.npmjs.com/package/discord.js), [discordjs.guide/v15](https://discordjs.guide/v15), [Discord Changelog](https://docs.discord.com/developers/change-log), [Rate Limits](https://docs.discord.com/developers/topics/rate-limits), [Channel-Objekt](https://docs.discord.com/developers/resources/channel), [OAuth2](https://docs.discord.com/developers/topics/oauth2), [Community Guidelines](https://discord.com/guidelines)

---

## 3. Plattform-APIs (Live-Alerts & Sub-Sync)

Der Bot soll **keinen offenen Port** brauchen. Das klappt für alle Live-Alerts:

| Plattform | Weg | Ohne offenen Port? | Risiko |
|---|---|---|---|
| **Twitch** | EventSub über **WebSocket** (braucht einmalige Freigabe des Streamers per OAuth); für fremde Kanäle zusätzlich Helix-Polling alle 60 s | ✓ | niedrig |
| **YouTube** | RSS-Feed alle 5 min (0 Quota) + `videos.list` (1 Unit für bis zu 50 Videos) für Live-Status | ✓ | niedrig |
| **YouTube Shorts** | kein offizielles Merkmal → Prüfung über `youtube.com/shorts/{id}` + Dauer ≤ 3 min | ✓ | mittel (inoffiziell) |
| **Kick** | offizielle API, Polling `/public/v1/users/livestreams` (bis 100 Kanäle pro Aufruf) | ✓ | niedrig–mittel (junge API) |
| **TikTok** | **keine offizielle Live-API**; nur Scraping/inoffizielle Bibliotheken | ✓ | **hoch** (AGB-Verstoß, bricht oft) |

**Sub-/Mitglieder-Sync:**
- **Twitch-Subs:** machbar (Streamer autorisiert einmal mit `channel:read:subscriptions`, Abgleich alle 15 min + Live-Event bei neuem Sub).
- **YouTube-Mitglieder:** API nur nach Freischaltung durch Google, für normale Creator praktisch nicht verfügbar → **Discords eigene YouTube-Verknüpfung nutzen** (vergibt Mitglieder-Rollen selbst).
- **Kick-Subs:** nur per Webhook → braucht öffentlichen Endpunkt. Lässt sich später über die Dashboard-Domain lösen.

Quellen: [Twitch EventSub WebSocket](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/), [Twitch Subscriptions](https://dev.twitch.tv/docs/api/reference/#get-broadcaster-subscriptions), [YouTube Quota](https://developers.google.com/youtube/v3/determine_quota_cost), [YouTube members.list](https://developers.google.com/youtube/v3/docs/members/list), [TikTok Scopes](https://developers.tiktok.com/doc/tiktok-api-scopes/), [Kick Livestreams](https://docs.kick.com/apis/livestreams.md), [Kick Events](https://docs.kick.com/events/event-types.md)

> Unsicher: neues YouTube-Quotamodell für `search.list` (wir nutzen es ohnehin nicht), Twitch-Kosten für fremde Kanäle per WebSocket, Kick-Rate-Limits (nicht dokumentiert).

---

## 4. Anthropic API (Julia)

| Modell | ID | Input / Output pro 1 Mio. Tokens | Einsatz |
|---|---|---|---|
| Claude Haiku 4.5 | `claude-haiku-4-5` | 1 $ / 5 $ | **Standard** – schnell, günstig, reicht für Chat |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | 2 $ / 10 $ | „Qualität“ – im Dashboard wählbar |
| Claude Opus 5.5 | `claude-opus-5-5` | 4 $ / 20 $ | nur bei Bedarf |

- Offizielles SDK `@anthropic-ai/sdk`, Key nur in der `.env` des Bot-Containers.
- **Prompt-Caching:** fester Persona-/Regel-Prompt vorne, wechselnder Kontext dahinter → spart Kosten bei jeder Antwort.
- **Kosten:** Jede Antwort liefert `usage` (Input-, Output-, Cache-Tokens) → wir rechnen pro Anfrage in Euro/Dollar um, summieren pro Monat, Warnung bei z. B. 80 %, harte Sperre bei 100 %.
- Die Sicherheitsregeln (Flirty nie explizit, Regeln nicht aushebelbar) stehen im System-Prompt; die *Entscheidung*, ob Flirty überhaupt erlaubt ist, trifft der **Bot-Code vorher** (Kanal, Rolle, Opt-in, Sperrliste) – nicht das Modell.

---

## 5. Proxmox-Installer

- Die Community Scripts haben ihre Engine 2026 in ein eigenes Repo (`community-scripts/core`, MIT) ausgelagert. Fremdes `build.func` per curl einzubinden ist **nicht sinnvoll**: Es lädt Installskripte hart aus deren Repo, schreibt `/usr/bin/update` auf deren Skripte, sendet Telemetrie und ändert sich häufig.
- **Entscheidung:** eigener Installer im **gleichen Stil** (Whiptail Standard/Erweitert, Spinner, farbige ✓/✗, `var_*`-Variablen überschreibbar), ca. 150 Zeilen Hilfsfunktionen.
- **LXC (Standard):** Debian 13, unprivilegiert, `nesting=1,keyctl=1`, Docker aus offiziellem Repo, `pct exec` statt `lxc-attach`.
- **VM (Option):** Debian-13-Cloud-Image, `qm disk import`, Cloud-Init, qemu-guest-agent.
- Proxmox VE 9.1 aktuell (Debian 13 „Trixie“); Installer prüft 8.x–9.x.
- Fallstrick: Bei `curl | bash` gibt es kein TTY → Whiptail liest von `/dev/tty`.
- Repo ist **öffentlich** → der Einzeiler funktioniert ohne Token.

---

## 6. Tech-Stack (Empfehlung)

| Teil | Wahl | Begründung |
|---|---|---|
| Struktur | Monorepo mit pnpm-Workspaces: `apps/bot`, `apps/dashboard`, `packages/db`, `packages/shared` | Bot und Dashboard teilen DB-Schema, Typen und Modul-Definitionen |
| Bot | TypeScript, discord.js 14.27, Node 24 | wie vorgeschlagen, v15-fest |
| Dashboard | **Next.js** (App Router) + Tailwind, Login über Auth.js mit Discord | größtes Ökosystem, gut dokumentiert; SvelteKit wäre auch möglich, bringt hier aber keinen Vorteil |
| DB | PostgreSQL 17 + Prisma (Migrationen) | wie vorgeschlagen |
| Cache/Queues | Redis + BullMQ | Polling-Jobs (Alerts), Erinnerungen, Giveaways, Auto-Close |
| Kommunikation Dashboard → Bot | Redis Pub/Sub | Einstellungen greifen sofort, ohne Neustart |
| i18n | Deutsch Standard, Englisch umschaltbar pro Server | Textschlüssel von Anfang an, nicht nachträglich |
| Screenshots | Playwright | für das Bauprotokoll |

---

## 7. Funktionsliste – Muss / Soll / Später

Die Nummern in Klammern verweisen auf die Modul-Reihenfolge aus Phase 3.

### Muss
| Modul | Umfang |
|---|---|
| Grundgerüst (Phase 2) | Modul-System (an/aus pro Server), Dashboard mit Discord-Login, Rechte Owner/Admin/Mod, DE/EN-Struktur, Installer + Update mit Rollback, `/ping` |
| (1) Logging | Nachrichten bearbeitet/gelöscht, Joins/Leaves, Rollen- und Nickname-Änderungen, Kanal-Änderungen, Voice-Joins; je Ereignis eigener Kanal wählbar |
| (2) Moderation | ban/kick/timeout/warn mit Grund und Fall-Nummer, Mod-Log, Fall-Liste im Dashboard, Warn-Eskalation (z. B. 3 Warns → Timeout); Automod: Bad-Words, Links, Mention-Spam über **Discords eigene AutoMod-API**, dazu Spam und Caps im Bot |
| (3) Server-Schutz | Anti-Raid (Join-Welle → Lockdown), Anti-Nuke über Audit-Log („X Aktionen in Y s → Rechte entziehen“), Button-Verifizierung, Account-Alter-Filter |
| (4) Willkommen & Rollen | Willkommen/Abschied mit generiertem Bild, Auto-Rollen, Button-/Select-Rollen; **Embed-Builder mit Live-Vorschau** (wird von allen späteren Modulen genutzt) |
| (5) Tickets | Panels, Kategorien, Formular-Fragen (Modal), Claim/Assign, HTML-Transcripts (im Dashboard ansehbar), Feedback nach Schließen, Auto-Close bei Inaktivität |
| (7) Live-Alerts | Twitch, YouTube (Live, Videos, Shorts), Kick; eigene Embeds je Plattform, Rollen-Ping, automatische Live-Rolle |
| (8) Level & XP | Text- und Voice-XP, Level-Rollen, Rangkarte als Bild, Leaderboard im Dashboard |
| (10) Julia-KI Basis | @Erwähnung, Chat-Kanäle, `/julia`, Kontext der letzten N Nachrichten, Persona-Editor, Modellwahl, Rate-Limit pro User/Kanal, Monatsbudget mit Warnung + harter Grenze, Schutz gegen Regel-Aushebeln |
| (11) Julia Persona & User-Profile | Anrede/Titel, Spitznamen, Wissen über Personen, Tonfall-Stufen; Flirty-Modus mit allen Sicherungen (Opt-in + 18+-Rolle + altersbeschränkter Kanal + dauerhafte Sperre bei Angabe < 18 + `/julia optout`) |

### Soll
| Modul | Umfang |
|---|---|
| (5) Tickets | Voice-Support-Warteraum mit Ankündigung im Team-Kanal, optional Öffnungszeiten |
| (6) Team-System | Bewerbungen per Formular, Annehmen/Ablehnen, Team-Statistiken (Tickets, Aktivität), Abwesenheitsmeldungen |
| (7) Live-Alerts | Twitch-Sub-Sync → Rollen; Alert-Filter nach Spiel/Titel; Live-Post nach Streamende in VOD-Hinweis umwandeln; Stream-Planer als Embed + automatische Discord-Events |
| (9) Community | Geburtstage, Zähl-Kanal, Suggestions mit Voting, Starboard; Umfragen (Discords eigene Polls), Giveaways, Erinnerungen |
| (10) Julia | Gedächtnis pro User (einsehbar und löschbar im Dashboard und per `/julia vergessen`) |
| (12) Statistiken | Wachstum, Aktivität, aktivste Mitglieder, Kanal-Statistiken; Statistik-Kanäle (Update höchstens alle 10 min) |
| (3) Server-Schutz | Bild-Captcha zusätzlich zur Button-Verifizierung |
| (13) Feinschliff | vollständige englische Übersetzung, Design-Feinschliff |

### Später
| Funktion | Warum später |
|---|---|
| TikTok-Alerts | keine offizielle API; nur Scraping (AGB-Verstoß, häufige Ausfälle). Wenn gewünscht: als ausdrücklich „experimentell“ markiertes Untermodul |
| YouTube-Mitglieder-Sync | API für normale Creator gesperrt → Discords eigene YouTube-Verknüpfung nutzen |
| Kick-Sub-Sync, schnellere YouTube-Alerts per Push | brauchen öffentlichen Webhook-Endpunkt → später über die Dashboard-Domain |
| Clip-/Highlight-Kanal | Einreichen, Voting, Best-of der Woche – eigenständiges Modul nach Community |
| Engagement Rewards | Rolle für Mitglieder, die den Server-Tag tragen (GalaxyBot-Idee) |
| Konfiguration per `/set` | Alternative zum Dashboard für Mobil-Nutzer |

---

## Bekannte Grenzen / offene Punkte
- GalaxyBot-Dashboard nicht direkt einsehbar (Login).
- Developer Policy von Discord konnte nicht abgerufen werden; vor Julia-Modul nochmal prüfen.
- Kick-Rate-Limits nicht dokumentiert → vorsichtiges Polling (60 s).
- Lokal ist kein Docker installiert; für Tests in Phase 2 wird Docker lokal oder Zugriff auf den Proxmox-Host gebraucht.
