import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type SlashCommandStringOption,
  type SlashCommandUserOption,
} from 'discord.js';
import { MAX_TIMEOUT_MS, formatDuration, parseDuration, t, type Locale, type TranslationKey } from '@moin/shared';
import type { CommandContext, SlashCommand } from '../../core/types.js';
import { activeWarnCount, moderationConfig, refreshModLog, toCaseData } from './cases.js';
import { ModerationError, moderate, type ActionResult } from './actions.js';
import { caseEmbed, warnsEmbed } from './logic.js';

/** Beschreibung auf Deutsch + englische Übersetzung für Discord */
function d(key: TranslationKey) {
  return { de: t('de', key), loc: { 'en-US': t('en', key), 'en-GB': t('en', key) } };
}

function userOption(required = true) {
  const x = d('mod.opt.user');
  return (o: SlashCommandUserOption) => o.setName('user').setDescription(x.de).setDescriptionLocalizations(x.loc).setRequired(required);
}
function reasonOption(required = false) {
  const x = d('mod.opt.reason');
  return (o: SlashCommandStringOption) => o.setName('reason').setDescription(x.de).setDescriptionLocalizations(x.loc).setMaxLength(500).setRequired(required);
}

function base(name: string, key: TranslationKey, permission: bigint) {
  const x = d(key);
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription(x.de)
    .setDescriptionLocalizations(x.loc)
    .setDefaultMemberPermissions(permission)
    .setContexts(InteractionContextType.Guild);
}

function resultText(locale: Locale, key: TranslationKey, r: ActionResult, vars: Record<string, string | number>): string {
  const lines = [t(locale, key, { ...vars, case: r.modCase.number, count: r.warnCount ?? 0 })];
  if (r.escalation) lines.push(t(locale, 'mod.done.escalation', { count: r.escalation.count, action: r.escalation.action, case: r.escalation.modCase.number }));
  if (r.dmSent === false) lines.push(t(locale, 'mod.done.dmFailed'));
  return lines.join('\n');
}

/** Gemeinsamer Ablauf: ephemer antworten, ModerationError verständlich anzeigen. */
async function run(ctx: CommandContext, action: (i: ChatInputCommandInteraction<'cached'>) => Promise<string | { embeds: unknown[] }>) {
  const interaction = ctx.interaction;
  if (!interaction.inCachedGuild()) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const result = await action(interaction);
    await interaction.editReply(typeof result === 'string' ? { content: result, allowedMentions: { parse: [] } } : (result as never));
  } catch (error) {
    if (error instanceof ModerationError) {
      await interaction.editReply({ content: `❌ ${t(ctx.locale, error.key, error.vars)}`, allowedMentions: { parse: [] } });
      return;
    }
    throw error;
  }
}

async function target(i: ChatInputCommandInteraction<'cached'>) {
  const user = i.options.getUser('user', true);
  const member = await i.guild.members.fetch(user.id).catch(() => null);
  return { user, member };
}

const warn: SlashCommand = {
  data: base('warn', 'mod.cmd.warn', PermissionFlagsBits.ModerateMembers).addUserOption(userOption()).addStringOption(reasonOption()).toJSON(),
  execute: (ctx) =>
    run(ctx, async (i) => {
      const { user, member } = await target(i);
      const r = await moderate(ctx.bot, { guild: i.guild, type: 'WARN', targetUser: user, targetMember: member, moderator: i.member, reason: i.options.getString('reason') });
      return resultText(ctx.locale, 'mod.done.warn', r, { user: user.tag });
    }),
};

const timeout: SlashCommand = {
  data: base('timeout', 'mod.cmd.timeout', PermissionFlagsBits.ModerateMembers)
    .addUserOption(userOption())
    .addStringOption((o) => {
      const x = d('mod.opt.duration');
      return o.setName('duration').setDescription(x.de).setDescriptionLocalizations(x.loc).setRequired(true).setMaxLength(20);
    })
    .addStringOption(reasonOption())
    .toJSON(),
  execute: (ctx) =>
    run(ctx, async (i) => {
      const ms = parseDuration(i.options.getString('duration', true));
      if (!ms || ms > MAX_TIMEOUT_MS) throw new ModerationError('mod.err.duration');
      const { user, member } = await target(i);
      const r = await moderate(ctx.bot, { guild: i.guild, type: 'TIMEOUT', targetUser: user, targetMember: member, moderator: i.member, reason: i.options.getString('reason'), durationMs: ms });
      return resultText(ctx.locale, 'mod.done.timeout', r, { user: user.tag, duration: formatDuration(ms, ctx.locale) });
    }),
};

