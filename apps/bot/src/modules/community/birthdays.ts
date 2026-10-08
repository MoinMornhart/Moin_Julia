import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { berlinParts, daysUntilBirthday, fillBirthdayText, isBirthdayToday, t, validBirthday } from '@moin/shared';
import type { BotContext, CommandContext, SlashCommand } from '../../core/types.js';
import { communityConfig, d } from './shared.js';

const dateText = (day: number, month: number, year: number | null) => `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year ?? ''}`.replace(/\.$/, '.');

export const birthdayCommand: SlashCommand = {
  data: (() => {
    const root = d('community.cmd.birthday');
    const set = d('community.cmd.birthdaySet');
    const show = d('community.cmd.birthdayShow');
    const remove = d('community.cmd.birthdayRemove');
    const day = d('community.cmd.day');
    const month = d('community.cmd.month');
    const year = d('community.cmd.year');
    const member = d('community.cmd.member');
    return new SlashCommandBuilder()
      .setName('geburtstag')
      .setNameLocalizations({ 'en-US': 'birthday', 'en-GB': 'birthday' })
      .setDescription(root.de)
      .setDescriptionLocalizations(root.loc)
      .setContexts(InteractionContextType.Guild)
      .addSubcommand((s) =>
        s
          .setName('setzen')
          .setNameLocalizations({ 'en-US': 'set', 'en-GB': 'set' })
          .setDescription(set.de)
          .setDescriptionLocalizations(set.loc)
          .addIntegerOption((o) => o.setName('tag').setNameLocalizations({ 'en-US': 'day', 'en-GB': 'day' }).setDescription(day.de).setDescriptionLocalizations(day.loc).setMinValue(1).setMaxValue(31).setRequired(true))
          .addIntegerOption((o) => o.setName('monat').setNameLocalizations({ 'en-US': 'month', 'en-GB': 'month' }).setDescription(month.de).setDescriptionLocalizations(month.loc).setMinValue(1).setMaxValue(12).setRequired(true))
          .addIntegerOption((o) => o.setName('jahr').setNameLocalizations({ 'en-US': 'year', 'en-GB': 'year' }).setDescription(year.de).setDescriptionLocalizations(year.loc).setMinValue(1900).setMaxValue(2100)),
      )
      .addSubcommand((s) =>
        s
          .setName('anzeigen')
          .setNameLocalizations({ 'en-US': 'show', 'en-GB': 'show' })
          .setDescription(show.de)
          .setDescriptionLocalizations(show.loc)
          .addUserOption((o) => o.setName('mitglied').setNameLocalizations({ 'en-US': 'member', 'en-GB': 'member' }).setDescription(member.de).setDescriptionLocalizations(member.loc)),
      )
      .addSubcommand((s) => s.setName('entfernen').setNameLocalizations({ 'en-US': 'remove', 'en-GB': 'remove' }).setDescription(remove.de).setDescriptionLocalizations(remove.loc))
      .toJSON();
  })(),
  async execute({ interaction, locale, bot }: CommandContext) {
    if (!interaction.inCachedGuild()) return;
    const config = await communityConfig(bot, interaction.guildId);
    if (!config.birthdays.enabled) return void (await interaction.reply({ content: t(locale, 'community.birthday.disabled'), flags: MessageFlags.Ephemeral }));
    const sub = interaction.options.getSubcommand();
    const where = (userId: string) => ({ guildId_userId: { guildId: interaction.guildId, userId } });

    if (sub === 'setzen') {
      const day = interaction.options.getInteger('tag', true);
      const month = interaction.options.getInteger('monat', true);
      const year = interaction.options.getInteger('jahr');
      if (!validBirthday(day, month, year)) return void (await interaction.reply({ content: t(locale, 'community.birthday.invalid'), flags: MessageFlags.Ephemeral }));
      const data = { day, month, year, userTag: interaction.user.username };
      await bot.prisma.birthday.upsert({ where: where(interaction.user.id), create: { guildId: interaction.guildId, userId: interaction.user.id, ...data }, update: data });
      return void (await interaction.reply({ content: t(locale, 'community.birthday.saved', { date: dateText(day, month, year) }), flags: MessageFlags.Ephemeral }));
    }
    if (sub === 'entfernen') {
      await bot.prisma.birthday.deleteMany({ where: { guildId: interaction.guildId, userId: interaction.user.id } });
      return void (await interaction.reply({ content: t(locale, 'community.birthday.removed'), flags: MessageFlags.Ephemeral }));
    }
    const user = interaction.options.getUser('mitglied') ?? interaction.user;
    const b = await bot.prisma.birthday.findUnique({ where: where(user.id) });
    if (!b) return void (await interaction.reply({ content: t(locale, 'community.birthday.none', { user: `**${user.displayName}**` }), flags: MessageFlags.Ephemeral }));
    const days = daysUntilBirthday(b, berlinParts(new Date()));
    // Fremde Geburtsjahre nicht verraten – nur Tag und Monat
    const shownYear = user.id === interaction.user.id ? b.year : null;
    await interaction.reply({
      content: t(locale, 'community.birthday.show', {
        user: `**${user.displayName}**`,
        date: dateText(b.day, b.month, shownYear),
        days: days === 0 ? t(locale, 'community.birthday.today') : t(locale, 'community.birthday.inDays', { days: String(days) }),
      }),
      flags: MessageFlags.Ephemeral,
    });
  },
};

