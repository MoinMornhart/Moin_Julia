# 72 – Update prüft den Speicher (Meldung Philip 14.10.)

**Datum:** 14.10.2026 · **Version:** 0.59.1 · **Status:** behoben und im Update-Simulator getestet

## Fehler
- Das Update auf 0.58.0 brach bei „Baue Images neu“ ab: `no space left on device`. Die Platte des Containers war voll.
- Der Rollback lief zwar, schrieb aber auch eine Git-Sperrdatei nicht mehr (`index.lock … Out of diskspace`).
- Ursache: Der **Docker-Build-Zwischenspeicher** wächst mit jedem Update und wurde nie aufgeräumt. Aufgeräumt wurden nur ungenutzte Images.

## Lösung (`scripts/moin-julia`)
- **Vor dem Update:** Sind weniger als 4 GB frei (`MIN_FREE_GB`), räumt `update` zuerst den Build-Zwischenspeicher und ungenutzte Images auf. Datenbank-Volume und Backups bleiben unangetastet.
- **Reicht es dann immer noch nicht,** bricht `update` **vor** Backup, Code-Wechsel und Build ab, mit klarer Meldung. Es wird also nichts verändert. Die Meldung nennt `docker system df`, die alten Backups und `pct resize`.
- **Nach jedem erfolgreichen Update:** Build-Zwischenspeicher älter als eine Woche wird gelöscht.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Update-Simulator Szenario 7 „zu wenig Speicher“: bricht mit Meldung ab, räumt vorher auf, kein Build, kein neues Backup, alter Code | ✓ neu |
| Update-Simulator gesamt 31/31, shellcheck ohne Befund | ✓ |
