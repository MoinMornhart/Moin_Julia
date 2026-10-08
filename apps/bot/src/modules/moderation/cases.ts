import { PermissionFlagsBits, type Guild } from 'discord.js';
import { parseModerationConfig, type ModerationConfig } from '@moin/shared';
import type { ModCase } from '@moin/db';
import type { BotContext } from '../../core/types.js';
import { caseEmbed, type CaseData, type CaseType } from './logic.js';

export function moderationConfig(bot: BotContext, guildId: string): Promise<ModerationConfig> {
  return bot.modules.config(guildId, 'moderation', parseModerationConfig);
}

export interface Party {
  id: string;
  tag: string;
}

export function toCaseData(c: ModCase): CaseData {
  return { ...c, type: c.type as CaseType };
}

/** Legt einen Fall mit der nächsten fortlaufenden Nummer an (atomar, auch bei gleichzeitigen Aktionen). */
export async function createCase(
  bot: BotContext,
  p: { guildId: string; type: CaseType; user: Party; moderator: Party; reason: string | null; durationSec?: number | null; source?: string },
): Promise<ModCase> {
  return bot.prisma.$transaction(async (tx) => {
    const guild = await tx.guild.update({ where: { id: p.guildId }, data: { caseCounter: { increment: 1 } }, select: { caseCounter: true } });
    return tx.modCase.create({
      data: {
        guildId: p.guildId,
        number: guild.caseCounter,
        type: p.type,
        userId: p.user.id,
        userTag: p.user.tag,
        moderatorId: p.moderator.id,
        moderatorTag: p.moderator.tag,
        reason: p.reason,
        durationSec: p.durationSec ?? null,
        source: p.source ?? 'command',
      },
    });
  });
}

/** Aktive Verwarnungen eines Mitglieds (abgelaufene zählen nicht). */
export async function activeWarnCount(bot: BotContext, guildId: string, userId: string, expiryDays: number | null): Promise<number> {
  return bot.prisma.modCase.count({
    where: {
      guildId,
      userId,
      type: 'WARN',
      active: true,
      ...(expiryDays ? { createdAt: { gte: new Date(Date.now() - expiryDays * 864e5) } } : {}),
    },
  });
}

/** Schickt die Fall-Karte in den Mod-Log und merkt sich die Nachricht. */
export async function postModLog(bot: BotContext, guild: Guild, modCase: ModCase, config?: ModerationConfig): Promise<void> {
  const cfg = config ?? (await moderationConfig(bot, guild.id));
  if (!cfg.modLogChannelId) return;
  const channel = guild.channels.cache.get(cfg.modLogChannelId);
  const me = guild.members.me;
  if (!channel?.isTextBased() || !me || !channel.permissionsFor(me)?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
    bot.logger.warn({ guildId: guild.id, channelId: cfg.modLogChannelId }, 'Mod-Log-Kanal fehlt oder ist nicht beschreibbar');
    return;
  }
  const locale = await bot.modules.locale(guild.id);
  const message = await channel.send({ embeds: [caseEmbed(locale, toCaseData(modCase))], allowedMentions: { parse: [] } });
  await bot.prisma.modCase.update({ where: { id: modCase.id }, data: { logMessageId: message.id } });
}

/** Aktualisiert die Fall-Karte im Mod-Log nach einer Änderung (Grund, Rücknahme). */
export async function refreshModLog(bot: BotContext, guild: Guild, modCase: ModCase): Promise<void> {
  if (!modCase.logMessageId) return;
  const cfg = await moderationConfig(bot, guild.id);
  if (!cfg.modLogChannelId) return;
  const channel = guild.channels.cache.get(cfg.modLogChannelId);
  if (!channel?.isTextBased()) return;
  const locale = await bot.modules.locale(guild.id);
  try {
    const message = await channel.messages.fetch(modCase.logMessageId);
    await message.edit({ embeds: [caseEmbed(locale, toCaseData(modCase))] });
  } catch {
    // Nachricht gelöscht – egal
  }
}
