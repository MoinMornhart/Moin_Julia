const de = {
  'common.error': 'Da ist etwas schiefgelaufen. Bitte versuch es gleich nochmal.',
  'common.moduleDisabled': 'Das Modul **{module}** ist auf diesem Server ausgeschaltet. Ein Admin kann es im Dashboard aktivieren.',
  'common.guildOnly': 'Dieser Befehl funktioniert nur auf einem Server.',
  'common.yes': 'Ja',
  'common.no': 'Nein',
  'common.none': '–',
  'ping.description': 'Prüft, ob der Bot antwortet, und zeigt die Latenz.',
  'ping.title': 'Pong! 🏓',
  'ping.gateway': 'Gateway',
  'ping.roundtrip': 'Antwortzeit',
  'ping.database': 'Datenbank',
  'ping.version': 'Version',
} as const;

const en: Record<keyof typeof de, string> = {
  'common.error': 'Something went wrong. Please try again in a moment.',
  'common.moduleDisabled': 'The **{module}** module is disabled on this server. An admin can enable it in the dashboard.',
  'common.guildOnly': 'This command only works on a server.',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.none': '–',
  'ping.description': 'Checks whether the bot responds and shows the latency.',
  'ping.title': 'Pong! 🏓',
  'ping.gateway': 'Gateway',
  'ping.roundtrip': 'Round trip',
  'ping.database': 'Database',
  'ping.version': 'Version',
};

export const core = { de, en };
