# Fortschritt – Moin_Julia

Stand: 08.10.2026 · Diese Datei erlaubt es jedem neuen Chat, nahtlos weiterzumachen.

## Entscheidungen
- Update-Funktion: **ja** (`moin-julia update` mit Backup, Rollback, Healthcheck)
- Git: **öffentlich**, GitHub-Account `MoinMornhart`, Repo `Moin_Julia` (Remote wird in Phase 2 angelegt)
- KI-Hinweis in Git-Texten: **„Verfasst mit Claude 🤖“**
- Proxmox: **LXC als Standard, VM wählbar**
- Stack-Vorschlag: siehe [docs/bauprotokoll/01-recherche.md](docs/bauprotokoll/01-recherche.md#6-tech-stack-empfehlung) (noch nicht bestätigt)

## Erledigt
- [x] Phase 1: Recherche + Funktionsliste ([01-recherche.md](docs/bauprotokoll/01-recherche.md))

## In Arbeit
- [ ] Phase 1: Bestätigung der Funktionsliste durch Philip ⏸️

## Offen
- [ ] Phase 2: Grundgerüst (Monorepo, Docker Compose, DB, Bot online, Dashboard-Login, Modul-System, Installer, Update, /ping)
- [ ] Phase 3 Module: 1 Logging · 2 Moderation · 3 Server-Schutz · 4 Willkommen & Rollen · 5 Tickets · 6 Team-System · 7 Live-Alerts · 8 Level & XP · 9 Community · 10 Julia-KI Basis · 11 Julia Persona & User-Profile · 12 Statistiken · 13 Feinschliff & Design
