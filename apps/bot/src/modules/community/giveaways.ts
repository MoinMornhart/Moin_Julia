import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type Guild,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import type { Giveaway, Prisma } from '@moin/db';
import { parseDuration, pickWinners, t, type Locale } from '@moin/shared';
import type { BotContext, CommandContext, ComponentContext, SlashCommand } from '../../core/types.js';
import { communityConfig, d, discordTime, isManager } from './shared.js';

export const MAX_GIVEAWAY_MS = 30 * 86_400_000;

const ids = (value: Prisma.JsonValue): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);

export function giveawayMessage(g: Giveaway, locale: Locale) {
  const entrants = ids(g.entrants);
  const winners = ids(g.winnerIds);
  const embed = new EmbedBuilder()
    .setColor(g.ended ? 0x4f5660 : 0xff7a59)
    .setTitle(t(locale, 'community.giveaway.title', { prize: g.prize }).slice(0, 256))
    .setDescription(
      g.ended
        ? t(locale, 'community.giveaway.endedBody', {
            end: discordTime(g.endsAt),
            winners: winners.length ? winners.map((w) => `<@${w}>`).join(', ') : t(locale, 'community.giveaway.noWinner'),
            count: String(entrants.length),
          })
        : t(locale, 'community.giveaway.body', { end: discordTime(g.endsAt), winners: String(g.winnerCount), host: `<@${g.hostId}>` }),
    )
    .setFooter({ text: t(locale, 'community.giveaway.participants', { count: String(entrants.length) }) })
    .setTimestamp(g.endsAt);
  if (g.requiredRoleId && !g.ended) embed.addFields({ name: '​', value: t(locale, 'community.giveaway.requires', { role: `<@&${g.requiredRoleId}>` }) });
  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`community:enter:${g.id}`).setStyle(ButtonStyle.Primary).setEmoji('🎉').setLabel(t(locale, 'community.giveaway.join')).setDisabled(g.ended),
  );
  return { embeds: [embed], components: [row], allowedMentions: { parse: [] as const } };
}

/** Giveaway anlegen + posten (aus /giveaway start oder dem Dashboard) */
export async function startGiveaway(
  bot: BotContext,
  guild: Guild,
  input: { channelId: string; prize: string; durationMs: number; winnerCount: number; requiredRoleId: string | null; hostId: string },
): Promise<Giveaway | null> {
  const channel = guild.channels.cache.get(input.channelId);
  if (!channel?.isSendable()) return null;
  const locale = await bot.modules.locale(guild.id);
  const g = await bot.prisma.giveaway.create({
    data: {
      guildId: guild.id,
      channelId: input.channelId,
      prize: input.prize.slice(0, 200),
      winnerCount: Math.max(1, Math.min(20, input.winnerCount)),
      requiredRoleId: input.requiredRoleId,
      hostId: input.hostId,
      endsAt: new Date(Date.now() + input.durationMs),
    },
  });
  const message = await channel.send(giveawayMessage(g, locale)).catch(() => null);
  if (!message) {
    await bot.prisma.giveaway.delete({ where: { id: g.id } });
    return null;
  }
  return bot.prisma.giveaway.update({ where: { id: g.id }, data: { messageId: message.id } });
}

