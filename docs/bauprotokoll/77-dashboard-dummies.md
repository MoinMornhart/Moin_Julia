# 77 – Dashboard „🍼 Für Dummies“ (Wunsch Philip)

**Datum:** 14.10.2026 · **Version:** 0.64.0 · **Status:** fertig und getestet

Wunsch: „Pack die Sprache ‚Für Dummies' aufs Dashboard.“

![Dashboard im Modus „Für Dummies“](img/77-dummies/74-dummies.png)

## Jetzt
- **🍼-Knopf oben rechts** (neben „System“): ein Klick schaltet das Dashboard auf „Für Dummies“, noch ein Klick wieder zurück.
  - Die Einstellung gilt pro Person bzw. Browser und wird ein Jahr lang gemerkt (Cookie).
  - Die Bot-Sprache auf dem Server ändert sich dadurch **nicht**. Die stellt man weiterhin unter Einstellungen → Sprache um.
- **Umgestellt werden:**
  - **Modulnamen** in Menü, Übersicht und Modulseiten:

    | Normal | Für Dummies |
    |---|---|
    | Logging | Tagebuch |
    | Moderation | Schiedsrichter |
    | Server-Schutz | Türsteher |
    | Tickets | Hilfe-Schalter |
    | Teams | Mitmachen im Team |
    | Statistiken | Zahlen & Kurven |
    | Owner-Bereich | Chef-Zimmer |
    | Musik | Musikbox |
    | Level & XP | Punkte sammeln |
    | Social Media | Bescheid sagen |

  - **Beschreibungen**, z. B. „Gelbe Karten, kurz auf die Bank setzen oder vom Platz stellen – wie beim Fußball 🟨🟥“.
  - **Menü-Bereiche:** „Aufpassen & Ordnung“, „Spaß zusammen“, „Werkzeugkiste 🧰“.
- Alles andere (Einstellungsfelder, Meldungen) bleibt vorerst normal. Weitere Texte kommen nach und nach dazu (Idee notiert).

## Wie getestet
| Test | Ergebnis |
|---|---|
| Jedes Modul hat einfachen Namen + Erklärung; aus = normal, an = einfach | ✓ neu |
| Klick-Test: 🍼 an → „Schiedsrichter“ + „Werkzeugkiste“ im Menü → aus → „Moderation“ | ✓ neu |
| Klick-Test 263/263, Seiten-Durchlauf 43 × 2, Unit shared 201 | ✓ |

## Nachtrag 0.64.1 – auch in den Bereichen (Wunsch Philip)
![Moderation im Modus „Für Dummies“](img/77-dummies/75-dummies-bereich.png)

- In allen Bereichen (Einstellungsseiten, Hinweise, Knöpfe, Meldungen) werden Fachwörter ersetzt.

  | Normal | Für Dummies |
  |---|---|
  | Kanal | Raum |
  | Sprachkanal | Sprech-Raum |
  | Log-Kanal | Tagebuch-Raum |
  | Rolle | Namensplakette |
  | Kategorie | Schublade |
  | Verwarnung | Gelbe Karte |
  | Timeout | Auszeit |
  | Admin | Chef |
  | Owner | Besitzer |
  | Einstellungen | Knöpfe & Schalter |
  | Modul | Programm |
  | Panel | Knopf-Brett |
  | Embed | Info-Kästchen |
  | Platzhalter | Lückenfüller |
  | Vorlage | Bastelvorlage |
  | … | … |

  Die Ersatzwörter haben dasselbe grammatische Geschlecht wie das Original, damit „das/die/der“ stimmt.
- Ersetzt werden nur **ganze Wörter**. „Kanalisation“ oder „Rollenspiel“ bleiben, wie sie sind.
- **Eingaben, Auswahllisten und Code bleiben unverändert.** Was du eintippst, wird nicht umgeschrieben.
- Ein Klick auf den 🍼-Knopf lädt die Seite neu, damit beim Ausschalten wirklich alles wieder normal ist.
- Grenze: Namen auf der Seite, die zufällig wie ein Fachwort heißen (z. B. eine Discord-Rolle namens „Admin“ in einer Liste), werden im Dummies-Modus ebenfalls umbenannt angezeigt. Gespeichert bleibt der echte Name.

| Test | Ergebnis |
|---|---|
| Ganze Wörter, zusammengesetzte zuerst, Wortteile bleiben (Unit) | ✓ neu |
| Klick-Test: Moderation zeigt „Gelbe Karte“, nach Ausschalten wieder normal | ✓ neu |
| Klick-Test 264/264, Seiten-Durchlauf 43 × 2, Unit shared 202 | ✓ |
