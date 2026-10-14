# 75 – Server-Übersicht, Einladung per DM, Support-Zugang (Wünsche Philip)

**Datum:** 14.10.2026 · **Version:** 0.62.0 · **Status:** fertig; Klick-Test und Unit-Tests grün. Mit echten Servern (Einladung, DM, Mitlesen) noch nicht ausprobiert.

Wünsche:
- „Ich als Besitzer des Bots will die Server sehen – Kanäle und so – und eine Einladung per DM.“
- „Mitlesen nur, wenn ein Admin per Command zustimmt oder der Owner“
- „Dauer auch für immer.“

## Jetzt
- **System → 🌐 Alle Server mit dem Bot** (nur Instanz-Admin):
  - pro Server: Owner, Mitgliederzahl, alle Kanäle nach Kategorie, Rollen (nur Namen), fehlende Bot-Rechte;
  - **„🎟️ Einladung per DM“**: Der Bot erstellt eine Einladung (1× nutzbar, 1 Stunde) und schickt sie dir per DM. Es gibt keine Anfrage beim Owner (deine Entscheidung). Die Einladung steht im Discord-Audit-Log („Einladung für den Bot-Betreiber“) und im Log-Kanal des Servers. Gehen DMs nicht, zeigt das Dashboard den Link direkt an.
- **Support-Zugang:**
  - Server-Owner oder Administratoren geben ihn mit **`/moin support-zugang dauer:1 Stunde | 24 Stunden | 7 Tage | für immer`** und beenden ihn mit `dauer:aus`.
  - Solange er an ist, siehst du in der Übersicht **„👀 Mitlesen“**: Kanal wählen, die letzten 50 Nachrichten erscheinen. Das geht nur lesend und nur in Kanälen, die der Bot sehen darf.
  - **Transparenz:**
    - Hinweis im Log-Kanal beim An- und Ausschalten;
    - beim Mitlesen „👀 Der Bot-Betreiber liest per Support-Zugang mit (#kanal)“, höchstens alle 10 Minuten.
- **Sprachkanäle:** Der Bot hört **nie** für dich mit, auch nicht mit Zustimmung. Ein Admin kann nicht für alle im Call einwilligen, und heimliches Mithören ist in Deutschland strafbar (§ 201 StGB). Stattdessen trittst du per Einladung selbst sichtbar bei.

## Technik
- Support-Zugang in Redis `moin:support:<server>`, mit Ablauf bzw. ohne bei „für immer“.
- `packages/shared/src/config/support.ts` enthält Typ, Dauern und „aktiv?“.
- `apps/dashboard/src/app/system/server/` enthält Seite und Aktionen. Jede Aktion prüft selbst, ob der Instanz-Admin angemeldet ist.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Support-Zugang: aktiv bis Ablauf / für immer, Text (Unit) | ✓ neu |
| `/moin support-zugang`: nur Owner/Admin, 24 h mit Ablauf, für immer ohne, aus löscht, Hinweis im Log-Kanal | ✓ neu |
| Klick-Test: Übersicht → Details (Kanäle, Rollen, „kein Support-Zugang“) → Einladung per DM | ✓ neu |
| Klick-Test 259/259, Seiten-Durchlauf 43 × 2, Unit shared 196, Bot 311 | ✓ |