/** Beenden (oder neu auslosen): Gewinner ziehen, Nachricht aktualisieren, Glückwunsch posten */
export async function finishGiveaway(bot: BotContext, giveaway: Giveaway, reroll = false): Promise<Giveaway | null> {
  const guild = bot.client.guilds.cache.get(giveaway.guildId);
  if (!guild) return null;
  // Gegen doppeltes Beenden: nur wer den Zustand umschaltet, macht weiter
  if (!reroll) {
    const { count } = await bot.prisma.giveaway.updateMany({ where: { id: giveaway.id, ended: false }, data: { ended: true } });
    if (count === 0) return null;
  }
  const locale = await bot.modules.locale(guild.id);
  const previous = reroll ? ids(giveaway.winnerIds) : [];
  const pool = ids(giveaway.entrants).filter((id) => !previous.includes(id));
  const winners = pickWinners(pool, giveaway.winnerCount);
  const updated = await bot.prisma.giveaway.update({ where: { id: giveaway.id }, data: { ended: true, winnerIds: winners } });
  const channel = guild.channels.cache.get(giveaway.channelId);
  if (channel?.isTextBased()) {
    const message = giveaway.messageId ? await channel.messages.fetch(giveaway.messageId).catch(() => null) : null;
    await message?.edit(giveawayMessage(updated, locale)).catch(() => undefined);
    if (winners.length && channel.isSendable()) {
      await channel
        .send({
          content: t(locale, 'community.giveaway.congrats', { winners: winners.map((w) => `<@${w}>`).join(', '), prize: giveaway.prize }),
          allowedMentions: { users: winners },
          ...(message ? { reply: { messageReference: message.id, failIfNotExists: false } } : {}),
        })
        .catch(() => undefined);
    }
  }
  return updated;
}

export async function giveawayRound(bot: BotContext): Promise<number> {
  const due = await bot.prisma.giveaway.findMany({ where: { ended: false, endsAt: { lte: new Date() } }, take: 50 });
  let done = 0;
  for (const g of due) {
    if (!bot.client.guilds.cache.has(g.guildId)) continue;
    if (await finishGiveaway(bot, g)) done++;
  }
  return done;
}

export async function onEnter({ interaction, args, locale, bot }: ComponentContext): Promise<void> {
  if (!interaction.isButton()) return;
  const g = await bot.prisma.giveaway.findFirst({ where: { id: args[0] ?? '', guildId: interaction.guildId } });
  if (!g) return;
  if (g.ended || g.endsAt.getTime() <= Date.now()) return void (await interaction.reply({ content: t(locale, 'community.giveaway.ended'), flags: MessageFlags.Ephemeral }));
  if (g.requiredRoleId && !interaction.member.roles.cache.has(g.requiredRoleId)) {
    return void (await interaction.reply({ content: t(locale, 'community.giveaway.needRole', { role: `<@&${g.requiredRoleId}>` }), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }));
  }
  // Atomar umschalten (PostgreSQL: Array-Operationen auf JSONB), damit gleichzeitige Klicks nichts verlieren
  const userId = interaction.user.id;
  const joined = ids(g.entrants).includes(userId);
  const rows = joined
    ? await bot.prisma.$queryRaw<{ entrants: unknown }[]>`UPDATE "Giveaway" SET "entrants" = "entrants" - ${userId} WHERE "id" = ${g.id} RETURNING "entrants"`
    : await bot.prisma.$queryRaw<{ entrants: unknown }[]>`UPDATE "Giveaway" SET "entrants" = CASE WHEN "entrants" ? ${userId} THEN "entrants" ELSE "entrants" || to_jsonb(${userId}::text) END WHERE "id" = ${g.id} RETURNING "entrants"`;
  const entrants = Array.isArray(rows[0]?.entrants) ? (rows[0]!.entrants as string[]) : ids(g.entrants);
  await interaction.update(giveawayMessage({ ...g, entrants }, locale));
  await interaction.followUp({ content: t(locale, joined ? 'community.giveaway.left' : 'community.giveaway.joined'), flags: MessageFlags.Ephemeral });
}

