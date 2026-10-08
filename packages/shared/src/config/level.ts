import { z } from 'zod';
import { CARD_STYLES } from './willkommen.js';

/**
 * Level & XP: XP für Nachrichten (mit Abklingzeit) und Zeit im Sprachkanal, Level-Rollen,
 * Level-up-Meldung, Rangkarte und Bestenliste. Kurve wie bei MEE6: Level n → n+1 kostet 5n² + 50n + 100 XP.
 */

const snowflake = z.string().regex(/^\d{15,22}$/);
const optionalSnowflake = z.union([snowflake, z.literal('')]);

export const LEVEL_UP_MODES = ['current', 'channel', 'dm', 'off'] as const;
export const LEVEL_UP_MODE_LABELS: Record<(typeof LEVEL_UP_MODES)[number], string> = {
  current: 'im Kanal, in dem geschrieben wurde',
  channel: 'in einem festen Kanal',
  dm: 'per Direktnachricht',
  off: 'gar nicht',
};

export const DEFAULT_LEVEL_UP_TEXT = '🎉 GG {user}, du bist jetzt **Level {level}**!';
export const LEVEL_PLACEHOLDERS = ['{user}', '{name}', '{level}', '{server}'] as const;

export const levelRewardSchema = z.object({
  level: z.number().int().min(1).max(500),
  roleId: snowflake,
});
export type LevelReward = z.infer<typeof levelRewardSchema>;

export const levelConfigSchema = z.object({
  textXp: z.boolean().default(true),
  textXpMin: z.number().int().min(0).max(500).default(15),
  textXpMax: z.number().int().min(0).max(500).default(25),
  cooldownSeconds: z.number().int().min(0).max(3600).default(60),
  voiceXp: z.boolean().default(true),
  voiceXpPerMinute: z.number().int().min(0).max(100).default(5),
  /** Voice-XP nur, wenn mindestens 2 echte Personen im Kanal sind und man nicht taub gestellt ist */
  voiceNeedsCompany: z.boolean().default(true),
  ignoredChannelIds: z.array(snowflake).max(100).default([]),
  ignoredRoleIds: z.array(snowflake).max(50).default([]),
  /** XP-Bonus für Rollen (z. B. Booster +50 %) – der höchste zählt */
  boosts: z.array(z.object({ roleId: snowflake, percent: z.number().int().min(-100).max(500) })).max(20).default([]),
  levelUpMode: z.enum(LEVEL_UP_MODES).default('current'),
  levelUpChannelId: optionalSnowflake.default(''),
  levelUpText: z.string().max(1000).default(DEFAULT_LEVEL_UP_TEXT),
  rewards: z.array(levelRewardSchema).max(50).default([]),
  /** true: nur die höchste erreichte Belohnungsrolle behalten (niedrigere werden entzogen) */
  rewardsReplace: z.boolean().default(false),
  cardStyle: z.enum(CARD_STYLES).default('hafen'),
  /** Bestenliste ohne Anmeldung unter /rangliste/<server> */
  publicLeaderboard: z.boolean().default(false),
});
export type LevelConfig = z.infer<typeof levelConfigSchema>;

export function parseLevelConfig(raw: unknown): LevelConfig {
  const parsed = levelConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : levelConfigSchema.parse({});
}

/** XP, um von Level n auf n+1 zu kommen */
export function xpForNextLevel(level: number): number {
  return 5 * level * level + 50 * level + 100;
}

/** Gesamt-XP, die man für Level n braucht */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let n = 0; n < level; n++) total += xpForNextLevel(n);
  return total;
}

/** Level und Fortschritt aus Gesamt-XP */
export function levelFromXp(xp: number): { level: number; current: number; needed: number } {
  let level = 0;
  let rest = Math.max(0, Math.floor(xp));
  while (rest >= xpForNextLevel(level) && level < 1000) {
    rest -= xpForNextLevel(level);
    level++;
  }
  return { level, current: rest, needed: xpForNextLevel(level) };
}

/** Welche Belohnungsrollen jemand mit diesem Level haben soll bzw. verlieren soll */
export function rewardRoles(config: Pick<LevelConfig, 'rewards' | 'rewardsReplace'>, level: number): { give: string[]; take: string[] } {
  const reached = config.rewards.filter((r) => r.level <= level).sort((a, b) => a.level - b.level);
  const notReached = config.rewards.filter((r) => r.level > level).map((r) => r.roleId);
  if (!config.rewardsReplace) return { give: [...new Set(reached.map((r) => r.roleId))], take: notReached.filter((id) => !reached.some((r) => r.roleId === id)) };
  const top = reached.at(-1);
  const give = top ? [top.roleId] : [];
  return { give, take: [...new Set([...reached.slice(0, -1).map((r) => r.roleId), ...notReached])].filter((id) => !give.includes(id)) };
}

/** Bonus in Prozent für die Rollen eines Mitglieds (höchster gewinnt; ohne Treffer 0) */
export function boostPercent(config: Pick<LevelConfig, 'boosts'>, roleIds: string[]): number {
  const hits = config.boosts.filter((b) => roleIds.includes(b.roleId)).map((b) => b.percent);
  return hits.length ? Math.max(...hits) : 0;
}

export function fillLevelText(text: string, ctx: { user: string; name: string; level: number; server: string }): string {
  return text.replaceAll('{user}', ctx.user).replaceAll('{name}', ctx.name).replaceAll('{level}', String(ctx.level)).replaceAll('{server}', ctx.server).slice(0, 2000);
}

/** Eingabe des Belohnungs-Editors im Dashboard */
export const levelRewardsInputSchema = levelConfigSchema.pick({ rewards: true, rewardsReplace: true, boosts: true });
