# Stand: Moin_Julia (Übergabe 2026-10-24)

## Was es ist
Selbst gehosteter Discord-Bot für Streamer und Content Creator (Funktionsumfang wie GalaxyBot) mit Web-Dashboard und der KI „Julia“, die auf dem Server mitredet. Läuft auf Proxmox (LXC als Standard, VM wählbar) oder mit Docker.

## Aktueller Stand
- Version **0.70.3** (Datei `VERSION`). Alle geplanten Module sind gebaut: Logging, Moderation, Server-Schutz, Willkommen & Rollen, eigene Sprachkanäle, Tickets, Teams/Bewerbungen, Social Media (Twitch/YouTube/Kick), Level & XP, Community, Julia (KI-Chat), Statistiken, Musik, Owner-Bereich.
- Dazu: Dashboard mit Einrichtungs-Assistent, Vorlagen/Sicherungen, GalaxyBot-Übernahme, Update-Knopf, Wartungsmodus, „🍼 Für Dummies“-Knopf, Befehls-Übersicht, Ränge-Baukasten/-Fixer, Mitglieder verwalten, Server kopieren, API-Kostenlimit (€ und $).
- Julia: Claude per API-Schlüssel oder Ollama, weitere Anbieter (Gemini, OpenAI-kompatibel), Modi/Persona, Sprachausgabe (Piper, Stimme „Kerstin“) und Gespräch im Sprachkanal (`/julia gespraech`).
- Live-Instanz von Philip: moinjulia.morncloud.de (HTTPS geprüft am 11.10.).
- Tests laut letztem Stand (0.70.3): Unit 555, Klick 277/277, Seiten 44 × 2.

## Zuletzt gemacht
- 2026-10-24: Cloud-Start-Hook (`.claude/hooks/skills-cloud.sh`) installiert Philips Skills in Cloud-Sitzungen
- 2026-10-19: 0.70.3 Pakete aktualisiert (Issue #1); `tsconfig.tsbuildinfo` aus dem Repo entfernt
- 2026-10-17: 0.70.2 🍼-Knopf zurück (Philip bestätigt am 19.10.: bleibt so); 0.70.1 API-Limit zeigt auch Dollar
- 2026-10-15: 0.70.0 API-Kostenlimit; 0.69.0 Betreiber-Zugang nur mit Zustimmung des Server-Owners (Issue #13)
- 2026-10-14: großer Ausbau (0.53–0.68), u. a. Bug-Hunting Runde 2 und 3

## Offen / Nächste Schritte
- **Keine offenen Wünsche in der Liste** – alle Punkte in `FORTSCHRITT.md` → „Offen“ sind abgehakt. Neue Wünsche dort **ans Ende** anhängen.
- Offenes GitHub-Issue **#1** (Abhängigkeiten): `opusscript` bleibt auf 0.0.8, weil `prism-media` 1.3.5 `^0.0.8` verlangt.
- Noch von Philip echt zu testen bzw. zu bestätigen (laut FORTSCHRITT): Julia im echten Sprachkanal (0.60.0), Piper-Dienst auf echtem Server (0.50.0), „App hinzufügen“ (Public Bot im Developer Portal an?), einige ältere „von Philip zu bestätigen“-Punkte (Musik-Quellen, Security-Audit-Standards, Selbstheilung ohne Code-Umschreiben).
- **Lizenz** ist noch nicht gewählt (keine LICENSE-Datei im Repo).
- Unklar: Punkt „In Arbeit“ vom 08.10. (Bot-Token ungültig, /ping) wirkt veraltet – bei Philip nachfragen, ob erledigt.
- Ideen-Sammlung (nicht bauen ohne Auftrag): `IDEEN.md`, u. a. wackeliger Klick-Test „Geschützte Rollen“ (14.10.).

## Wichtige Infos
- Stack: Node 24, TypeScript, pnpm-Monorepo (`apps/bot`, `apps/dashboard` mit Next.js 16, `packages/db` Prisma 7 + PostgreSQL 17, `packages/shared`), Redis 8, discord.js 14, Docker Compose.
- Befehle: `pnpm build` · `pnpm test` · `node scripts/smoke-test.mjs` · Screenshots `node scripts/screenshots.mjs --phase NN-name`.
- **Dashboard-Port: 3000** (Standard, `DASHBOARD_PORT` in `.env`). Der Bot selbst braucht keinen offenen Port.
- Installation: Einzeiler `proxmox/install.sh` (siehe `QUICKSTART.md`); Update im Container mit `update` bzw. `moin-julia update` (Backup, Rollback, Healthcheck) oder per Knopf unter System → Update.
- Jede neue Version braucht einen Eintrag in `packages/shared/src/changelog.ts` (Test erzwingt das).
- Ausführlicher Verlauf: `FORTSCHRITT.md`, Bauprotokoll in `docs/bauprotokoll/`, Sicherheitsbericht `SECURITY_AUDIT.md`.
- Baustatus-Seite (nach jedem Modul aktualisieren): https://claude.ai/artifact/9CwBGeiXrFUsKAXVEneC2n

## Philips Vorgaben
- Update-Funktion: **ja**. Repo: **öffentlich** (keine Secrets committen, `.env` ist ignoriert).
- Git-Texte: Jede Commit-Message, jeder PR-/Issue-Text endet mit Leerzeile + `Verfasst mit Claude 🤖`; README hat den Hinweis als Fußzeile.
- Bot-Texte, Doku und Commits auf Deutsch.
- Arbeitsweise: ein Modul pro Durchgang, danach Commit + Push; nicht auf „weiter“ warten. Neue Wünsche ans Ende der Liste; „dringend“ und Fehlermeldungen von Philips Installation sofort vorziehen.
- Ideen nicht sofort bauen, sondern in `IDEEN.md` notieren.
- Claude-Abo kann den Bot nicht betreiben (nur API-Schlüssel oder Ollama) – so in Modul 10 umgesetzt.

---
Diese Datei wird beim Arbeiten aktuell gehalten: nach jedem größeren Schritt „Aktueller Stand“ und „Offen“ anpassen.
