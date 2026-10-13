# 65 – Julia legt Rollen an (Wunsch Philip)

**Datum:** 14.10.2026 · **Version:** 0.54.0 · **Status:** fertig und getestet (Unit-Tests; mit echtem Discord noch nicht)

Wunsch: „Julia soll auch Owner-Rollen erstellen können.“

## Jetzt
- Neues Julia-Werkzeug **„Rolle anlegen“**. Es ist im Dashboard unter Julia → Werkzeuge an- und abschaltbar, wie die anderen Werkzeuge auch.
- Beispiel: „@Julia mach eine Rolle Team mit Mod-Rechten in Türkis“.
  - Julia schlägt vor: 🎭 Rolle anlegen: **Team** – Moderations-Rechte · Farbe #2fd1b8.
  - Die Person, die gefragt hat, bestätigt per Knopf.
- **Rechte-Pakete:**

  | Paket | Rechte | Wird getrennt angezeigt |
  |---|---|---|
  | ohne Rechte | keine | nein |
  | Moderations-Rechte | wie die Team-Rolle der Server-Profile | ja |
  | ⚠️ Administrator | alle Rechte (für Owner- und Admin-Rollen) | ja |

- **Wer darf:**
  - Normale Rollen und Mod-Rollen: alle mit dem Discord-Recht „Rollen verwalten“.
  - Administrator-Rollen: **nur der Server-Owner oder der Instanz-Admin (Philip)**.
  - Andere fragen Julia gar nicht erst nach Administrator-Rollen. Sie sagt dann freundlich, dass nur der Owner das darf.
  - Beim Knopfdruck wird alles noch einmal geprüft.
- Der Instanz-Admin darf das Werkzeug auch auf Servern nutzen, auf denen er kein Rollen-Recht hat (wie beim Generalschlüssel).
- Discord-Regel: Eine neue Rolle kann nur Rechte bekommen, die der Bot selbst hat. Fehlen sie, meldet Julia „dem Bot fehlt das Recht“.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Markierung lesen (Name, Rechte-Paket, Farbe), Administrator nur mit Erlaubnis vorschlagen | ✓ neu |
| Bot: Mod-Rolle wird angelegt; Administrator durch Nicht-Owner abgelehnt; Instanz-Admin darf auch ohne Recht | ✓ neu |
| Unit shared 177, Bot 298, Klick-Test 242/242, Seiten-Durchlauf 43 × 2 | ✓ |
