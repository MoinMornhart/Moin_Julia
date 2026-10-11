# 52 – Server-Profile: ganzen Server per Klick einrichten (Issue #5)

**Datum:** 11.10.2026 · **Version:** 0.45.0 · **Status:** fertig und getestet

Wunsch von JONIMONI09:
- Einen ganzen Discord-Server übers Dashboard anfertigen lassen, als Profil laden und aktivieren, mit Rechten.
- Beim Ausschalten wird automatisch die Sicherung zurückgeholt, also der Zustand von vorher.

## So funktioniert es
Dashboard → **Vorlagen → Server-Profile**.

- Drei fertige Baupläne mit Vorschau (Rollen, Kategorien, Kanäle, welche Module eingestellt werden):
  - **📺 Streamer-Community:** Info-Kanäle (nur lesen), Live-Meldungen, Community, Julia-Chat, eigene Sprachkanäle, Team-Bereich.
  - **🎮 Gaming-Clan:** Regeln, Termine, Zock-Kanäle, Leitungs-Bereich.
  - **🍻 Freundeskreis:** Treffpunkt, Julia, Sprachkanäle, kleiner Orga-Bereich.
- **Anwenden** (mit Bestätigung):
  1. **Automatische Sicherung** (erscheint unter „Sicherungen“).
  2. Fehlende Rollen und Kanäle werden angelegt. **Gleichnamige vorhandene werden mitbenutzt, nie verändert oder gelöscht.**
  3. Rechte werden gesetzt:
     - „🔒 nur Team“: unsichtbar für alle außer der Team-Rolle und dem Bot.
     - „📖 nur lesen“: alle lesen, nur das Team schreibt.
     - Die Team-Rolle darf moderieren (kicken, bannen, Timeout, Nachrichten verwalten), bekommt aber **nie** Administrator, „Server verwalten“ oder „Rollen verwalten“.
  4. Module werden passend eingestellt, z. B. Log-Kanäle, Willkommen, Julia-Chat, „➕ Kanal erstellen“. Vorhandene Einstellungen bleiben, nur die Bauplan-Werte kommen dazu.
- Es ist immer **nur ein Profil aktiv**.
- **Deaktivieren:**
  - Die Sicherung kommt zurück. Module, die es vorher nicht gab, gehen auf Standard.
  - Auf Wunsch (Haken, ab Werk an) werden **nur die vom Profil angelegten** Kanäle und Rollen wieder gelöscht.
- Bricht das Anlegen mittendrin ab (z. B. fehlendes Recht), merkt sich das Profil, was schon angelegt war. „Deaktivieren“ räumt es wieder weg.
- Der Bot wartet von selbst, wenn Discord „zu viele Anfragen“ meldet.

## Technik
- Baupläne: `packages/shared/src/config/server-blueprints.ts`.
- Anwenden/Entfernen: `apps/dashboard/src/lib/profiles.ts`.
- Neue Tabelle `ServerProfile` (Migration `20261011150000_server_profiles`).

## Wie getestet
| Test | Ergebnis |
|---|---|
| Baupläne: eindeutige Schlüssel (fand einen echten Fehler: Rolle und Kanal hießen beide „live“), Team-Rolle ohne Admin-Rechte | ✓ neu |
| Modul-Einstellungen aller Baupläne sind gültig; fehlt ein Kanal, wird das Modul ausgelassen | ✓ neu |
| Rechte für „nur Team“ und „nur lesen“, Zusammenführen der Einstellungen | ✓ neu |
| Klick-Test: anwenden → aktiv, kein zweites Profil, Sicherung vorhanden, deaktivieren → alter Stand | ✓ neu |
| Klick-Test 215/215, Seiten-Durchlauf 43 × 2 (neu mit Profil-Seite) | ✓ |
