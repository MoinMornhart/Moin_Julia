# 25 – Julia: KI-Modus repariert

**Datum:** 09.10.2026 · **Version:** 0.23.1 · **Status:** behoben und getestet

Philips Meldung: „Der KI-Modus geht noch nicht zu 100 % richtig.“ Als Fehlermeldung von seiner Installation vorgezogen.

## Gefundene Fehler

| # | Fehler | Folge | Fix |
|---|---|---|---|
| 1 | Die Erwähnung des Bots wurde nur als `@Benutzername` entfernt. Discord schreibt im Text aber den **Server-Spitznamen**, z. B. `@Julia` statt `@Moin_Julia`. | `@Julia modus Seebär` wurde nicht als Umschalten erkannt. Die Nachricht ging an die KI, und die tat nur so, als würde sie umschalten. | Spitzname, Anzeigename und Benutzername werden entfernt (`stripBotMention`). |
| 2 | Nach einem Modus-Wechsel las Julia ihre alten Antworten im vorherigen Modus als Verlauf mit. | Sie redete oft im alten Stil weiter. | Nachrichten von vor dem Wechsel kommen nicht mehr in den Verlauf. |
| 3 | „Zurück zu Julia“ löschte nur den Eintrag. | Kein Zeitpunkt für Fix 2; in einem Thread galt dann wieder der Modus des Elternkanals. | Der Wechsel zum Standard wird jetzt auch gespeichert, ebenso „Zurück auf Standard“ im Dashboard und gelöschte Modi. |
| 4 | „Julia, modus Seebär“ (Anrede ohne @) wurde nicht erkannt. | Wieder ging die Nachricht an die KI statt umzuschalten. | Am Anfang darf der Name des Bots stehen, mit Komma, Doppelpunkt oder Ausrufezeichen. |
| 5 | `/julia modus` ohne Namen zeigte in Threads den Modus des Elternkanals nicht. | Falsche Anzeige. | Elternkanal wird mitgeprüft. |
| 6 | Ollama: Wurde eine Antwort mitten im Nachdenken (`<think>` ohne Ende) abgeschnitten, | landete das rohe „Nachdenken“ im Chat. | Wird jetzt bis zum Ende entfernt. |

## Wie getestet
- **Neue Tests (Shared):** Erwähnung mit Spitzname, Anzeigename und Sonderzeichen, Anrede ohne @; `@Julian` bleibt stehen.
- **Neue Tests (Bot):** Wechsel zurück zu Julia im Thread, obwohl der Elternkanal einen Modus hat; Zeitpunkt wird gespeichert; Ollama mit abgeschnittenem Nachdenken.
- **Gesamt:** Bot 189, Shared 90, DB 5, Klick-Test 148/148, alles grün.

**Nicht testbar ohne echten Server:** das Verhalten mit deinem echten Bot-Spitznamen. Bitte nach `update` einmal `@Julia modus <Name>` und danach `@Julia modus Julia` probieren.
