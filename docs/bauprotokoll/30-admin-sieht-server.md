# 30 – Fehler: Admin sieht den Server nicht

**Datum:** 10.10.2026 · **Version:** 0.27.1 · **Status:** behoben und getestet

Philips Meldung: „Wenn ich Administrator auf einem Server bin, sehe ich den Server nicht.“

## Ursache
Ob jemand Admin ist, hat das Dashboard aus dem **Login-Stand** gelesen. Den liefert Discord beim Anmelden, und er gilt bis zu 7 Tage.
- **Später Admin geworden:** Wer nach dem Login Administrator wurde, war für das Dashboard weiter „nur Mitglied“.
- **Kein Ausweg in der Liste:** Der Server fehlte dann ganz. Unter „Bot einladen“ stand er auch nicht, weil der Bot schon drauf ist.
- **Später beigetreten:** Server, denen man erst nach dem Login beigetreten ist, kannte die Liste gar nicht.

## Lösung
- **Live-Prüfung in beide Richtungen:** Die Admin-Rechte werden jetzt **live über den Bot** geprüft (Rollen der Person plus @everyone, 60 s zwischengespeichert).
  - Rechte entzogen → kein Zugriff mehr (wie bisher).
  - Rechte neu bekommen → sofort Zugriff.
- **Discord nicht erreichbar:** Dann gilt der Login-Stand.
- **Server-Liste:** Sie prüft auch Server, auf denen der Bot ist, die aber nicht im Login-Stand stehen (höchstens 50).
- **Hinweis unter der Liste:** Was tun, wenn trotzdem einer fehlt.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Entscheidung (Shared): später Admin → Admin; Rechte entzogen → nicht; Discord weg → Login-Stand | ✓ neu |
| Ende-zu-Ende mit nachgebauter Discord-API: Login ohne Rechte, danach Admin per Rolle → Server steht in der Liste, Dashboard öffnet sich | ✓ neu |
| Klick-Test 162/162 | ✓ |
