import type { DiscordRole } from './discord';

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
