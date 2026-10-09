import { PermissionFlagsBits, type GuildMember } from 'discord.js';
import type { JuliaProfile, Prisma } from '@moin/db';
import { DEFAULT_MODE_NAME, findMode, MAX_FACTS, type JuliaConfig, type JuliaFact, type JuliaMode, type JuliaProfileView } from '@moin/shared';
import type { BotContext } from '../../core/types.js';

/** Profile (Spitzname, Anrede, Gedächtnis, Opt-out, Flirt) und Modi pro Kanal */

export function factsOf(profile: Pick<JuliaProfile, 'facts'> | null): JuliaFact[] {
  return Array.isArray(profile?.facts) ? (profile.facts as unknown as JuliaFact[]).filter((f) => f && typeof f.text === 'string') : [];
}

export function profileView(profile: JuliaProfile | null): JuliaProfileView | null {
  if (!profile) return null;
  return { nickname: profile.nickname, address: profile.address === 'du' || profile.address === 'sie' ? profile.address : null, facts: factsOf(profile) };
}

export function getProfile(bot: BotContext, guildId: string, userId: string): Promise<JuliaProfile | null> {
  return bot.prisma.juliaProfile.findUnique({ where: { guildId_userId: { guildId, userId } } });
}

export interface ProfilePatch {
  nickname?: string | null;
  address?: 'du' | 'sie' | null;
  facts?: JuliaFact[];
  optOut?: boolean;
  flirtyOptIn?: boolean;
  underage?: boolean;
}

export function updateProfile(bot: BotContext, member: GuildMember, patch: ProfilePatch) {
  const { facts, ...rest } = patch;
  const factsJson = facts ? { facts: facts as unknown as Prisma.InputJsonValue } : {};
  return bot.prisma.juliaProfile.upsert({
    where: { guildId_userId: { guildId: member.guild.id, userId: member.id } },
    create: { guildId: member.guild.id, userId: member.id, userTag: member.user.username, ...rest, ...factsJson },
    update: { ...rest, ...factsJson, userTag: member.user.username },
  });
}

/** Fakten anhängen (älteste fliegen raus, wenn voll; doppelte werden ignoriert) */
export async function rememberFacts(bot: BotContext, member: GuildMember, facts: string[], now = new Date()): Promise<JuliaFact[]> {
  const profile = await getProfile(bot, member.guild.id, member.id);
  const existing = factsOf(profile);
  const fresh = facts.map((f) => f.trim().slice(0, 200)).filter((f) => f && !existing.some((e) => e.text.toLowerCase() === f.toLowerCase()));
  if (!fresh.length) return existing;
  const next = [...existing, ...fresh.map((text) => ({ text, at: now.toISOString() }))].slice(-MAX_FACTS);
  await updateProfile(bot, member, { facts: next });
  return next;
}

/**
 * Modus im Kanal (Thread erbt vom Elternkanal): mode = null → Standard-Persona.
 * `since` = Zeitpunkt des letzten Umschaltens – ältere Nachrichten gehören zum alten Modus.
 */
export async function modeState(bot: BotContext, config: JuliaConfig, guildId: string, channelIds: string[]): Promise<{ mode: JuliaMode | null; since: Date | null }> {
  for (const channelId of channelIds) {
    const row = await bot.prisma.juliaChannelMode.findUnique({ where: { guildId_channelId: { guildId, channelId } } });
    if (row) return { mode: config.modes.find((m) => m.id === row.modeId) ?? null, since: row.updatedAt ?? null };
  }
  return { mode: null, since: null };
}

/** Aktiver Modus im Kanal (Thread erbt vom Elternkanal); null = Standard-Persona */
export async function activeMode(bot: BotContext, config: JuliaConfig, guildId: string, channelIds: string[]): Promise<JuliaMode | null> {
  return (await modeState(bot, config, guildId, channelIds)).mode;
}

export function canSwitchMode(member: GuildMember, config: Pick<JuliaConfig, 'modeRoleIds'>): boolean {
  return member.permissions.has(PermissionFlagsBits.ManageGuild) || config.modeRoleIds.some((r) => member.roles.cache.has(r));
}

export const modeList = (config: Pick<JuliaConfig, 'modes'>) => [DEFAULT_MODE_NAME, ...config.modes.map((m) => m.name)].map((n) => `\`${n}\``).join(', ');

/** Modus im Kanal setzen; Ergebnis: neuer Name oder null (unbekannt) */
export async function switchMode(bot: BotContext, config: JuliaConfig, guildId: string, channelId: string, name: string, by: string): Promise<string | null> {
  const mode = findMode(config, name);
  if (!mode) return null;
  // Auch „zurück zu Julia“ wird gespeichert (modeId leer): so gilt es auch in Threads gegenüber dem
  // Elternkanal, und Julia weiß, ab wann sie den alten Modus im Verlauf ignorieren soll
  const modeId = mode === 'default' ? '' : mode.id;
  await bot.prisma.juliaChannelMode.upsert({
    where: { guildId_channelId: { guildId, channelId } },
    create: { guildId, channelId, modeId, setBy: by },
    update: { modeId, setBy: by },
  });
  return mode === 'default' ? DEFAULT_MODE_NAME : mode.name;
}
