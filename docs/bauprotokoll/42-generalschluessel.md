# 42 – Generalschlüssel für den Instanz-Admin

**Datum:** 11.10.2026 · **Version:** 0.37.0 · **Status:** fertig und getestet

Philips Wunsch: „Bau einen Command ein, den nur ich eingeben kann, und dann habe ich immer Zugriff auf das Dashboard und kann alles einsehen.“

## Umgesetzt
- **`/moin zugang`** gibt es auf jedem Server, unabhängig von den Modul-Schaltern. Nur Philip (Instanz-Admin) kann ihn nutzen; alle anderen bekommen „Das darf nur der Instanz-Admin“.
  - **an:** Generalschlüssel ist an. Philip hat auf **jedem Server mit dem Bot** Admin-Zugriff im Dashboard, auch ohne Discord-Rechte dort. Dazu kommt der direkte Link zum Dashboard dieses Servers.
  - **aus:** Es gelten wieder nur die Discord-Rechte.
  - **link:** zeigt den Link und, ob der Schlüssel an ist.
- **Server-Auswahl:** Mit Schlüssel stehen dort alle Server mit dem Bot.
- **Kennzeichnung:** Im Server-Menü steht dann „🔑 Generalschlüssel“ statt „Admin“.

## Entscheidungen (von Philip zu bestätigen)
- **Owner-Bereich bleibt beim jeweiligen Server-Owner**, auch mit Generalschlüssel.
- **Transparenz:** Öffnet Philip das Dashboard eines Servers, auf dem er sonst keine Rechte hat, schreibt der Bot einmal pro Tag in den Log-Kanal dieses Servers: „🔑 Der Instanz-Admin hat das Dashboard dieses Servers per Generalschlüssel geöffnet.“ Das schützt auch Philip selbst: Niemand kann ihm heimliches Mitlesen vorwerfen.
- **Standard ist aus.** Der Schlüssel wirkt erst nach `/moin zugang an`.

## Technik
- **Neues Kern-Modul** `kern` (immer aktiv, nicht im Modul-Katalog/Dashboard). Die Registry registriert seine Befehle unabhängig vom Modul-Schalter.
- **Beim Bauen gefunden:** Die Registry bricht beim Start ab, wenn ein Modul nicht im Katalog steht. Kern-Module sind davon ausgenommen, und ein Test prüft, dass der Bot mit allen Modulen startet.
- **Einstellung** `masterAccess` (Instanz).

## Wie getestet
| Test | Ergebnis |
|---|---|
| `/moin zugang`: andere abgelehnt; an speichert + Link; aus entfernt | ✓ neu |
| Bot startet mit Kern-Modul (Registry) | ✓ neu |
| E2E (nachgebautes Discord): ohne Schlüssel fremder Server 404; mit Schlüssel in der Liste und offen mit 🔑; Owner-Bereich bleibt 404 | ✓ neu |
| Bot 238, Klick-Test 189/189, Seiten-Durchlauf 42 × 2, Admin-Übernahme-Test | ✓ |
