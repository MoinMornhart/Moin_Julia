import type { ChannelOption, DiscordRole } from './discord';

/** Feste IDs für den Demo-Modus (Screenshots ohne echten Discord-Login). */
export const DEMO_GUILD_ID = '100000000000000001';
export const DEMO_USER_ID = '100000000000000002';

export const DEMO_ROLES: DiscordRole[] = [
  { id: '100000000000000011', name: 'Admin', color: 0xff7a59, position: 5, managed: false, permissions: '8' },
  { id: '100000000000000012', name: 'Moderator', color: 0x2fd1b8, position: 4, managed: false },
  { id: '100000000000000013', name: 'Supporter', color: 0xffc857, position: 3, managed: false },
  { id: '100000000000000014', name: 'Subscriber', color: 0x9b8cff, position: 2, managed: false },
  { id: '100000000000000015', name: 'Community', color: 0, position: 1, managed: false },
];

export const DEMO_CHANNELS: ChannelOption[] = [
  { id: '100000000000000021', name: 'regeln', type: 0, group: 'Info' },
  { id: '100000000000000022', name: 'ankündigungen', type: 5, group: 'Info' },
  { id: '100000000000000023', name: 'allgemein', type: 0, group: 'Community' },
  { id: '100000000000000024', name: 'clips', type: 0, group: 'Community' },
  { id: '100000000000000025', name: 'memes', type: 0, group: 'Community' },
  { id: '100000000000000026', name: 'Lounge', type: 2, group: 'Community' },
  { id: '100000000000000040', name: '🎙️ Eigene Sprachkanäle', type: 4, group: null },
  { id: '100000000000000041', name: '➕ Kanal erstellen', type: 2, group: '🎙️ Eigene Sprachkanäle' },
  { id: '100000000000000027', name: 'mod-chat', type: 0, group: 'Team' },
  { id: '100000000000000028', name: 'mod-log', type: 0, group: 'Team' },
  { id: '100000000000000029', name: 'nachrichten-log', type: 0, group: 'Team' },
  { id: '100000000000000030', name: 'join-log', type: 0, group: 'Team' },
  { id: '100000000000000032', name: 'support', type: 0, group: 'Team' },
  { id: '100000000000000031', name: 'Support-Warteraum', type: 2, group: 'Team' },
  { id: '100000000000000060', name: '🔒 Owner-Bereich', type: 4, group: null },
  { id: '100000000000000061', name: 'owner-notizen', type: 0, group: '🔒 Owner-Bereich' },
];

/** Beispiel-Fälle (erfunden) für Screenshots – legt sie nur an, wenn der Demo-Server noch keine hat. */
export const DEMO_CASES = [
  { type: 'WARN', userId: '100000000000000041', userTag: 'spammer.lukas', reason: 'Werbung für fremden Server im #allgemein', source: 'command', active: true, minutesAgo: 2900 },
  { type: 'WARN', userId: '100000000000000041', userTag: 'spammer.lukas', reason: 'Automod: Spam (8 Nachrichten in 5 s)', source: 'automod', active: true, minutesAgo: 1500 },
  { type: 'WARN', userId: '100000000000000042', userTag: 'mia.gaming', reason: 'Spoiler ohne Markierung', source: 'command', active: false, minutesAgo: 1300 },
  { type: 'WARN', userId: '100000000000000041', userTag: 'spammer.lukas', reason: 'Beleidigung im Stream-Chat', source: 'command', active: true, minutesAgo: 240 },
  { type: 'TIMEOUT', userId: '100000000000000041', userTag: 'spammer.lukas', reason: 'Eskalation: 3 × Verwarnung', source: 'escalation', active: true, minutesAgo: 239, durationSec: 3600 },
  { type: 'BAN', userId: '100000000000000043', userTag: 'free.nitro.bot', reason: 'Phishing-Links', source: 'command', active: true, minutesAgo: 60 },
] as const;

/** Beispiel-Tickets für Demo und Screenshots (Namen erfunden) */
export const DEMO_TICKETS = [
  { number: 1, openerTag: 'lukas.gamer', reasonLabel: 'Frage', status: 'closed', rating: 5, closeReason: 'Frage beantwortet', minutesAgo: 2880 },
  { number: 2, openerTag: 'mia_zeichnet', reasonLabel: 'Bewerbung', status: 'closed', rating: 4, closeReason: 'Bewerbung angenommen', minutesAgo: 1440 },
  { number: 3, openerTag: 'anna.streamt', reasonLabel: 'Problem melden', status: 'open', rating: null, closeReason: null, minutesAgo: 30 },
] as const;

export function demoTranscript(number: number, opener: string, reason: string): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Ticket #${number}</title><style>body{margin:0;background:#313338;color:#dbdee1;font:15px/1.45 "Segoe UI",sans-serif}header{padding:20px 24px;background:#2b2d31}h1{margin:0;font-size:20px;color:#f2f3f5}main{padding:12px 24px}.msg{padding:8px 0}.n{font-weight:600;color:#f2f3f5}</style></head><body><header><h1>🎫 Ticket #${number} · ${reason}</h1><p>Demo-Verlauf · geöffnet von ${opener}</p></header><main><div class="msg"><span class="n">${opener}</span><p>Moin! Ich hätte da mal eine Frage …</p></div><div class="msg"><span class="n">Demo-Owner</span><p>Klar, schieß los! 🙂</p></div></main></body></html>`;
}
