/**
 * Spaß-Sprache „🍼 Für Dummies“ (Wunsch Philip, 14.10.; Stil wie die „Hugo-Sprache“):
 * alles super einfach, mit Alltagsvergleichen und Emojis – freundlich-witzig, nie gemein.
 * Nur die häufigsten Texte sind „übersetzt“; alle anderen kommen automatisch auf Deutsch.
 * Platzhalter wie {user} müssen genauso bleiben wie im Deutschen (Test prüft das).
 */
export const dummies = {
  'common.error': 'Uiii, da ist was kaputtgegangen 🙈 Wie wenn der Turm aus Bauklötzen umfällt. Einfach gleich nochmal probieren!',
  'common.maintenance': '🛠️ Julia ist gerade beim Doktor-Check-up (Wartung). Gleich ist sie wieder fit! {message}',
  'common.moduleDisabled': 'Das Ding **{module}** ist hier ausgeknipst – wie ein Licht ohne Strom 💡. Ein Erwachsener (Admin) kann es im Dashboard anknipsen.',
  'common.guildOnly': 'Das geht nur auf einem Server – nicht im Privat-Chat. Wie Fußball: braucht einen Platz ⚽',
  'common.yes': 'Jaaa 👍',
  'common.no': 'Nö 👎',
  'ping.title': 'Pong! 🏓 Ich bin wach!',
  'ping.gateway': 'Wie schnell ich höre',
  'ping.roundtrip': 'Wie schnell ich antworte',
  'ping.database': 'Mein Gedächtnis',
  'ping.version': 'Wie alt ich bin (Version)',
  'music.nothing': 'Gerade ist es ganz still – keine Musik 🤫',
  'music.stopped': '⏹️ Musik aus. Schhh 🤫',
  'music.skipped': '⏭️ Nächstes Lied! Hopp hopp 🐇',
  'music.paused': '⏸️ Pause – wie Luft anhalten 😮',
  'music.resumed': '▶️ Und weiter geht die Party 🎉',
  'music.left': '👋 Keine Musik mehr – ich geh dann mal nach Hause 🏠',
  'music.queued': '➕ Kommt in die Schlange (Platz {position}), wie beim Eiswagen 🍦: **{title}**',
  'music.queuedMany': '➕ {count} Lieder stehen jetzt in der Schlange 🍦',
  'music.otherChannel': 'Ich bin schon in {channel} und singe dort 🎤 – komm rüber!',
  'music.noPermission': 'Die Musik steuern dürfen nur die DJs 🎧 (oder die Chefs mit „Server verwalten“).',
  'julia.cooldown': '⏳ Ich muss kurz Luft holen – wie nach dem Rennen 🏃‍♀️. Gleich bin ich wieder da!',
  'julia.budget': '💤 Mein Taschengeld für diesen Monat ist alle 🪙 – nächsten Monat rede ich wieder!',
  'julia.notConnected': '🔌 Mein Kopf ist noch nicht eingesteckt. Ein Erwachsener (Admin) steckt ihn im Dashboard bei Julia → Verbindung ein.',
  'julia.refused': 'Dazu sag ich nix – Mund zu 🤐',
  'julia.blocked': 'Du darfst hier leider nicht mit mir quatschen 🚫',
  'julia.noPermission': 'Das dürfen nur die Chefs mit „Server verwalten“ 👑',
  'tickets.opened': '✅ Dein Hilfe-Zimmer ist auf: {channel} – da wartet gleich jemand auf dich 🛋️',
  'tickets.opening': 'Dein Hilfe-Zimmer wird gerade gebaut 🧱 – einen Moment!',
  'level.rank.headline': 'Stufe {level} 🪜',
  'level.rank.place': 'Platz #{place} 🏆',
  'level.rank.none': '{user} hat noch keine Punkte gesammelt – wie ein leeres Sparschwein 🐷',
  'mod.warns.none': '**{user}** war immer lieb – keine Verwarnungen! 😇',
  'mod.warns.title': 'Gelbe Karten von {user} 🟨',
} as const;