/** Stündlich: zur eingestellten Stunde gratulieren, Geburtstagsrolle geben und am Folgetag wieder nehmen */
export async function birthdayRound(bot: BotContext, now = new Date()): Promise<number> {
  const today = berlinParts(now);
  let wished = 0;
  for (const guild of bot.client.guilds.cache.values()) {
    if (!(await bot.modules.isEnabled(guild.id, 'community'))) continue;
    const config = await communityConfig(bot, guild.id);
    const cfg = config.birthdays;
    if (!cfg.enabled) continue;
    const role = cfg.roleId ? guild.roles.cache.get(cfg.roleId) : undefined;

    // Rolle vom Vortag entfernen
    if (role) {
      const stale = await bot.prisma.birthday.findMany({ where: { guildId: guild.id, roleGivenAt: { not: null } } });
      for (const b of stale) {
        if (isBirthdayToday(b, today)) continue;
        const member = await guild.members.fetch(b.userId).catch(() => null);
        if (member?.roles.cache.has(role.id)) await member.roles.remove(role, 'Geburtstag vorbei').catch(() => undefined);
        await bot.prisma.birthday.update({ where: { id: b.id }, data: { roleGivenAt: null } });
      }
    }

    if (today.hour < cfg.hour) continue;
    const candidates = await bot.prisma.birthday.findMany({ where: { guildId: guild.id, OR: [{ lastWishedYear: null }, { lastWishedYear: { lt: today.year } }] } });
    const channel = cfg.channelId ? guild.channels.cache.get(cfg.channelId) : undefined;
    for (const b of candidates) {
      if (!isBirthdayToday(b, today)) continue;
      const member = await guild.members.fetch(b.userId).catch(() => null);
      await bot.prisma.birthday.update({ where: { id: b.id }, data: { lastWishedYear: today.year, ...(role && member ? { roleGivenAt: now } : {}) } });
      if (!member) continue; // nicht mehr auf dem Server
      if (role && role.editable) await member.roles.add(role, 'Geburtstag').catch(() => undefined);
      if (channel?.isSendable()) {
        const age = b.year ? today.year - b.year : null;
        await channel
          .send({ content: fillBirthdayText(cfg.text, { user: `<@${member.id}>`, name: member.displayName, age, server: guild.name }), allowedMentions: { users: [member.id] } })
          .catch(() => undefined);
      }
      wished++;
    }
  }
  return wished;
}
