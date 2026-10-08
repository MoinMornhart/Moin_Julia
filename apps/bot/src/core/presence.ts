import { ActivityType, type Client, type PresenceData } from 'discord.js';
import { presenceText, type BotPresence } from '@moin/shared';

const TYPES: Record<Exclude<BotPresence['type'], 'none'>, ActivityType> = {
  custom: ActivityType.Custom,
  playing: ActivityType.Playing,
  listening: ActivityType.Listening,
  watching: ActivityType.Watching,
  competing: ActivityType.Competing,
};

/** Einstellungen aus dem Dashboard → Discord-Presence */
export function toPresenceData(p: BotPresence, ctx: { version: string; servers: number }): PresenceData {
  const name = presenceText(p, ctx);
  return {
    status: p.status,
    activities: p.type === 'none' || !name ? [] : [{ name, type: TYPES[p.type], ...(p.type === 'custom' ? { state: name } : {}) }],
  };
}

export function applyPresence(client: Client<true>, p: BotPresence, version: string): void {
  client.user.setPresence(toPresenceData(p, { version, servers: client.guilds.cache.size }));
}
