import { PermissionFlagsBits, type Guild, type GuildMember, type User } from 'discord.js';
import { escalationFor, formatDuration, t, type Locale, type TranslationKey } from '@moin/shared';
import type { ModCase } from '@moin/db';
import type { BotContext } from '../../core/types.js';
import { activeWarnCount, createCase, moderationConfig, postModLog, type Party } from './cases.js';
import { dmText, hierarchyProblem, type CaseType } from './logic.js';

/** Fehler, deren Text dem Moderator direkt angezeigt werden kann */
export class ModerationError extends Error {
  constructor(
    readonly key: TranslationKey,
    readonly vars: Record<string, string | number> = {},
  ) {
    super(key);
  }
}

export function party(user: User): Party {
  return { id: user.id, tag: user.tag };
}

const PERMISSION_NAMES: Record<string, Record<Locale, string>> = {
  ModerateMembers: { de: 'Mitglieder im Timeout', en: 'Timeout Members' },
  KickMembers: { de: 'Mitglieder kicken', en: 'Kick Members' },
  BanMembers: { de: 'Mitglieder bannen', en: 'Ban Members' },
};

async function requireBotPermission(guild: Guild, locale: Locale, permission: 'ModerateMembers' | 'KickMembers' | 'BanMembers') {
  if (!guild.members.me?.permissions.has(PermissionFlagsBits[permission])) {
    throw new ModerationError('mod.err.botPermission', { permission: PERMISSION_NAMES[permission]![locale] });
  }
}

/** Darf `moderator` das Mitglied `target` moderieren? (Rollen-Hierarchie, Owner, Bot, sich selbst) */
export function assertHierarchy(guild: Guild, moderator: GuildMember | null, targetId: string, target: GuildMember | null) {
  const me = guild.members.me!;
  const problem = hierarchyProblem({
    moderatorId: moderator?.id ?? me.id,
    targetId,
    ownerId: guild.ownerId,
    botId: me.id,
    moderatorTop: moderator ? moderator.roles.highest.position : me.roles.highest.position,
    targetTop: target ? target.roles.highest.position : null,
    botTop: me.roles.highest.position,
  });
  // Bot-eigene Aktionen (Automod/Eskalation, moderator = null) prüfen gegen die Bot-Rolle
  if (problem) throw new ModerationError(problem, { user: target?.user.tag ?? targetId });
}

async function sendDm(user: User, text: string): Promise<boolean> {
  try {
    await user.send({ content: text, allowedMentions: { parse: [] } });
    return true;
  } catch {
    return false;
  }
}

export interface ActionResult {
  modCase: ModCase;
  dmSent: boolean | null;
  escalation: { modCase: ModCase; action: string; count: number } | null;
  warnCount?: number;
}

export interface ActionInput {
  guild: Guild;
  type: Exclude<CaseType, 'UNBAN' | 'UNTIMEOUT'> | 'UNBAN' | 'UNTIMEOUT';
  targetUser: User;
  targetMember: GuildMember | null;
  /** null = der Bot selbst (Automod, Eskalation) */
  moderator: GuildMember | null;
  reason: string | null;
  durationMs?: number;
  deleteMessageSeconds?: number;
  source?: 'command' | 'automod' | 'escalation';
}

/**
 * Führt eine Moderations-Aktion aus: Prüfungen → (DM vor Kick/Bann) → Discord-Aktion → Fall → Mod-Log → (DM) → Eskalation.
 */