const untimeout: SlashCommand = {
  data: base('untimeout', 'mod.cmd.untimeout', PermissionFlagsBits.ModerateMembers).addUserOption(userOption()).addStringOption(reasonOption()).toJSON(),
  execute: (ctx) =>
    run(ctx, async (i) => {
      const { user, member } = await target(i);
      const r = await moderate(ctx.bot, { guild: i.guild, type: 'UNTIMEOUT', targetUser: user, targetMember: member, moderator: i.member, reason: i.options.getString('reason') });
      return resultText(ctx.locale, 'mod.done.untimeout', r, { user: user.tag });
    }),
};

const kick: SlashCommand = {
  data: base('kick', 'mod.cmd.kick', PermissionFlagsBits.KickMembers).addUserOption(userOption()).addStringOption(reasonOption()).toJSON(),
  execute: (ctx) =>
    run(ctx, async (i) => {
      const { user, member } = await target(i);
      const r = await moderate(ctx.bot, { guild: i.guild, type: 'KICK', targetUser: user, targetMember: member, moderator: i.member, reason: i.options.getString('reason') });
      return resultText(ctx.locale, 'mod.done.kick', r, { user: user.tag });
    }),
};

const ban: SlashCommand = {
  data: base('ban', 'mod.cmd.ban', PermissionFlagsBits.BanMembers)
      .addUserOption(userOption(false))
      .addStringOption((o) => {
        const x = d('mod.opt.userId');
        return o.setName('user_id').setDescription(x.de).setDescriptionLocalizations(x.loc).setMinLength(15).setMaxLength(22);
      })
      .addIntegerOption((o) => {
        const x = d('mod.opt.deleteMessages');
        const c = (key: TranslationKey, value: number) => ({ name: t('de', key), name_localizations: { 'en-US': t('en', key), 'en-GB': t('en', key) }, value });
        return o
          .setName('delete_messages')
          .setDescription(x.de)
          .setDescriptionLocalizations(x.loc)
          .addChoices(c('mod.choice.none', 0), c('mod.choice.hour', 3600), c('mod.choice.day', 86400), c('mod.choice.week', 604800));
      })
      .addStringOption(reasonOption())
      .toJSON(),
  execute: (ctx) =>
    run(ctx, async (i) => {
      const id = i.options.getUser('user')?.id ?? i.options.getString('user_id')?.trim();
      if (!id || !/^\d{15,22}$/.test(id)) throw new ModerationError('mod.err.userRequired');
      const user = await i.client.users.fetch(id).catch(() => null);
      if (!user) throw new ModerationError('mod.err.userRequired');
      const member = await i.guild.members.fetch(id).catch(() => null);
      const r = await moderate(ctx.bot, {
        guild: i.guild, type: 'BAN', targetUser: user, targetMember: member, moderator: i.member,
        reason: i.options.getString('reason'), deleteMessageSeconds: i.options.getInteger('delete_messages') ?? 0,
      });
      return resultText(ctx.locale, 'mod.done.ban', r, { user: user.tag });
    }),
};

const unban: SlashCommand = {
  data: base('unban', 'mod.cmd.unban', PermissionFlagsBits.BanMembers)
    .addStringOption((o) => {
      const x = d('mod.opt.userId');
      return o.setName('user_id').setDescription(x.de).setDescriptionLocalizations(x.loc).setRequired(true).setMinLength(15).setMaxLength(22);
    })
    .addStringOption(reasonOption())
    .toJSON(),
  execute: (ctx) =>
    run(ctx, async (i) => {
      const id = i.options.getString('user_id', true).trim();
      const user = /^\d{15,22}$/.test(id) ? await i.client.users.fetch(id).catch(() => null) : null;
      if (!user) throw new ModerationError('mod.err.notBanned');
      const r = await moderate(ctx.bot, { guild: i.guild, type: 'UNBAN', targetUser: user, targetMember: null, moderator: i.member, reason: i.options.getString('reason') });
      return resultText(ctx.locale, 'mod.done.unban', r, { user: user.tag });
    }),
};

const warns: SlashCommand = {
  data: base('warns', 'mod.cmd.warns', PermissionFlagsBits.ModerateMembers).addUserOption(userOption()).toJSON(),
  execute: (ctx) =>
    run(ctx, async (i) => {
      const user = i.options.getUser('user', true);
      const config = await moderationConfig(ctx.bot, i.guild.id);
      const list = await ctx.bot.prisma.modCase.findMany({
        where: { guildId: i.guild.id, userId: user.id, type: 'WARN' },
        orderBy: { createdAt: 'desc' },
        take: 25,
      });
      const active = await activeWarnCount(ctx.bot, i.guild.id, user.id, config.warnExpiryDays);
      return { embeds: [warnsEmbed(ctx.locale, user.tag, list.map(toCaseData), active)] };
    }),
};

