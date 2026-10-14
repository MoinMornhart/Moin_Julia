/* Automatisch erzeugt aus den Bot-Befehlen – nicht von Hand ändern.
 * Neu erzeugen: UPDATE_CATALOG=1 pnpm --filter @moin/bot exec vitest run src/core/command-catalog.test.ts */
import type { CommandCatalogEntry } from './config/command-notes.js';

export const COMMAND_CATALOG: CommandCatalogEntry[] = [
  {
    "name": "ping",
    "module": "allgemein",
    "description": "Prüft, ob der Bot antwortet, und zeigt die Latenz.",
    "permissions": null,
    "options": []
  },
  {
    "name": "erinnerung",
    "module": "community",
    "description": "Lass dich an etwas erinnern",
    "permissions": null,
    "options": [
      {
        "name": "wann",
        "description": "Wann? z. B. 10m, 2h, 1d",
        "required": true
      },
      {
        "name": "text",
        "description": "Woran?",
        "required": true
      }
    ]
  },
  {
    "name": "geburtstag anzeigen",
    "module": "community",
    "description": "Geburtstag von dir oder einem Mitglied anzeigen",
    "permissions": null,
    "options": [
      {
        "name": "mitglied",
        "description": "Mitglied",
        "required": false
      }
    ]
  },
  {
    "name": "geburtstag entfernen",
    "module": "community",
    "description": "Deinen Geburtstag löschen",
    "permissions": null,
    "options": []
  },
  {
    "name": "geburtstag setzen",
    "module": "community",
    "description": "Deinen Geburtstag eintragen",
    "permissions": null,
    "options": [
      {
        "name": "tag",
        "description": "Tag (1–31)",
        "required": true
      },
      {
        "name": "monat",
        "description": "Monat (1–12)",
        "required": true
      },
      {
        "name": "jahr",
        "description": "Jahr (optional – dann wird das Alter genannt)",
        "required": false
      }
    ]
  },
  {
    "name": "giveaway beenden",
    "module": "community",
    "description": "Ein Giveaway sofort beenden",
    "permissions": null,
    "options": [
      {
        "name": "nachricht",
        "description": "Nachrichten-ID des Giveaways",
        "required": true
      }
    ]
  },
  {
    "name": "giveaway neu-auslosen",
    "module": "community",
    "description": "Neue Gewinner für ein beendetes Giveaway ziehen",
    "permissions": null,
    "options": [
      {
        "name": "nachricht",
        "description": "Nachrichten-ID des Giveaways",
        "required": true
      }
    ]
  },
  {
    "name": "giveaway start",
    "module": "community",
    "description": "Ein Giveaway starten",
    "permissions": null,
    "options": [
      {
        "name": "preis",
        "description": "Was gibt es zu gewinnen?",
        "required": true
      },
      {
        "name": "dauer",
        "description": "Dauer, z. B. 30m, 2h, 3d",
        "required": true
      },
      {
        "name": "gewinner",
        "description": "Anzahl Gewinner",
        "required": false
      },
      {
        "name": "rolle",
        "description": "Nur Mitglieder mit dieser Rolle dürfen teilnehmen",
        "required": false
      }
    ]
  },
  {
    "name": "umfrage",
    "module": "community",
    "description": "Eine Umfrage starten (Discords eigene Umfrage)",
    "permissions": null,
    "options": [
      {
        "name": "frage",
        "description": "Frage",
        "required": true
      },
      {
        "name": "antworten",
        "description": "Antworten, mit ; getrennt (2–10)",
        "required": true
      },
      {
        "name": "stunden",
        "description": "Dauer in Stunden (1–768, Standard 24)",
        "required": false
      },
      {
        "name": "mehrfach",
        "description": "Mehrere Antworten erlauben",
        "required": false
      }
    ]
  },
  {
    "name": "vorschlag",
    "module": "community",
    "description": "Einen Vorschlag für den Server machen",
    "permissions": null,
    "options": [
      {
        "name": "text",
        "description": "Dein Vorschlag",
        "required": true
      },
      {
        "name": "bereich",
        "description": "Bereich (z. B. Server-Ideen, Stream-Ideen)",
        "required": false
      }
    ]
  },
  {
    "name": "julia anrede",
    "module": "julia",
    "description": "Du oder Sie?",
    "permissions": null,
    "options": [
      {
        "name": "anrede",
        "description": "Anrede",
        "required": true
      }
    ]
  },
  {
    "name": "julia flirty",
    "module": "julia",
    "description": "Verspielten Flirt-Ton an- oder ausschalten (nur 18+)",
    "permissions": null,
    "options": [
      {
        "name": "status",
        "description": "an oder aus",
        "required": true
      },
      {
        "name": "alter",
        "description": "Dein Alter (nur zur Bestätigung, wird nicht gespeichert)",
        "required": false
      }
    ]
  },
  {
    "name": "julia frage",
    "module": "julia",
    "description": "Julia etwas fragen",
    "permissions": null,
    "options": [
      {
        "name": "text",
        "description": "Deine Frage",
        "required": true
      }
    ]
  },
  {
    "name": "julia gespraech",
    "module": "julia",
    "description": "Mit Julia im Sprachkanal reden (sie hört zu, bis ihr sie beendet)",
    "permissions": null,
    "options": [
      {
        "name": "aktion",
        "description": "Starten oder beenden",
        "required": true
      }
    ]
  },
  {
    "name": "julia herrscher",
    "module": "julia",
    "description": "Herrscher festlegen (nur der Instanz-Admin)",
    "permissions": null,
    "options": [
      {
        "name": "aktion",
        "description": "Was tun?",
        "required": true
      },
      {
        "name": "person",
        "description": "Wer?",
        "required": false
      },
      {
        "name": "titel",
        "description": "Titel, z. B. König, Kaiserin, Boss",
        "required": false
      }
    ]
  },
  {
    "name": "julia merken",
    "module": "julia",
    "description": "Julia soll sich etwas über dich merken",
    "permissions": null,
    "options": [
      {
        "name": "text",
        "description": "Was soll sie sich merken?",
        "required": true
      }
    ]
  },
  {
    "name": "julia modus",
    "module": "julia",
    "description": "Modus von Julia in diesem Kanal wechseln (ohne Namen: Liste)",
    "permissions": null,
    "options": [
      {
        "name": "name",
        "description": "Name des Modus",
        "required": false
      }
    ]
  },
  {
    "name": "julia optin",
    "module": "julia",
    "description": "Julia darf wieder mit dir reden",
    "permissions": null,
    "options": []
  },
  {
    "name": "julia optout",
    "module": "julia",
    "description": "Julia soll dich ignorieren (rückgängig: /julia optin)",
    "permissions": null,
    "options": []
  },
  {
    "name": "julia profil",
    "module": "julia",
    "description": "Zeigt, was Julia über dich weiß",
    "permissions": null,
    "options": []
  },
  {
    "name": "julia spitzname",
    "module": "julia",
    "description": "So soll Julia dich nennen",
    "permissions": null,
    "options": [
      {
        "name": "name",
        "description": "Spitzname (leer lassen = löschen)",
        "required": false
      }
    ]
  },
  {
    "name": "julia sprich",
    "module": "julia",
    "description": "Julia etwas fragen – sie antwortet im Sprachkanal",
    "permissions": null,
    "options": [
      {
        "name": "text",
        "description": "Deine Frage",
        "required": true
      }
    ]
  },
  {
    "name": "julia status",
    "module": "julia",
    "description": "Kosten und Budget von Julia anzeigen",
    "permissions": null,
    "options": []
  },
  {
    "name": "julia vergessen",
    "module": "julia",
    "description": "Alles löschen, was Julia über dich weiß",
    "permissions": null,
    "options": []
  },
  {
    "name": "moin zugang",
    "module": "kern",
    "description": "Generalschlüssel: Dashboard-Zugriff auf alle Server (nur Instanz-Admin)",
    "permissions": null,
    "options": [
      {
        "name": "aktion",
        "description": "an, aus oder Link zum Dashboard dieses Servers",
        "required": true
      }
    ]
  },
  {
    "name": "bestenliste",
    "module": "level",
    "description": "Zeigt die Bestenliste des Servers",
    "permissions": null,
    "options": []
  },
  {
    "name": "rang",
    "module": "level",
    "description": "Zeigt deine Rangkarte (Level, XP, Platz)",
    "permissions": null,
    "options": [
      {
        "name": "mitglied",
        "description": "Mitglied",
        "required": false
      }
    ]
  },
  {
    "name": "ban",
    "module": "moderation",
    "description": "Bannt ein Mitglied oder eine User-ID.",
    "permissions": "4",
    "options": [
      {
        "name": "user",
        "description": "Das Mitglied",
        "required": false
      },
      {
        "name": "user_id",
        "description": "User-ID (für Mitglieder, die nicht mehr auf dem Server sind)",
        "required": false
      },
      {
        "name": "delete_messages",
        "description": "Nachrichten der letzten … löschen",
        "required": false
      },
      {
        "name": "reason",
        "description": "Grund (sieht das Mitglied in der DM)",
        "required": false
      }
    ]
  },
  {
    "name": "case pardon",
    "module": "moderation",
    "description": "Nimmt eine Verwarnung zurück (zählt nicht mehr).",
    "permissions": "1099511627776",
    "options": [
      {
        "name": "number",
        "description": "Fall-Nummer",
        "required": true
      }
    ]
  },
  {
    "name": "case reason",
    "module": "moderation",
    "description": "Ändert den Grund eines Falls.",
    "permissions": "1099511627776",
    "options": [
      {
        "name": "number",
        "description": "Fall-Nummer",
        "required": true
      },
      {
        "name": "reason",
        "description": "Grund (sieht das Mitglied in der DM)",
        "required": true
      }
    ]
  },
  {
    "name": "case show",
    "module": "moderation",
    "description": "Zeigt einen Fall.",
    "permissions": "1099511627776",
    "options": [
      {
        "name": "number",
        "description": "Fall-Nummer",
        "required": true
      }
    ]
  },
  {
    "name": "clear",
    "module": "moderation",
    "description": "Löscht die letzten Nachrichten im Kanal.",
    "permissions": "8192",
    "options": [
      {
        "name": "amount",
        "description": "Anzahl (1–100)",
        "required": true
      },
      {
        "name": "user",
        "description": "Nur Nachrichten dieses Mitglieds",
        "required": false
      }
    ]
  },
  {
    "name": "geschuetzt kanal",
    "module": "moderation",
    "description": "Kanal schützen (nur geschützte Rollen sehen ihn) oder freigeben",
    "permissions": "32",
    "options": [
      {
        "name": "kanal",
        "description": "Der Kanal",
        "required": true
      },
      {
        "name": "aktion",
        "description": "Schützen oder nicht mehr schützen",
        "required": true
      }
    ]
  },
  {
    "name": "geschuetzt liste",
    "module": "moderation",
    "description": "Alle geschützten Kanäle und Rollen anzeigen",
    "permissions": "32",
    "options": []
  },
  {
    "name": "geschuetzt rolle",
    "module": "moderation",
    "description": "Rolle schützen (nie per Selbstbedienung) oder freigeben",
    "permissions": "32",
    "options": [
      {
        "name": "rolle",
        "description": "Die Rolle",
        "required": true
      },
      {
        "name": "aktion",
        "description": "Schützen oder nicht mehr schützen",
        "required": true
      }
    ]
  },
  {
    "name": "kick",
    "module": "moderation",
    "description": "Wirft ein Mitglied vom Server.",
    "permissions": "2",
    "options": [
      {
        "name": "user",
        "description": "Das Mitglied",
        "required": true
      },
      {
        "name": "reason",
        "description": "Grund (sieht das Mitglied in der DM)",
        "required": false
      }
    ]
  },
  {
    "name": "raenge verschieben",
    "module": "moderation",
    "description": "Eine Rolle in der Reihenfolge verschieben",
    "permissions": "268435456",
    "options": [
      {
        "name": "rolle",
        "description": "Welche Rolle?",
        "required": true
      },
      {
        "name": "richtung",
        "description": "Wohin?",
        "required": true
      },
      {
        "name": "schritte",
        "description": "Wie viele Plätze (Standard 1)",
        "required": false
      }
    ]
  },
  {
    "name": "timeout",
    "module": "moderation",
    "description": "Schickt ein Mitglied in den Timeout.",
    "permissions": "1099511627776",
    "options": [
      {
        "name": "user",
        "description": "Das Mitglied",
        "required": true
      },
      {
        "name": "duration",
        "description": "Dauer, z. B. 10m, 1h, 1d, 1w (max. 28 Tage)",
        "required": true
      },
      {
        "name": "reason",
        "description": "Grund (sieht das Mitglied in der DM)",
        "required": false
      }
    ]
  },
  {
    "name": "unban",
    "module": "moderation",
    "description": "Hebt einen Bann auf.",
    "permissions": "4",
    "options": [
      {
        "name": "user_id",
        "description": "User-ID (für Mitglieder, die nicht mehr auf dem Server sind)",
        "required": true
      },
      {
        "name": "reason",
        "description": "Grund (sieht das Mitglied in der DM)",
        "required": false
      }
    ]
  },
  {
    "name": "untimeout",
    "module": "moderation",
    "description": "Hebt einen Timeout auf.",
    "permissions": "1099511627776",
    "options": [
      {
        "name": "user",
        "description": "Das Mitglied",
        "required": true
      },
      {
        "name": "reason",
        "description": "Grund (sieht das Mitglied in der DM)",
        "required": false
      }
    ]
  },
  {
    "name": "warn",
    "module": "moderation",
    "description": "Verwarnt ein Mitglied (zählt für die Eskalation).",
    "permissions": "1099511627776",
    "options": [
      {
        "name": "user",
        "description": "Das Mitglied",
        "required": true
      },
      {
        "name": "reason",
        "description": "Grund (sieht das Mitglied in der DM)",
        "required": false
      }
    ]
  },
  {
    "name": "warns",
    "module": "moderation",
    "description": "Zeigt die Verwarnungen eines Mitglieds.",
    "permissions": "1099511627776",
    "options": [
      {
        "name": "user",
        "description": "Das Mitglied",
        "required": true
      }
    ]
  },
  {
    "name": "musik autoplay",
    "module": "musik",
    "description": "Autoplay an/aus (passende Titel, wenn die Schlange leer ist)",
    "permissions": null,
    "options": []
  },
  {
    "name": "musik effekt",
    "module": "musik",
    "description": "Audio-Effekt (Bassboost, Nightcore, 8D …)",
    "permissions": null,
    "options": [
      {
        "name": "name",
        "description": "Effekt",
        "required": true
      }
    ]
  },
  {
    "name": "musik entfernen",
    "module": "musik",
    "description": "Titel aus der Warteschlange entfernen",
    "permissions": null,
    "options": [
      {
        "name": "platz",
        "description": "Platz in der Warteschlange (1 = nächster)",
        "required": true
      }
    ]
  },
  {
    "name": "musik lautstaerke",
    "module": "musik",
    "description": "Lautstärke ändern",
    "permissions": null,
    "options": [
      {
        "name": "prozent",
        "description": "Lautstärke in Prozent (1–100)",
        "required": true
      }
    ]
  },
  {
    "name": "musik like",
    "module": "musik",
    "description": "Aktuellen Titel zu deinen Lieblingssongs",
    "permissions": null,
    "options": []
  },
  {
    "name": "musik loop",
    "module": "musik",
    "description": "Wiederholen: aus, Titel oder Warteschlange",
    "permissions": null,
    "options": [
      {
        "name": "modus",
        "description": "Modus",
        "required": true
      }
    ]
  },
  {
    "name": "musik lyrics",
    "module": "musik",
    "description": "Liedtext zum aktuellen Titel",
    "permissions": null,
    "options": []
  },
  {
    "name": "musik panel",
    "module": "musik",
    "description": "Steuer-Panel hier anzeigen",
    "permissions": null,
    "options": []
  },
  {
    "name": "musik pause",
    "module": "musik",
    "description": "Pause / weiter",
    "permissions": null,
    "options": []
  },
  {
    "name": "musik play",
    "module": "musik",
    "description": "Song, Radiosender, Favorit oder Link abspielen",
    "permissions": null,
    "options": [
      {
        "name": "suche",
        "description": "Songtitel, Sendername (Vorschläge beim Tippen) oder Link",
        "required": true
      }
    ]
  },
  {
    "name": "musik playlist laden",
    "module": "musik",
    "description": "Playlist abspielen",
    "permissions": null,
    "options": [
      {
        "name": "name",
        "description": "Name der Playlist",
        "required": true
      }
    ]
  },
  {
    "name": "musik playlist liste",
    "module": "musik",
    "description": "Deine Playlists anzeigen",
    "permissions": null,
    "options": []
  },
  {
    "name": "musik playlist loeschen",
    "module": "musik",
    "description": "Playlist löschen",
    "permissions": null,
    "options": [
      {
        "name": "name",
        "description": "Name der Playlist",
        "required": true
      }
    ]
  },
  {
    "name": "musik playlist speichern",
    "module": "musik",
    "description": "Aktuellen Titel + Warteschlange als Playlist speichern",
    "permissions": null,
    "options": [
      {
        "name": "name",
        "description": "Name der Playlist",
        "required": true
      }
    ]
  },
  {
    "name": "musik shuffle",
    "module": "musik",
    "description": "Warteschlange mischen",
    "permissions": null,
    "options": []
  },
  {
    "name": "musik skip",
    "module": "musik",
    "description": "Zum nächsten Titel springen",
    "permissions": null,
    "options": []
  },
  {
    "name": "musik springen",
    "module": "musik",
    "description": "Zu einem Titel in der Warteschlange springen",
    "permissions": null,
    "options": [
      {
        "name": "platz",
        "description": "Platz in der Warteschlange (1 = nächster)",
        "required": true
      }
    ]
  },
  {
    "name": "musik spulen",
    "module": "musik",
    "description": "Im Titel spulen",
    "permissions": null,
    "options": [
      {
        "name": "zeit",
        "description": "Zeit, z. B. 1:30 oder 90",
        "required": true
      }
    ]
  },
  {
    "name": "musik stop",
    "module": "musik",
    "description": "Musik stoppen und Kanal verlassen",
    "permissions": null,
    "options": []
  },
  {
    "name": "musik warteschlange",
    "module": "musik",
    "description": "Warteschlange anzeigen",
    "permissions": null,
    "options": []
  },
  {
    "name": "musik wiederherstellen",
    "module": "musik",
    "description": "Letzte Warteschlange wiederherstellen",
    "permissions": null,
    "options": []
  },
  {
    "name": "musik zurueck",
    "module": "musik",
    "description": "Zurück zum vorherigen Titel",
    "permissions": null,
    "options": []
  },
  {
    "name": "ticket add",
    "module": "tickets",
    "description": "Jemanden zum Ticket hinzufügen",
    "permissions": null,
    "options": [
      {
        "name": "user",
        "description": "Mitglied",
        "required": true
      }
    ]
  },
  {
    "name": "ticket close",
    "module": "tickets",
    "description": "Dieses Ticket schließen",
    "permissions": null,
    "options": [
      {
        "name": "reason",
        "description": "Grund",
        "required": false
      }
    ]
  },
  {
    "name": "ticket remove",
    "module": "tickets",
    "description": "Jemanden aus dem Ticket entfernen",
    "permissions": null,
    "options": [
      {
        "name": "user",
        "description": "Mitglied",
        "required": true
      }
    ]
  }
];
