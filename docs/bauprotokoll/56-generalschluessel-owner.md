# 56 – Generalschlüssel auch für den Owner-Bereich

**Datum:** 13.10.2026 · **Version:** 0.46.3 · **Status:** fertig und getestet

Wunsch von Philip: „Gib mir jeden Bereich zur Verfügung als Owner von dem Bot, dass ich alles einstellen kann.“

## Vorher (0.37.0)
Mit `/moin zugang an` hatte der Instanz-Admin auf jedem Server Admin-Zugriff, aber **nicht** auf den Owner-Bereich. Wo er schon Admin war, änderte der Schlüssel nichts.

## Jetzt
- Mit eingeschaltetem Generalschlüssel bekommt der Instanz-Admin auf **jedem** Server mit dem Bot **Owner-Rechte** im Dashboard, **inklusive Owner-Bereich**. Das gilt auch dort, wo er sonst nur Admin oder Mod wäre.
- Transparenz bleibt: Der Server sieht im Log-Kanal, dass der Generalschlüssel genutzt wurde. Im Menü steht „🔑 Generalschlüssel“.
- Ausschalten mit `/moin zugang aus`. Dann gelten wieder die normalen Discord-Rechte.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Ohne Schlüssel: fremder Server gesperrt | ✓ |
| Mit Schlüssel: fremder Server offen, „🔑 Generalschlüssel“ angezeigt, **Owner-Bereich offen** | ✓ geändert |
| Admin-Übernahme-Test bestanden | ✓ |
