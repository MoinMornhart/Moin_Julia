const de = {
  'level.cmd.rank': 'Zeigt deine Rangkarte (Level, XP, Platz)',
  'level.cmd.leaderboard': 'Zeigt die Bestenliste des Servers',
  'level.cmd.user': 'Mitglied',
  'level.rank.headline': 'Level {level}',
  'level.rank.place': 'Platz #{place}',
  'level.rank.xp': '{current} / {needed} XP',
  'level.rank.none': '{user} hat noch keine XP gesammelt.',
  'level.board.title': '🏆 Bestenliste – {server}',
  'level.board.empty': 'Noch hat niemand XP gesammelt.',
  'level.board.line': '**#{place}** {user} · Level {level} · {xp} XP',
  'level.board.more': 'Ganze Bestenliste',
  'level.disabled': 'Das Level-System ist auf diesem Server aus.',
  'level.reason.reward': 'Level-Belohnung',
};

const en: Record<keyof typeof de, string> = {
  'level.cmd.rank': 'Shows your rank card (level, XP, place)',
  'level.cmd.leaderboard': 'Shows the server leaderboard',
  'level.cmd.user': 'Member',
  'level.rank.headline': 'Level {level}',
  'level.rank.place': 'Rank #{place}',
  'level.rank.xp': '{current} / {needed} XP',
  'level.rank.none': '{user} has not collected any XP yet.',
  'level.board.title': '🏆 Leaderboard – {server}',
  'level.board.empty': 'Nobody has collected XP yet.',
  'level.board.line': '**#{place}** {user} · Level {level} · {xp} XP',
  'level.board.more': 'Full leaderboard',
  'level.disabled': 'The level system is turned off on this server.',
  'level.reason.reward': 'Level reward',
};

export const level = { de, en };
