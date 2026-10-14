# 76 – Bewerbungsfragen aus Text (Wunsch Philip)

**Datum:** 14.10.2026 · **Version:** 0.63.0 · **Status:** fertig und getestet

Wunsch: „Beim Bewerben einen Text reinschicken, und er filtert sofort die Fragen raus und trägt sie zum Ausfüllen ein – auch automatisch festlegen, ob es ein Ankreuz- oder sonstiges Feld ist.“

## Jetzt
- **Team → Stellen → Stelle bearbeiten → „📋 Fragen aus Text übernehmen“**: beliebigen Text einfügen (alte Vorlage, Google-Formular, Discord-Post) und auf **„Fragen erkennen“** klicken.
- **Erkannt** werden Zeilen, die auf „?“ oder „:“ enden oder nummeriert sind („1.“, „Frage 2“).
- **Feldart automatisch:**

  | Erkannt an | Feld |
  |---|---|
  | Optionen darunter („- Discord“, „☐ abends“, „a) …“) oder in Klammern („(morgens / abends)“) | **Auswahl / Ankreuzen** mit diesen Optionen |
  | „Hast du/Bist du/Kannst du …?“ oder „(Ja/Nein)“ | **Ja/Nein** (Auswahl ✅ Ja / ❌ Nein) |
  | „Warum/Beschreibe/Erfahrung/Stärken …“ | **langer Text** |
  | „Wie alt/Wie viele/Stunden …“ | **Zahl** (kurzes Feld, Platzhalter „Zahl“) |
  | „Datum/Geburtstag/Ab wann …“ | **Datum** (Platzhalter „TT.MM.JJJJ“) |
  | „Screenshot/Bild/Datei/Lebenslauf …“ | **Datei-Upload** |
  | alles andere | **kurzer Text** |

- **Vorschau:** Jede erkannte Frage mit Feldart und Optionen, einzeln an- und abwählbar. Danach **„Anhängen“** oder **„Bisherige Fragen ersetzen“**. Vor dem Speichern lässt sich alles wie gewohnt anpassen.
- Lange Fragen: Die Beschriftung ist auf 45 Zeichen begrenzt (Formular-Grenze). Die ganze Frage steht dann im Platzhalter.
- **Ohne KI und ohne Schlüssel:** Die Erkennung läuft sofort im Browser.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Beispiel-Bewerbung mit 9 Fragen: Feldarten, Optionen untereinander und in Klammern, Ja/Nein, gültige Formularfelder, eindeutige IDs | ✓ neu |
| Klick-Test: Text einfügen → „Auswahl / Ankreuzen“ + „Ja/Nein“ + Optionen erkannt → anhängen → Stelle speichern → Bewerbung abschicken | ✓ neu |
| Klick-Test 261/261, Seiten-Durchlauf 43 × 2, Unit shared 199, Bot 311 | ✓ |
