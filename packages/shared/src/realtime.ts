/** Redis-Pub/Sub-Kanal: Dashboard → Bot, damit Änderungen ohne Neustart greifen. */
export const CONFIG_CHANNEL = 'moin:config';

/** Redis-Key, unter dem der Bot regelmäßig seinen Status ablegt. */
export const BOT_HEARTBEAT_KEY = 'moin:bot:heartbeat';
export const BOT_HEARTBEAT_TTL_SECONDS = 60;

export type ConfigEvent =
  | { type: 'module'; guildId: string; moduleId: string; enabled: boolean }
  | { type: 'module-config'; guildId: string; moduleId: string }
  | { type: 'guild-settings'; guildId: string };

export interface BotHeartbeat {
  version: string;
  startedAt: string;
  updatedAt: string;
  guilds: number;
  pingMs: number;
  user: string;
}