export async function moderate(bot: BotContext, input: ActionInput): Promise<ActionResult> {
  const { guild, type, targetUser, targetMember } = input;
  const locale = await bot.modules.locale(guild.id);
  const config = await moderationConfig(bot, guild.id);
  const me = guild.members.me!;
  const moderatorParty = input.moderator ? party(input.moderator.user) : party(me.user);
  const reason = input.reason?.trim() || null;
  const auditReason = `${moderatorParty.tag}: ${reason ?? t(locale, 'mod.case.noReason')}`.slice(0, 500);

  if (!reason && config.requireReason && (input.source ?? 'command') === 'command') throw new ModerationError('mod.err.reasonRequired');
  if (type !== 'UNBAN') assertHierarchy(guild, input.moderator, targetUser.id, targetMember);

  let dmSent: boolean | null = null;
  const dm = (kind: 'WARN' | 'TIMEOUT' | 'KICK' | 'BAN') =>
    config.dmUsers ? sendDm(targetUser, dmText(locale, kind, guild.name, reason, input.durationMs)) : Promise.resolve(null);

  switch (type) {
    case 'WARN':
      if (!targetMember) throw new ModerationError('mod.err.notMember');
      break;
    case 'TIMEOUT':
      await requireBotPermission(guild, locale, 'ModerateMembers');
      if (!targetMember) throw new ModerationError('mod.err.notMember');
      await targetMember.timeout(input.durationMs!, auditReason);
      break;
    case 'UNTIMEOUT':
      await requireBotPermission(guild, locale, 'ModerateMembers');
      if (!targetMember) throw new ModerationError('mod.err.notMember');
      if (!targetMember.isCommunicationDisabled()) throw new ModerationError('mod.err.notTimedOut', { user: targetUser.tag });
      await targetMember.timeout(null, auditReason);
      break;
    case 'KICK':
      await requireBotPermission(guild, locale, 'KickMembers');
      if (!targetMember) throw new ModerationError('mod.err.notMember');
      dmSent = await dm('KICK');
      await targetMember.kick(auditReason);
      break;
    case 'BAN':
      await requireBotPermission(guild, locale, 'BanMembers');
      if (targetMember) dmSent = await dm('BAN');
      await guild.members.ban(targetUser.id, { reason: auditReason, deleteMessageSeconds: input.deleteMessageSeconds ?? 0 });
      break;
    case 'UNBAN':
      await requireBotPermission(guild, locale, 'BanMembers');
      try {
        await guild.members.unban(targetUser.id, auditReason);
      } catch {
        throw new ModerationError('mod.err.notBanned');
      }
      break;
  }

  const modCase = await createCase(bot, {
    guildId: guild.id,
    type,
    user: party(targetUser),
    moderator: moderatorParty,
    reason,
    durationSec: input.durationMs ? Math.round(input.durationMs / 1000) : null,
    source: input.source ?? 'command',
  });
  await postModLog(bot, guild, modCase, config).catch((error: unknown) => bot.logger.warn({ err: error }, 'Mod-Log fehlgeschlagen'));

  if (type === 'WARN' || type === 'TIMEOUT') dmSent = await dm(type);

  let escalation: ActionResult['escalation'] = null;
  let warnCount: number | undefined;
  if (type === 'WARN') {
    warnCount = await activeWarnCount(bot, guild.id, targetUser.id, config.warnExpiryDays);
    const step = escalationFor(config.escalation, warnCount);
    if (step) {
      const escalated = await moderate(bot, {
        guild,
        type: step.action === 'timeout' ? 'TIMEOUT' : step.action === 'kick' ? 'KICK' : 'BAN',
        targetUser,
        targetMember: await guild.members.fetch(targetUser.id).catch(() => null),
        moderator: null,
        reason: `${t(locale, 'mod.case.source.escalation')}: ${warnCount} × ${t(locale, 'mod.type.WARN')}`,
        durationMs: step.action === 'timeout' ? (step.durationMin ?? 60) * 60_000 : undefined,
        source: 'escalation',
      }).catch((error: unknown) => {
        bot.logger.warn({ err: error, guildId: guild.id }, 'Eskalation fehlgeschlagen');
        return null;
      });
      if (escalated) {
        const label =
          step.action === 'timeout' ? `${t(locale, 'mod.type.TIMEOUT')} ${formatDuration((step.durationMin ?? 60) * 60_000, locale)}` : t(locale, step.action === 'kick' ? 'mod.type.KICK' : 'mod.type.BAN');
        escalation = { modCase: escalated.modCase, action: label, count: warnCount };
      }
    }
  }

  return { modCase, dmSent, escalation, warnCount };
}
