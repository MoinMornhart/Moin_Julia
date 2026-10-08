import type { ChannelOption, DiscordRole } from './discord';

/** Feste IDs für den Demo-Modus (Screenshots ohne echten Discord-Login). */
export const DEMO_GUILD_ID = '100000000000000001';
export const DEMO_USER_ID = '100000000000000002';

export const DEMO_ROLES: DiscordRole[] = [
  { id: '100000000000000011', name: 'Admin', color: 0xff7a59, position: 5, managed: false },
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
  { id: '100000000000000027', name: 'mod-chat', type: 0, group: 'Team' },
  { id: '100000000000000028', name: 'mod-log', type: 0, group: 'Team' },
  { id: '100000000000000029', name: 'nachrichten-log', type: 0, group: 'Team' },
  { id: '100000000000000030', name: 'join-log', type: 0, group: 'Team' },
  { id: '100000000000000031', name: 'Support-Warteraum', type: 2, group: 'Team' },
];
