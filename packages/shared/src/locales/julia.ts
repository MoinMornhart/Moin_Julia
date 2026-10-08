const de = {
  'julia.cmd.root': 'Mit Julia reden',
  'julia.cmd.ask': 'Julia etwas fragen',
  'julia.cmd.question': 'Deine Frage',
  'julia.cmd.status': 'Kosten und Budget von Julia anzeigen',
  'julia.cooldown': '⏳ Kurz durchatmen – ich antworte dir gleich wieder.',
  'julia.hourly': '⏳ Du hast mich in der letzten Stunde schon oft gefragt. Probier es später nochmal!',
  'julia.budget': '💤 Mein Budget für diesen Monat ist aufgebraucht – nächsten Monat bin ich wieder da.',
  'julia.notConnected': '🔌 Ich bin noch nicht verbunden. Ein Admin kann das im Dashboard unter Julia → Verbindung einrichten.',
  'julia.error': '😵 Da ist mir gerade etwas schiefgegangen. Versuch es gleich nochmal.',
  'julia.refused': 'Dazu sage ich lieber nichts. 🙂',
  'julia.blocked': 'Du darfst Julia auf diesem Server nicht nutzen.',
  'julia.status': '💬 **Julia** · {provider}\nDiesen Monat: **{spent}** von **{budget}** ({percent} %) · {requests} Antworten',
  'julia.warn': '⚠️ Julia hat **{percent} %** des Monatsbudgets verbraucht ({spent} von {budget}). Bei 100 % antwortet sie bis zum Monatsende nicht mehr.',
  'julia.noPermission': 'Das dürfen nur Leute mit „Server verwalten“.',
};

const en: Record<keyof typeof de, string> = {
  'julia.cmd.root': 'Talk to Julia',
  'julia.cmd.ask': 'Ask Julia something',
  'julia.cmd.question': 'Your question',
  'julia.cmd.status': 'Show Julia’s costs and budget',
  'julia.cooldown': '⏳ Take a breath – I’ll answer again in a moment.',
  'julia.hourly': '⏳ You asked me a lot in the last hour. Try again later!',
  'julia.budget': '💤 My budget for this month is used up – I’ll be back next month.',
  'julia.notConnected': '🔌 I’m not connected yet. An admin can set this up in the dashboard under Julia → Connection.',
  'julia.error': '😵 Something went wrong. Please try again in a moment.',
  'julia.refused': 'I’d rather not say anything about that. 🙂',
  'julia.blocked': 'You are not allowed to use Julia on this server.',
  'julia.status': '💬 **Julia** · {provider}\nThis month: **{spent}** of **{budget}** ({percent} %) · {requests} replies',
  'julia.warn': '⚠️ Julia has used **{percent} %** of the monthly budget ({spent} of {budget}). At 100 % she stops answering until the end of the month.',
  'julia.noPermission': 'Only people with “Manage Server” can do that.',
};

export const julia = { de, en };
