# Fortschritt – Moin_Julia

Stand: 08.10.2026 · Version 0.3.0 · Diese Datei erlaubt es jedem neuen Chat, nahtlos weiterzumachen.

## Entscheidungen
- Update-Funktion: **ja** (`moin-julia update` / `update` mit Backup, Rollback, Healthcheck)
- Git: **öffentlich**, https://github.com/MoinMornhart/Moin_Julia
- KI-Hinweis in Git-Texten: **„Verfasst mit Claude 🤖“**
- Proxmox: **LXC als Standard, VM wählbar**
- Stack: Node 24, TypeScript 6, discord.js 14.27, Next.js 16, Tailwind 4, Prisma 7 + PostgreSQL 17, Redis 8, pnpm 10 (Monorepo)
- Funktionsliste Muss/Soll/Später: bestätigt am 08.10.2026 ([01-recherche.md](docs/bauprotokoll/01-recherche.md#7-funktionsliste--muss--soll--später))

## Arbeitsweise (ab 08.10.2026)
- Module **am Stück** durcharbeiten, selbst testen, pro Modul Commit + Push + Bauprotokoll + Baustatus-Seite aktualisieren – **nicht** auf „weiter“ warten (Wunsch von Philip). Gemeinsamer Test am Ende.
- Baustatus-Seite: https://claude.ai/artifact/9CwBGeiXrFUsKAXVEneC2n

## Entwicklungsumgebung (Hinweise für neue Chats)
- Quellcode liegt im iCloud-Ordner; **node_modules/Builds nie dort**, sondern in einer Arbeitskopie außerhalb von iCloud (robocopy-Spiegel ohne node_modules/.next/dist).
- Auf dem Windows-PC gibt es **kein Docker** (Virtualisierung im BIOS aus). Lokal getestet wird mit portablem PostgreSQL (`@embedded-postgres/windows-x64`) und Redis (redis-windows) im Scratchpad.
- Tests pro Modul: `pnpm build` · `pnpm test` (vitest) · `node scripts/smoke-test.mjs` (Dashboard im Demo-Modus) · `bash scripts/tests/update-sim.sh` · ShellCheck · Screenshots mit `node scripts/screenshots.mjs --phase NN-name`.
- Echte Tests auf Proxmox macht Philip und meldet Fehler zurück.

## Erledigt
- [x] Phase 1: Recherche + Funktionsliste ([01-recherche.md](docs/bauprotokoll/01-recherche.md))
- [x] Phase 2: Grundgerüst gebaut und lokal getestet ([02-grundgeruest.md](docs/bauprotokoll/02-grundgeruest.md))
- [x] Modul 1: Logging ([03-logging.md](docs/bauprotokoll/03-logging.md))

## In Arbeit
- [ ] Modul 2: Moderation
- [ ] Phase 2: Test auf Proxmox durch Philip (läuft parallel; DNS-Problem auf dem Host → Einzeiler mit DNS-Fix)

## Offen
- [ ] Phase 3 Module: 3 Server-Schutz · 4 Willkommen & Rollen (inkl. Embed-Builder) · 5 Tickets · 6 Team-System · 7 Live-Alerts · 8 Level & XP · 9 Community · 10 Julia-KI Basis · 11 Julia Persona & User-Profile · 12 Statistiken · 13 Feinschliff & Design
