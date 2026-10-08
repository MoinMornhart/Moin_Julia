import type { LevelConfig } from '@moin/shared';

/** XP für eine Nachricht: Zufall zwischen min und max, plus Rollen-Bonus */
export function rollTextXp(config: Pick<LevelConfig, 'textXpMin' | 'textXpMax'>, boost: number, random = Math.random): number {
  const min = Math.min(config.textXpMin, config.textXpMax);
  const max = Math.max(config.textXpMin, config.textXpMax);
  const base = min + Math.floor(random() * (max - min + 1));
  return applyBoost(base, boost);
}

export function applyBoost(xp: number, boost: number): number {
  return Math.max(0, Math.round(xp * (1 + boost / 100)));
}

/** Gibt diese Nachricht XP? (Kanal/Kategorie/Rolle ignoriert, Abklingzeit) */
export function textXpAllowed(
  config: Pick<LevelConfig, 'textXp' | 'cooldownSeconds' | 'ignoredChannelIds' | 'ignoredRoleIds'>,
  ctx: { channelIds: string[]; roleIds: string[]; lastXpAt: Date | null; now: Date },
): boolean {
  if (!config.textXp) return false;
  if (ctx.channelIds.some((id) => config.ignoredChannelIds.includes(id))) return false;
  if (ctx.roleIds.some((id) => config.ignoredRoleIds.includes(id))) return false;
  if (ctx.lastXpAt && ctx.now.getTime() - ctx.lastXpAt.getTime() < config.cooldownSeconds * 1000) return false;
  return true;
}

/** Bekommt jemand im Sprachkanal gerade XP? */
export function voiceXpAllowed(
  config: Pick<LevelConfig, 'voiceXp' | 'voiceNeedsCompany' | 'ignoredChannelIds' | 'ignoredRoleIds'>,
  ctx: { channelIds: string[]; roleIds: string[]; isBot: boolean; deaf: boolean; afkChannel: boolean; humansInChannel: number },
): boolean {
  if (!config.voiceXp || ctx.isBot || ctx.afkChannel) return false;
  if (ctx.channelIds.some((id) => config.ignoredChannelIds.includes(id))) return false;
  if (ctx.roleIds.some((id) => config.ignoredRoleIds.includes(id))) return false;
  if (config.voiceNeedsCompany && (ctx.deaf || ctx.humansInChannel < 2)) return false;
  return true;
}