export const giveawayCommand: SlashCommand = {
  data: (() => {
    const root = d('community.cmd.giveaway');
    const start = d('community.cmd.giveawayStart');
    const end = d('community.cmd.giveawayEnd');
    const reroll = d('community.cmd.giveawayReroll');
    const prize = d('community.cmd.prize');
    const duration = d('community.cmd.duration');
    const winners = d('community.cmd.winners');
    const role = d('community.cmd.role');
    const msg = d('community.cmd.messageId');
    return new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription(root.de)
      .setDescriptionLocalizations(root.loc)
      .setContexts(InteractionContextType.Guild)
      .addSubcommand((s) =>
        s
          .setName('start')
          .setDescription(start.de)
          .setDescriptionLocalizations(start.loc)
          .addStringOption((o) => o.setName('preis').setNameLocalizations({ 'en-US': 'prize', 'en-GB': 'prize' }).setDescription(prize.de).setDescriptionLocalizations(prize.loc).setRequired(true).setMaxLength(200))
          .addStringOption((o) => o.setName('dauer').setNameLocalizations({ 'en-US': 'duration', 'en-GB': 'duration' }).setDescription(duration.de).setDescriptionLocalizations(duration.loc).setRequired(true).setMaxLength(20))
          .addIntegerOption((o) => o.setName('gewinner').setNameLocalizations({ 'en-US': 'winners', 'en-GB': 'winners' }).setDescription(winners.de).setDescriptionLocalizations(winners.loc).setMinValue(1).setMaxValue(20))
          .addRoleOption((o) => o.setName('rolle').setNameLocalizations({ 'en-US': 'role', 'en-GB': 'role' }).setDescription(role.de).setDescriptionLocalizations(role.loc)),
      )
      .addSubcommand((s) =>
        s
          .setName('beenden')
          .setNameLocalizations({ 'en-US': 'end', 'en-GB': 'end' })
          .setDescription(end.de)
          .setDescriptionLocalizations(end.loc)
          .addStringOption((o) => o.setName('nachricht').setNameLocalizations({ 'en-US': 'message', 'en-GB': 'message' }).setDescription(msg.de).setDescriptionLocalizations(msg.loc).setRequired(true)),
      )
      .addSubcommand((s) =>
        s
          .setName('neu-auslosen')
          .setNameLocalizations({ 'en-US': 'reroll', 'en-GB': 'reroll' })
          .setDescription(reroll.de)
          .setDescriptionLocalizations(reroll.loc)
          .addStringOption((o) => o.setName('nachricht').setNameLocalizations({ 'en-US': 'message', 'en-GB': 'message' }).setDescription(msg.de).setDescriptionLocalizations(msg.loc).setRequired(true)),
      )
      .toJSON();
  })(),
  async execute({ interaction, locale, bot }: CommandContext) {
    if (!interaction.inCachedGuild()) return;
    const config = await communityConfig(bot, interaction.guildId);
    if (!isManager(interaction.member, config)) return void (await interaction.reply({ content: t(locale, 'community.noPermission'), flags: MessageFlags.Ephemeral }));
    const sub = interaction.options.getSubcommand();
    if (sub === 'start') {
      const ms = parseDuration(interaction.options.getString('dauer', true));
      if (!ms || ms > MAX_GIVEAWAY_MS) return void (await interaction.reply({ content: t(locale, 'community.giveaway.badDuration'), flags: MessageFlags.Ephemeral }));
      const ok = !!interaction.channel?.isSendable();
      // Nachricht senden + DB kann länger als Discords 3 Sekunden dauern
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const g = ok
        ? await startGiveaway(bot, interaction.guild, {
            channelId: interaction.channelId,
            prize: interaction.options.getString('preis', true),
            durationMs: ms,
            winnerCount: interaction.options.getInteger('gewinner') ?? 1,
            requiredRoleId: interaction.options.getRole('rolle')?.id ?? null,
            hostId: interaction.user.id,
          })
        : null;
      return void (await interaction.editReply({ content: g ? t(locale, 'community.giveaway.started') : t(locale, 'common.error') }));
    }
    const messageId = interaction.options.getString('nachricht', true).trim().split(/[/-]/).pop() ?? '';
    const g = await bot.prisma.giveaway.findFirst({ where: { guildId: interaction.guildId, OR: [{ messageId }, { id: messageId }] } });
    if (!g || (sub === 'beenden' && g.ended) || (sub !== 'beenden' && !g.ended)) {
      return void (await interaction.reply({ content: t(locale, 'community.giveaway.notFound'), flags: MessageFlags.Ephemeral }));
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await finishGiveaway(bot, g, sub !== 'beenden');
    await interaction.editReply({ content: t(locale, 'community.giveaway.done') });
  },
};
