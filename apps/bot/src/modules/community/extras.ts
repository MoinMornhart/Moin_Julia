import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { MAX_REMINDER_MS, MAX_REMINDERS_PER_USER, parseDuration, t } from '@moin/shared';
import type { BotContext, CommandContext, SlashCommand } from '../../core/types.js';
import { communityConfig, d, discordTime, isManager } from './shared.js';

/** Umfrage: Discords eigene Umfrage (Poll) – Ergebnisse zählt Discord selbst */
export function parsePollOptions(raw: string): string[] | null {
  const options = raw
    .split(';')
    .map((o) => o.trim())
    .filter(Boolean)
    .map((o) => o.slice(0, 55));
  const unique = [...new Set(options)];
  return unique.length >= 2 && unique.length <= 10 ? unique : null;
}

export const pollCommand: SlashCommand = {
  data: (() => {
    const desc = d('community.cmd.poll');
    const q = d('community.cmd.question');
    const opts = d('community.cmd.options');
    const hours = d('community.cmd.hours');
    const multi = d('community.cmd.multi');
    return new SlashCommandBuilder()
      .setName('umfrage')
      .setNameLocalizations({ 'en-US': 'poll', 'en-GB': 'poll' })
      .setDescription(desc.de)
      .setDescriptionLocalizations(desc.loc)
      .setContexts(InteractionContextType.Guild)
      .addStringOption((o) => o.setName('frage').setNameLocalizations({ 'en-US': 'question', 'en-GB': 'question' }).setDescription(q.de).setDescriptionLocalizations(q.loc).setRequired(true).setMaxLength(300))
      .addStringOption((o) => o.setName('antworten').setNameLocalizations({ 'en-US': 'answers', 'en-GB': 'answers' }).setDescription(opts.de).setDescriptionLocalizations(opts.loc).setRequired(true).setMaxLength(600))
      .addIntegerOption((o) => o.setName('stunden').setNameLocalizations({ 'en-US': 'hours', 'en-GB': 'hours' }).setDescription(hours.de).setDescriptionLocalizations(hours.loc).setMinValue(1).setMaxValue(768))
      .addBooleanOption((o) => o.setName('mehrfach').setNameLocalizations({ 'en-US': 'multiple', 'en-GB': 'multiple' }).setDescription(multi.de).setDescriptionLocalizations(multi.loc))
      .toJSON();
  })(),
  async execute({ interaction, locale, bot }: CommandContext) {
    if (!interaction.inCachedGuild()) return;
    const config = await communityConfig(bot, interaction.guildId);
    if (!isManager(interaction.member, config)) return void (await interaction.reply({ content: t(locale, 'community.noPermission'), flags: MessageFlags.Ephemeral }));
    const options = parsePollOptions(interaction.options.getString('antworten', true));
    if (!options) return void (await interaction.reply({ content: t(locale, 'community.poll.badOptions'), flags: MessageFlags.Ephemeral }));
    await interaction.reply({
      poll: {
        question: { text: interaction.options.getString('frage', true) },
        answers: options.map((text) => ({ text })),
        duration: interaction.options.getInteger('stunden') ?? 24,
        allowMultiselect: interaction.options.getBoolean('mehrfach') ?? false,
      },
    });
  },
};

export const remindCommand: SlashCommand = {
  data: (() => {
    const desc = d('community.cmd.remind');
    const when = d('community.cmd.when');
    const what = d('community.cmd.what');
    return new SlashCommandBuilder()
      .setName('erinnerung')
      .setNameLocalizations({ 'en-US': 'remind', 'en-GB': 'remind' })
      .setDescription(desc.de)
      .setDescriptionLocalizations(desc.loc)
      .setContexts(InteractionContextType.Guild)
      .addStringOption((o) => o.setName('wann').setNameLocalizations({ 'en-US': 'when', 'en-GB': 'when' }).setDescription(when.de).setDescriptionLocalizations(when.loc).setRequired(true).setMaxLength(20))
      .addStringOption((o) => o.setName('text').setDescription(what.de).setDescriptionLocalizations(what.loc).setRequired(true).setMaxLength(1000))
      .toJSON();
  })(),
  async execute({ interaction, locale, bot }: CommandContext) {
    const ms = parseDuration(interaction.options.getString('wann', true));
    if (!ms || ms > MAX_REMINDER_MS) return void (await interaction.reply({ content: t(locale, 'community.remind.bad'), flags: MessageFlags.Ephemeral }));
    const open = await bot.prisma.reminder.count({ where: { userId: interaction.user.id, done: false } });
    if (open >= MAX_REMINDERS_PER_USER) return void (await interaction.reply({ content: t(locale, 'community.remind.tooMany', { max: String(MAX_REMINDERS_PER_USER) }), flags: MessageFlags.Ephemeral }));
    const dueAt = new Date(Date.now() + ms);
    await bot.prisma.reminder.create({ data: { userId: interaction.user.id, guildId: interaction.guildId, text: interaction.options.getString('text', true), dueAt } });
    await interaction.reply({ content: t(locale, 'community.remind.saved', { when: discordTime(dueAt) }), flags: MessageFlags.Ephemeral });
  },
};

/** Fällige Erinnerungen per DM verschicken */
export async function reminderRound(bot: BotContext): Promise<number> {
  const due = await bot.prisma.reminder.findMany({ where: { done: false, dueAt: { lte: new Date() } }, take: 100, orderBy: { dueAt: 'asc' } });
  for (const r of due) {
    const { count } = await bot.prisma.reminder.updateMany({ where: { id: r.id, done: false }, data: { done: true } });
    if (!count) continue;
    const locale = await bot.modules.locale(r.guildId);
    const user = await bot.client.users.fetch(r.userId).catch(() => null);
    await user?.send({ content: t(locale, 'community.remind.dm', { when: discordTime(r.createdAt), text: r.text }), allowedMentions: { parse: [] } }).catch(() => undefined);
  }
  return due.length;
}
