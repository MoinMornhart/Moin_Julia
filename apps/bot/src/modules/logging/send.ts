import { AuditLogEvent, PermissionFlagsBits, type APIEmbed, type AttachmentBuilder, type Guild, type User } from 'discord.js';
import { logTarget, parseLoggingConfig, type LogCategory, type LoggingConfig } from '@moin/shared';
import type { BotContext } from '../../core/types.js';
import type { LogUserRef } from './embeds.js';

export function loggingConfig(bot: BotContext, guildId: string): Promise<LoggingConfig> {
  return bot.modules.config(guildId, 'logging', parseLoggingConfig);
}

export function userRef(user: User): LogUserRef {
  return { id: user.id, tag: user.tag, avatarUrl: user.displayAvatarURL({ size: 128 }) };
}

/** Alle Kanäle, in die geloggt wird – Ereignisse dort werden ignoriert, damit keine Schleifen entstehen. */
export function logChannelIds(config: LoggingConfig): Set<string> {
  const ids = new Set<string>();
  if (config.defaultChannelId) ids.add(config.defaultChannelId);
  for (const entry of Object.values(config.categories)) {
    if (entry.channelId) ids.add(entry.channelId);
  }
  return ids;
}

const warned = new Map<string, number>();

/** Schickt eine Log-Meldung in den Kanal der Kategorie. Pingt niemanden an. */
export async function sendLog(
  bot: BotContext,
  guild: Guild,
  category: LogCategory,
  payload: { embeds: APIEmbed[]; files?: AttachmentBuilder[] },
  config?: LoggingConfig,
): Promise<void> {
  const cfg = config ?? (await loggingConfig(bot, guild.id));
  const channelId = logTarget(cfg, category);
  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId);
  const me = guild.members.me;
  const canSend =
    channel?.isTextBased() &&
    me &&
    channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]);

  if (!channel || !channel.isTextBased() || !canSend) {
    // Höchstens alle 10 Minuten pro Kanal warnen
    const key = `${guild.id}:${channelId}`;
    if ((warned.get(key) ?? 0) < Date.now() - 10 * 60_000) {
      warned.set(key, Date.now());
      bot.logger.warn({ guildId: guild.id, channelId, category }, 'Log-Kanal fehlt oder Bot darf dort nicht schreiben');
    }
    return;
  }

  await channel.send({ embeds: payload.embeds, files: payload.files, allowedMentions: { parse: [] } });
}

export interface AuditHit {
  executor: LogUserRef | null;
  reason: string | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sucht im Audit-Log, wer eine Aktion ausgelöst hat. Discord schreibt den Eintrag oft
 * kurz nach dem Event – deshalb kurz warten. Liefert null ohne Recht „Audit-Log anzeigen“.
 */
export async function findAudit(guild: Guild, type: AuditLogEvent, targetId: string, maxAgeMs = 15_000): Promise<AuditHit | null> {
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) return null;
  await sleep(1200);
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 6 });
    const entry = logs.entries.find(
      (e) => (e.targetId ?? (e.target as { id?: string } | null)?.id) === targetId && Date.now() - e.createdTimestamp < maxAgeMs,
    );
    if (!entry) return null;
    return { executor: entry.executor ? userRef(entry.executor as User) : null, reason: entry.reason ?? null };
  } catch {
    return null;
  }
}

export { AuditLogEvent };
