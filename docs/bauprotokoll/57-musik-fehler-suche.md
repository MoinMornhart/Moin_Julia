# 57 – Musik: Radio/Playlist-Fehler, Chat-Spam, Kanäle, Lock, bessere Suche (Issue #9)

**Datum:** 13.10.2026 · **Version:** 0.47.0 · **Status:** behoben und getestet

Meldung von JONIMONI09 (Issue #9):
- Radio geht nicht; „wenn kein Effekt an ist, wird es immer gelöscht“.
- Playlist lädt nicht.
- Lock geht nicht.
- Warteschlange im Dashboard nicht bearbeitbar.
- Chat wird vollgespammt.
- Man soll einstellen können, in welchem Kanal Musik geht.

Dazu Philips Wunsch: die Musik-Suche verbessern.

## Hauptursache: Player gab nach 100 ms auf
- Der Discord-Player von `@discordjs/voice` stoppt standardmäßig, wenn **5 Ton-Pakete (= 100 ms)** fehlen (`maxMissedFrames: 5`). Der Titel gilt dann als zu Ende, und der Bot springt weiter und entfernt ihn.
- Beim normalen Start spielte der Bot sofort ab, **ohne auf den ersten Ton zu warten**. Ein Radio braucht aber oft eine Sekunde zum Anlaufen, auf einem kleinen Server erst recht.
- Folge:
  - Jeder Titel „endete“ sofort und wurde gelöscht.
  - Playlists liefen nicht.
  - Pro Titel kam eine Fehlermeldung, das war der Spam.
- **Mit Effekt** klappte es, weil der Effekt-Wechsel nahtlos startet und dabei bis zu 15 s auf den ersten Ton wartet. Genau das hat JONIMONI beobachtet.
- In den Tests fiel es nicht auf, weil das nachgebaute ffmpeg sofort Ton lieferte.

**Lösung:**
- Jeder Start wartet auf den ersten Ton (bis 15 s).
- Der Player überbrückt Aussetzer bis **5 s** mit Stille (`MAX_MISSED_FRAMES = 250`), statt aufzugeben.

## Weitere Korrekturen
- **Kein Spam mehr:** Scheitern mehrere Titel innerhalb einer Minute, wird **eine** Meldung hochgezählt („⚠️ 3 Titel ließen sich nicht abspielen …“) statt jedes Mal eine neue zu schreiben.
- **Kanäle festlegen** (Musik → Einstellungen):
  - „Befehle und Bedienfeld nur in diesen Text-Kanälen“.
  - „Musik nur in diesen Sprachkanälen“.
  - Leer = überall. Woanders gibt es einen kurzen, nur selbst sichtbaren Hinweis.
- **Warteschlange im Dashboard:**
  - **↑** (einen Platz nach oben), **⤒** (als Nächstes), **✕** (entfernen).
  - **„Warteschlange leeren“**.
- **Lock (eigene Sprachkanäle):**
  - Gesperrt wurde nur @everyone. Gab eine Rolle wie „Mitglied“ das Recht „Verbinden“ (oft von der Kategorie geerbt), kam trotzdem jeder rein.
  - Jetzt werden solche Rollen-Freigaben im Kanal neutral gestellt, und der Besitzer behält ausdrücklich Zugang.
  - Gleiches für „Verstecken“.

## Bessere Suche
- **YouTube:** statt stur des ersten Treffers werden **5 Treffer bewertet**:
  - Plus: passende Wörter, normale Liedlänge, „Official“, offizielle Kanäle.
  - Minus: „Live“, „Reaction“, „1 Hour“, „Nightcore“, „Cover“ usw. – außer man hat danach gesucht.
- **Radio:** findet der Name nichts, wird nach **Genre/Stichwort** gesucht („rock“, „schlager“).
- **`radio …`** am Anfang (z. B. „radio 1live“) sucht gezielt nur Sender.
- Die Vorschläge beim Tippen nutzen dieselbe Bewertung.

## Hinweis „file:///“ aus Issue #9
Im Code kommt kein `file://` vor. Die Browser-Meldung stammt vermutlich aus einem Eintrag auf dem Server, etwa einem Favoriten oder Cover mit lokaler Adresse. Kein Sicherheitsproblem, der Browser blockt es.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Radio läuft langsam an → wartet auf den ersten Ton, Titel bleibt (mit altem Code rot) | ✓ neu |
| Player überbrückt 5 s | ✓ neu |
| Suche: echtes Lied vor Live/1-Hour/Reaction; „live“ gesucht → live; „radio …“ | ✓ neu |
| Radio: Genre-Suche als Ersatz, ohne Doppelte | ✓ neu |
| Warteschlange: verschieben, leeren | ✓ neu |
| Lock: Rollen-Freigaben werden neutral, Personen/@everyone bleiben | ✓ neu |
| Klick-Test: erlaubte Text-/Sprachkanäle speichern | ✓ neu |
| Klick-Test 221/221, Bot 281+ | ✓ |
