# 58 – Wartungsmodus, hängender Update-Knopf, schöneres Menü, nur Lieder + Tippfehler

**Datum:** 13.10.2026 · **Version:** 0.48.0 · **Status:** fertig und getestet

Wünsche und eine Fehlermeldung von Philip am 13.10.

## 1. Update-Knopf blieb auf „Update läuft …“ (Fehler)
- **Ursache:** Der Status „läuft“ wird erst ganz am Ende des Updates überschrieben. Wird der Update-Dienst vorher beendet, bleibt „läuft“ für immer stehen und der Knopf gesperrt. Das passiert zum Beispiel, wenn parallel `update` im Terminal läuft oder der Container neu startet.
- **Jetzt** prüft das Dashboard selbst:
  - Läuft schon eine **neuere Version** als die, von der das Update gestartet ist, gilt es als **erfolgreich**.
  - **„Läuft“ seit über 45 Minuten** gilt als hängen geblieben. Der Knopf ist wieder frei, mit Hinweis.
  - **Anfrage nach 5 Minuten noch nicht abgeholt** (Host-Dienst läuft nicht): klarer Hinweis mit Lösung statt endlosem „läuft“.

## 2. Wartungsmodus (System → 🛠️ Wartungsmodus)
- **Webseite:** Alle sehen „Kurz in Wartung“ mit optionalem Hinweistext. Nur der Instanz-Admin sieht das Dashboard weiter, mit gelbem Balken, damit er die Wartung wieder beenden kann.
- **Bot:**
  - erscheint **offline**;
  - Befehle und Knöpfe antworten kurz mit „Wartung“ (nur für die Person sichtbar);
  - Julia antwortet nicht, Musik stoppt;
  - regelmäßige Runden (Social Media, Statistik, Giveaways …) ruhen.
- **Server-Schutz, Moderation und Owner-Bereich laufen sicherheitshalber weiter.**
- Ganz offline nehmen geht bewusst nicht. Sonst käme auch der Instanz-Admin nicht mehr an den Knopf.

## 3. Benutzermenü oben rechts schöner
„⚙️ System“ als abgerundeter Knopf. Avatar und Name stehen zusammen in einer Leiste, Abmelden ist ein dezentes Symbol (mit Erklärung beim Drüberfahren).

## 4. Musik-Suche: nur Lieder, Tippfehler erlaubt
- **Nur Lieder:** gesucht wird über **YouTube Music, Bereich „Songs“**. Kommt dort nichts, nimmt der Bot die normale Suche, filtert aber alles über 15 Minuten raus und bewertet Video-Typisches stark negativ (Vlog, Tutorial, Reaction, Podcast, Gameplay …). Direkte Links spielen weiter genau das Verlinkte.
- **Tippfehler:**
  - Ähnliche Wörter zählen als Treffer, ein vertauschter Buchstabe gilt als *ein* Fehler.
  - Erlaubt sind bis 6 Zeichen 1 Fehler, darüber 2. Ganz kurze Wörter müssen stimmen.
  - **Radio:** Findet der Name nichts und auch kein Genre, sucht der Bot mit einzelnen Wörtern und Wortanfängen und sortiert nach Ähnlichkeit. „antene bayern“ findet „ANTENNE BAYERN“, „1liev“ findet „1LIVE“.
  - Das gilt auch für die Radiosuche im Dashboard.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Update-Status: neuere Version → erfolgreich; über 45 Min. → hängen geblieben; Fertiges bleibt | ✓ neu |
| Klick-Test: hängendes „läuft“ gibt den Knopf frei; über 45 Min. → Hinweis | ✓ neu |
| Bot-Wartung: Module pausiert (Schutz läuft weiter), Runden ruhen, Bot offline | ✓ neu |
| Klick-Test Wartung: Admin sieht Dashboard + Balken, Besucher sieht Wartungsseite mit Text, danach wieder normal | ✓ neu |
| Tippfehler: Levenshtein mit Buchstabendreher, Wortanfänge, Score, Ersatz-Begriffe | ✓ neu |
| Nur Lieder: Überlanges raus, Vlog hinten; Tippfehler zählen; „antene bayern“ | ✓ neu |
| Klick-Test 226/226, Seiten-Durchlauf 43 × 2, Bot 290, Shared 160 | ✓ |
