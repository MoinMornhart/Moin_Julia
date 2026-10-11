# 39 – Musik generalüberholt + Spotify-/Apple-Playlists

**Datum:** 11.10.2026 · **Version:** 0.34.0 · **Status:** fertig und getestet

Philips Wünsche:
- „Musik noch generalüberholen.“
- „Für den Musikbot Spotify, YouTube oder sonst was für Links einfügen, und es erkennt das Lied.“
  - Einzelne Titel gingen schon seit 0.24.0; offen waren Playlists und Alben.

## Neu
- **Spotify-Playlists, -Alben und -Künstler** sowie **Apple-Music-Playlists und -Alben** per Link: Alle Titel kommen in die Warteschlange.
  - Die Meldung lautet z. B. „➕ 50 Titel aus ‚Today's Top Hits‘ angestellt.“
  - **Ohne API-Schlüssel:** Spotify liefert die Titelliste auf seiner Einbettungsseite, Apple Music in den Seitendaten. Live geprüft: Spotify-Playlist 50, Spotify-Album 17, Apple-Album 18, Apple-Playlist 50 Titel.
  - **Gespielt wird der passende YouTube-Treffer** (wie Euphony). Gesucht wird erst kurz vor dem Abspielen; so blockiert eine große Playlist den Bot nicht.
  - **Der nächste Titel wird schon im Voraus gesucht**, damit beim Wechsel keine Lücke entsteht.
  - Zusätze wie „- Remastered 2009“ werden für die Suche entfernt (bessere Treffer).
  - Ein Link auf ein **einzelnes** Lied (Spotify-Track, Apple `?i=…`) spielt weiterhin nur dieses Lied.
  - Gespeicherte Playlists und „Wiederherstellen“ behalten noch nicht gesuchte Titel.
- **Wiederaufsetzen bei Abbruch:** Bricht ein Lied mittendrin ab (Netz, YouTube), setzt die Musik an derselben Stelle wieder ein, statt zum nächsten Titel zu springen (höchstens 2-mal pro Titel).
- **🎚️ Lautstärkeausgleich** (Standard: an): Leise und laute Lieder klingen gleich laut. Abschaltbar unter Musik → Einstellungen, wechselt nahtlos.

## Behoben
- **Speichern blockiert:** Wurde „YouTube & Co.“ ausgeschaltet, während ein YouTube-Favorit gespeichert war, ließ sich keine Musik-Einstellung mehr speichern. Jetzt werden nur neu hinzugefügte YouTube-/Spotify-Favoriten abgelehnt.

## Technik
- Neue Datei `musik/streaming.ts`: Link-Erkennung, Auslesen der Seiten, Suchbegriff. Nur feste Hosts (open.spotify.com, spotify.link, music.apple.com), Weiterleitungen auf fremde Hosts werden verworfen.
- Track hat jetzt `query` (Suchbegriff) und `from` (Name der Playlist/des Albums).

## Wie getestet
| Test | Ergebnis |
|---|---|
| Sammlung vs. Einzeltitel, Spotify-Einbettungsadresse | ✓ neu |
| Spotify-Titelliste, nicht abspielbare übersprungen | ✓ neu |
| Apple: Künstler je Titel aus Seitendaten, sonst JSON-LD; ISO-Dauer | ✓ neu |
| Fremder Host nach Weiterleitung abgelehnt | ✓ neu |
| Suchbegriff ohne „Remastered“-Zusatz | ✓ neu |
| Abbruch mitten im Lied → Wiederaufsetzen an der Stelle; Grenzen (Anfang/Ende/Radio/2 Versuche) | ✓ neu |
| Lautstärkeausgleich als Filter, abschaltbar | ✓ neu |
| YouTube-Suche nur bei Bedarf, gleichzeitige Aufrufe suchen nur einmal | ✓ neu |
| Live gegen echte Spotify-/Apple-Seiten | ✓ |
| Klick-Test 186/186 (Lautstärkeausgleich an/aus), Seiten-Durchlauf, Bot 231, Shared 121, DB 6 | ✓ |

**Von Philip zu testen:** nach `update` mit eingeschaltetem „YouTube & Co.“ `/musik play` mit einem Spotify-Playlist-Link.
