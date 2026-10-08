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
import type { Prisma, Suggestion } from '@moin/db';
import { SUGGESTION_STATUS_LABELS, t, voteCounts, type Locale, type SuggestionStatus } from '@moin/shared';
import type { BotContext, CommandContext, ComponentContext, SlashCommand } from '../../core/types.js';
import { communityConfig, d } from './shared.js';

const STATUS_COLOR: Record<SuggestionStatus, number> = { open: 0x2f8bff, accepted: 0x2fd1b8, denied: 0xff5c6c, considered: 0xffc857 };
const STATUS_EN: Record<SuggestionStatus, string> = { open: 'Open', accepted: 'Accepted', denied: 'Denied', considered: 'Under consideration' };
const statusLabel = (status: SuggestionStatus, locale: Locale) => (locale === 'en' ? STATUS_EN[status] : SUGGESTION_STATUS_LABELS[status]);

export function suggestionMessage(s: Suggestion, locale: Locale, avatar: string | null) {
  const status = s.status as SuggestionStatus;
  const { up, down } = voteCounts((s.votes ?? {}) as Record<string, number>);
  const embed = new EmbedBuilder()
    .setColor(STATUS_COLOR[status] ?? STATUS_COLOR.open)
    .setAuthor({ name: s.userTag, ...(avatar ? { iconURL: avatar } : {}) })
    .setTitle(t(locale, 'community.suggest.title', { number: String(s.number) }))
    .setDescription(s.text.slice(0, 4000))
    .addFields({ name: t(locale, 'community.suggest.status'), value: statusLabel(status, locale), inline: true })
    .setTimestamp(s.createdAt);
  if (s.reason) embed.addFields({ name: t(locale, 'community.suggest.reason'), value: s.reason.slice(0, 1000) });
  const open = status === 'open' || status === 'considered';
  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`community:vote:${s.id}:up`).setStyle(ButtonStyle.Success).setEmoji('👍').setLabel(String(up)).setDisabled(!open),
    new ButtonBuilder().setCustomId(`community:vote:${s.id}:down`).setStyle(ButtonStyle.Danger).setEmoji('👎').setLabel(String(down)).setDisabled(!open),
  );
  return { embeds: [embed], components: [row] };
}

export const suggestCommand: SlashCommand = {
  data: (() => {
    const desc = d('community.cmd.suggest');
    const text = d('community.cmd.suggestText');
    return new SlashCommandBuilder()
      .setName('vorschlag')
      .setNameLocalizations({ 'en-US': 'suggest', 'en-GB': 'suggest' })
      .setDescription(desc.de)
      .setDescriptionLocalizations(desc.loc)
      .setContexts(InteractionContextType.Guild)
      .addStringOption((o) => o.setName('text').setDescription(text.de).setDescriptionLocalizations(text.loc).setRequired(true).setMinLength(5).setMaxLength(2000))
      .toJSON();
  })(),
  async execute({ interaction, locale, bot }: CommandContext) {
    if (!interaction.inCachedGuild()) return;
    const config = await communityConfig(bot, interaction.guildId);
    const channel = config.suggestions.enabled && config.suggestions.channelId ? interaction.guild.channels.cache.get(config.suggestions.channelId) : undefined;
    if (!channel?.isSendable()) return void (await interaction.reply({ content: t(locale, 'community.suggest.disabled'), flags: MessageFlags.Ephemeral }));
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guild = await bot.prisma.guild.update({ where: { id: interaction.guildId }, data: { suggestionCounter: { increment: 1 } } });
    const s = await bot.prisma.suggestion.create({
      data: {
        guildId: interaction.guildId,
        number: guild.suggestionCounter,
        userId: interaction.user.id,
        userTag: interaction.user.username,
        text: interaction.options.getString('text', true),
        channelId: channel.id,
      },
    });
    const message = await channel.send({ ...suggestionMessage(s, locale, interaction.user.displayAvatarURL()), allowedMentions: { parse: [] } });
    await bot.prisma.suggestion.update({ where: { id: s.id }, data: { messageId: message.id } });
    if (config.suggestions.threads && 'startThread' in message) {
      await message.startThread({ name: t(locale, 'community.suggest.thread', { number: String(s.number) }).slice(0, 100) }).catch(() => undefined);
    }
    await interaction.editReply({ content: t(locale, 'community.suggest.sent', { channel: `<#${channel.id}>` }) });
  },
};

/** 👍/👎 – nochmal klicken nimmt die Stimme zurück, Wechsel ist möglich */
export async function onVote({ interaction, args, locale, bot }: ComponentContext): Promise<void> {
  if (!interaction.isButton()) return;
  const [id, dir] = args;
  const s = await bot.prisma.suggestion.findFirst({ where: { id: id ?? '', guildId: interaction.guildId } });
  if (!s) return;
  if (s.status === 'accepted' || s.status === 'denied') return void (await interaction.reply({ content: t(locale, 'community.suggest.closed'), flags: MessageFlags.Ephemeral }));
  const votes = { ...((s.votes ?? {}) as Record<string, number>) };
  const value = dir === 'up' ? 1 : -1;
  if (votes[interaction.user.id] === value) delete votes[interaction.user.id];
  else votes[interaction.user.id] = value;
  const updated = await bot.prisma.suggestion.update({ where: { id: s.id }, data: { votes: votes as Prisma.InputJsonValue } });
  const author = await bot.client.users.fetch(s.userId).catch(() => null);
  await interaction.update(suggestionMessage(updated, locale, author?.displayAvatarURL() ?? null));
}

/** Entscheidung aus dem Dashboard: Nachricht aktualisieren + Einreicher per DM informieren */
export async function onSuggestionDecided(bot: BotContext, guild: Guild, suggestionId: string): Promise<void> {
  const s = await bot.prisma.suggestion.findFirst({ where: { id: suggestionId, guildId: guild.id } });
  if (!s) return;
  const locale = await bot.modules.locale(guild.id);
  const author = await bot.client.users.fetch(s.userId).catch(() => null);
  const channel = guild.channels.cache.get(s.channelId);
  if (s.messageId && channel?.isTextBased()) {
    const message = await channel.messages.fetch(s.messageId).catch(() => null);
    await message?.edit(suggestionMessage(s, locale, author?.displayAvatarURL() ?? null)).catch(() => undefined);
  }
  if (author && s.status !== 'open') {
    const reason = s.reason ? `\n> ${s.reason}` : '';
    await author.send({ content: t(locale, 'community.suggest.dm', { number: String(s.number), server: guild.name, status: statusLabel(s.status as SuggestionStatus, locale), reason }) }).catch(() => undefined);
  }
}
