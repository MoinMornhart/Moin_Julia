# 69 – Wartungsmodus mit Test-Servern (Wunsch Philip)

**Datum:** 14.10.2026 · **Version:** 0.57.0 · **Status:** fertig und getestet

Wunsch: „Beim Wartungsmodus einstellen, dass der Bot auf einigen Servern geht, die ich auswähle – zum Testen.“

## Jetzt
- **System → 🛠️ Wartungsmodus** hat eine Liste **„Test-Server“** mit allen Servern, auf denen der Bot ist. Man kann bis zu 25 ankreuzen.
- Auf Test-Servern laufen in der Wartung **Befehle, Knöpfe, Menüs, Ereignisse, Julia und Musik ganz normal** weiter. Laufende Musik wird beim Start der Wartung dort nicht beendet.
- Überall sonst gilt die Wartung wie bisher: „Wartung“-Antwort, Julia und Musik pausieren, Schutzfunktionen laufen.
- Bei laufender Wartung lassen sich die Test-Server ändern, mit „Hinweis/Test-Server übernehmen“.

## Grenzen (bewusst)
- **Online-Status:** Discord zeigt ihn für alle Server gleich an. In der Wartung erscheint der Bot also überall offline, auch auf Test-Servern, funktioniert dort aber.
- **Regelmäßige Runden** (Social-Media-Meldungen, Statistik-Auswertung, Probezeit-Erinnerungen, Ticket-Auto-Schließen) laufen über alle Server zugleich und ruhen deshalb auch auf Test-Servern.
- **Dashboard:** Während der Wartung sieht es weiterhin nur der Instanz-Admin.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Test-Server laufen normal, andere pausieren; alte Einstellungen ohne Test-Server bleiben gültig (Unit) | ✓ neu |
| Klick-Test: Test-Server ankreuzen → Wartung starten → Meldung „Auf 1 Test-Server läuft er normal weiter“ | ✓ neu |
| Klick-Test 252/252, Seiten-Durchlauf 43 × 2, Unit shared 184, Bot 303 | ✓ |
