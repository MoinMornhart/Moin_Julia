# 31 – Bug-Hunting

**Datum:** 10.10.2026 · **Version:** 0.28.0 · **Status:** behoben und getestet

Wunsch von Philip: das ganze Repo gründlich auf Logik- und Laufzeitfehler prüfen und sie beheben.

## Vorgehen
- Zwei getrennte Prüfungen, eine für den Bot und eine für das Dashboard plus die Shared-Pakete.
- Jeder Fund wurde im Code nachvollzogen, bevor er behoben wurde.
- Wo es ging, gibt es einen Test, der den Fehler vorher gezeigt hätte.

## Bot – behoben
| Fund | Was passierte | Lösung |
|---|---|---|
| Abgebrochene Downloads | Ein Fehler im laufenden Datenstrom konnte den ganzen Bot beenden | Fehler werden abgefangen; ein wirklich unerwarteter Fehler führt zu einem sauberen Neustart statt zu einem halben Zustand |
| Musik: Beitritt scheitert | Die Sprachverbindung blieb „halb offen“, danach ging nichts mehr | Bei einer Zeitüberschreitung wird die Verbindung aufgeräumt, der Nutzer bekommt „kann nicht beitreten“ |
| Musik: langsame Knöpfe | Lautstärke, Effekte, Spulen und „Zurück“ brauchten manchmal länger als Discords 3 Sekunden („Interaktion fehlgeschlagen“) | Erst bestätigen, dann ausführen |
| Temp-Voice umbenennen | Gleiches 3-Sekunden-Problem | Erst bestätigen |
| Zähl-Kanal | Zwei schnelle Zahlen (5 und 6) gleichzeitig → eine wurde fälschlich als falsch gewertet | Nachrichten pro Server nacheinander prüfen |
| Vorschläge: Abstimmen | Zwei gleichzeitige Stimmen → eine ging verloren | Stimme direkt in der Datenbank ändern (in einem Schritt) |
| Tickets | Doppelklick auf „Schließen“ bzw. „Öffnen“ → doppeltes Protokoll bzw. zwei Tickets | Ticket wird beim Schließen erst „reserviert“; Öffnen ist pro Person gesperrt, solange es läuft |
| Level | Zwei gleichzeitige Nachrichten → doppelte Level-up-Meldung | Level nur hochsetzen, wenn es noch das alte ist |
| Statistik | Überlappende Speicher-Runden, ein Fehler stoppte alle weiteren | Nur eine Runde gleichzeitig, Fehler pro Eintrag |
| YouTube-Alerts | Bei einem Fehler wurden schon gemeldete Videos erneut gemeldet | „Schon gesehen“ wird auch im Fehlerfall gespeichert; Feed-Daten werden nicht mehr überschrieben |
| `/giveaway start` | Konnte die 3-Sekunden-Grenze reißen | Erst bestätigen |
| `/ticket` | Team-Rollen eines Ticket-Grundes zählten nur bei den Knöpfen, nicht beim Befehl | Zählen jetzt überall |
| Julia: lange Antworten | `/julia frage` brach über 2000 Zeichen ab | Antwort wird in mehrere Nachrichten geteilt |
| Julia: Begrenzung | Gleichzeitige Nachrichten konnten das Limit pro Stunde überholen | Platz wird sofort reserviert |

## Dashboard – behoben
| Fund | Was passierte | Lösung |
|---|---|---|
| Vorlagen-Import | Fehlte im Ziel-Server **ein** Kanal oder **eine** Rolle, wurde die **ganze** Modul-Einstellung still auf Standard gesetzt | Nur der betroffene Eintrag fällt weg; die Meldung sagt, wie viele Einträge weggelassen wurden und welche Module unverändert blieben |
| Willkommens-, Rollen- und Ticket-Panels | Eine ungültige Nachricht wurde still durch den Standardtext ersetzt | Genaue Fehlermeldung, nichts wird überschrieben |
| Panel/Stelle in anderem Tab gelöscht | Speichern stürzte ab | Meldung „gibt es nicht mehr – Seite neu laden“ |
| Statistik-Kanäle | Ein neuer Kanal fehlte in der Liste; ungespeicherte Änderungen gingen verloren. Das Feld „Tage behalten“ sprang beim Tippen | Neuer Kanal erscheint sofort; das Feld wird erst beim Verlassen begrenzt |
| Level-Einstellungen | Text und Kanal der Level-up-Meldung wurden gelöscht, wenn der Modus kurz auf „aus“ stand | Ausgeblendete Felder behalten ihren Wert |
| „Verbindung entfernen“ | Stand derselbe Wert auch in der `.env`, war er nach dem Entfernen sofort wieder da | Ein Aus-Merker schaltet auch die `.env` ab (gilt für Claude, Ollama, Twitch, Kick, YouTube-Musik) |
| Julia-Profile | „Löschen“ traf per Position – hatte Julia inzwischen etwas Neues gemerkt, war es der falsche Eintrag | Eintrag wird über Zeitpunkt und Text erkannt |
| Verbindungs-Karten | Eine alte Meldung blieb über einer neuen stehen; der Schlüssel blieb im Feld | Nur die neueste Meldung; Feld wird nach dem Speichern geleert |
| Persona | Feld leeren behielt die alte Persona | Leeres Feld = Standard-Julia |
| Liedtexte | Texte mit Windows-Zeilenenden wurden gar nicht angezeigt | Beide Zeilenenden werden erkannt |
| Versionsdatum | Konnte je nach Zeitzone einen Tag daneben liegen | Immer deutsche Zeit |
| Handy | Lange Wörter in Julia-Antworten und im Gedächtnis sprengten die Breite; das geschlossene Menü war per Tab erreichbar | Umbruch; geschlossenes Menü ist inaktiv |

## Bewusst offen (klein, notiert)
- Nach einem Neustart können geschlossene Ticket-Kanäle liegen bleiben, die im Moment des Neustarts gerade gelöscht werden sollten.
- Starboard zählt bei über 100 Sternen nur die ersten 100.
- Kick-Streams ohne Stream-ID: Wiedererkennung könnte doppelt melden.
- Schutz-Modul: interne Merklisten werden nur stündlich aufgeräumt.

## Wie getestet
| Test | Ergebnis |
|---|---|
| Vorlagen-Import: fehlende Rolle/Kanal entfernt nur den Eintrag, eigener Text bleibt | ✓ neu |
| Zähl-Kanal: 5 und 6 gleichzeitig → beide richtig | ✓ neu |
| Tickets: doppelt schließen / doppelt öffnen | ✓ neu |
| Liedtexte mit Windows-Zeilenenden | ✓ neu |
| `.env`-Wert nach „Entfernen“ aus | ✓ neu |
| Lange Julia-Antwort wird geteilt | ✓ neu |
| Bot 206, Shared 109, DB 6 Tests | ✓ |
| Klick-Test 172/172 (Level-Test an neues Verhalten angepasst) | ✓ |
| Seiten-Durchlauf 42 Seiten × Desktop/Handy, axe | ✓ |
