# 46 – Projekt-Webseite auf GitHub Pages (Issue #4)

**Datum:** 11.10.2026 · **Version:** 0.40.1 · **Status:** fertig

Wunsch aus Issue #4: eine Webseite für das Projekt über GitHub Pages.

**Adresse:** https://moinmornhart.github.io/Moin_Julia/

## Aufbau
- `site/index.html` ist eine einzelne statische Seite ohne Fremd-Skripte. Sie zeigt Kurzvorstellung, die 15 Module, Julia, Screenshots und den Installations-Befehl. Sie hat Hell- und Dunkelmodus und funktioniert auf dem Handy.
- Der Workflow `.github/workflows/pages.yml` stellt die Seite zusammen:
  - kopiert Logo, Banner und vier Screenshots aus `docs/`,
  - trägt die aktuelle Version aus `VERSION` ein,
  - veröffentlicht über GitHub Pages.
- Der Workflow läuft nur, wenn sich `site/`, die Grafiken, die Version oder der Workflow selbst ändern.
- Pages ist im Repo auf „GitHub Actions“ gestellt.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Seite lokal genauso zusammengestellt wie im Workflow, alle Bilder laden | ✓ |
| 390 px (Handy) und 1280 px: keine waagerechte Scrollleiste | ✓ |
| Workflow-Lauf auf GitHub | siehe Actions-Tab |