const numberOption = d('mod.opt.number');
const caseCommand: SlashCommand = {
  data: base('case', 'mod.cmd.case', PermissionFlagsBits.ModerateMembers)
    .addSubcommand((s) => {
      const x = d('mod.cmd.caseShow');
      return s.setName('show').setDescription(x.de).setDescriptionLocalizations(x.loc)
        .addIntegerOption((o) => o.setName('number').setDescription(numberOption.de).setDescriptionLocalizations(numberOption.loc).setRequired(true).setMinValue(1));
    })
    .addSubcommand((s) => {
      const x = d('mod.cmd.caseReason');
      const r = d('mod.opt.reason');
      return s.setName('reason').setDescription(x.de).setDescriptionLocalizations(x.loc)
        .addIntegerOption((o) => o.setName('number').setDescription(numberOption.de).setDescriptionLocalizations(numberOption.loc).setRequired(true).setMinValue(1))
        .addStringOption((o) => o.setName('reason').setDescription(r.de).setDescriptionLocalizations(r.loc).setRequired(true).setMaxLength(500));
    })
    .addSubcommand((s) => {
      const x = d('mod.cmd.casePardon');
      return s.setName('pardon').setDescription(x.de).setDescriptionLocalizations(x.loc)
        .addIntegerOption((o) => o.setName('number').setDescription(numberOption.de).setDescriptionLocalizations(numberOption.loc).setRequired(true).setMinValue(1));
    })
    .toJSON(),
  execute: (ctx) =>
    run(ctx, async (i) => {
      const number = i.options.getInteger('number', true);
      const where = { guildId_number: { guildId: i.guild.id, number } };
      const found = await ctx.bot.prisma.modCase.findUnique({ where });
      if (!found) throw new ModerationError('mod.err.caseNotFound', { case: number });
      switch (i.options.getSubcommand()) {
        case 'reason': {
          const updated = await ctx.bot.prisma.modCase.update({ where, data: { reason: i.options.getString('reason', true) } });
          await refreshModLog(ctx.bot, i.guild, updated);
          return t(ctx.locale, 'mod.done.reason', { case: number });
        }
        case 'pardon': {
          if (found.type !== 'WARN') throw new ModerationError('mod.err.notWarn', { case: number });
          const updated = await ctx.bot.prisma.modCase.update({ where, data: { active: false } });
          await refreshModLog(ctx.bot, i.guild, updated);
          return t(ctx.locale, 'mod.done.pardon', { case: number });
        }
        default:
          return { embeds: [caseEmbed(ctx.locale, toCaseData(found))] };
      }
    }),
};

const clear: SlashCommand = {
  data: base('clear', 'mod.cmd.clear', PermissionFlagsBits.ManageMessages)
    .addIntegerOption((o) => {
      const x = d('mod.opt.amount');
      return o.setName('amount').setDescription(x.de).setDescriptionLocalizations(x.loc).setRequired(true).setMinValue(1).setMaxValue(100);
    })
    .addUserOption((o) => {
      const x = d('mod.opt.onlyUser');
      return o.setName('user').setDescription(x.de).setDescriptionLocalizations(x.loc);
    })
    .toJSON(),
  execute: (ctx) =>
    run(ctx, async (i) => {
      const channel = i.channel;
      if (!channel || !('bulkDelete' in channel)) throw new ModerationError('common.guildOnly');
      if (!i.guild.members.me?.permissionsIn(channel).has(PermissionFlagsBits.ManageMessages)) {
        throw new ModerationError('mod.err.botPermission', { permission: ctx.locale === 'de' ? 'Nachrichten verwalten' : 'Manage Messages' });
      }
      const amount = i.options.getInteger('amount', true);
      const only = i.options.getUser('user');
      const recent = await channel.messages.fetch({ limit: 100 });
      const toDelete = [...recent.values()].filter((m) => !only || m.author.id === only.id).slice(0, amount);
      const deleted = await channel.bulkDelete(toDelete, true);
      return t(ctx.locale, 'mod.done.clear', { count: deleted.size });
    }),
};

export const moderationCommands: SlashCommand[] = [warn, timeout, untimeout, kick, ban, unban, warns, caseCommand, clear];
