import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Guild,
  type GuildMember,
  type MessageActionRowComponentBuilder,
  type ModalActionRowComponentBuilder,
} from 'discord.js';
import type { Prisma, Suggestion } from '@moin/db';
import {
  findSuggestionBoard,
  SUGGESTION_STATUS,
  SUGGESTION_STATUS_LABELS,
  suggestionBoards,
  t,
  voteCounts,
  type CommunityConfig,
  type Locale,
  type SuggestionBoard,
  type SuggestionStatus,
} from '@moin/shared';
import type { BotContext, CommandContext, ComponentContext, SlashCommand } from '../../core/types.js';
import { communityConfig, d, isManager } from './shared.js';

/**
 * Vorschläge wie bei GalaxyBot: mehrere Bereiche, Knopf „Vorschlag einreichen“ im Kanal (bleibt unten stehen),
 * 👍/👎 für alle, Entscheidung durch das Team direkt in Discord (im Team-Kanal oder unter dem Vorschlag),
 * mit Begründung, DM an die einreichende Person und optionalem Ergebnis-Kanal.
 */

const STATUS_COLOR: Record<SuggestionStatus, number> = { open: 0x2f8bff, accepted: 0x2fd1b8, denied: 0xff5c6c, considered: 0xffc857 };
const STATUS_EN: Record<SuggestionStatus, string> = { open: 'Open', accepted: 'Accepted', denied: 'Denied', considered: 'Under consideration' };
const statusLabel = (status: SuggestionStatus, locale: Locale) => (locale === 'en' ? STATUS_EN[status] : SUGGESTION_STATUS_LABELS[status]);
const panelKey = (guildId: string, boardId: string) => `moin:sugg:panel:${guildId}:${boardId}`;

/** Darf entscheiden: Owner, „Server verwalten“, Community-Manager-Rollen oder Team-Rollen des Bereichs */
export function canDecide(member: GuildMember, config: CommunityConfig, board: SuggestionBoard | null): boolean {
  if (member.id === member.guild.ownerId || isManager(member, config)) return true;
  return (board?.staffRoleIds ?? config.suggestions.staffRoleIds).some((r) => member.roles.cache.has(r));
}

function decisionRow(s: Suggestion, locale: Locale) {
  const done = s.status === 'accepted' || s.status === 'denied';
  const btn = (status: SuggestionStatus, emoji: string, style: ButtonStyle, key: 'accept' | 'deny' | 'consider') =>
    new ButtonBuilder().setCustomId(`community:decide:${s.id}:${status}`).setEmoji(emoji).setLabel(t(locale, `community.suggest.${key}`)).setStyle(style).setDisabled(done || s.status === status);
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    btn('accepted', '✅', ButtonStyle.Success, 'accept'),
    btn('denied', '❌', ButtonStyle.Danger, 'deny'),
    btn('considered', '🤔', ButtonStyle.Secondary, 'consider'),
  );
}

/** Öffentliche Nachricht: Embed + 👍/👎 (+ Entscheidungs-Knöpfe, wenn es keinen Team-Kanal gibt) */
export function suggestionMessage(s: Suggestion, locale: Locale, avatar: string | null, board?: SuggestionBoard | null) {
  const status = s.status as SuggestionStatus;
  const { up, down } = voteCounts((s.votes ?? {}) as Record<string, number>);
  const anonymous = !!board?.anonymous;
  const embed = new EmbedBuilder()
    .setColor(STATUS_COLOR[status] ?? STATUS_COLOR.open)
    .setAuthor({ name: anonymous ? t(locale, 'community.suggest.anonymous') : s.userTag, ...(avatar && !anonymous ? { iconURL: avatar } : {}) })
    .setTitle(t(locale, 'community.suggest.title', { number: String(s.number) }))
    .setDescription(s.text.slice(0, 4000))
    .addFields({ name: t(locale, 'community.suggest.status'), value: statusLabel(status, locale), inline: true })
    .setTimestamp(s.createdAt);
  if (board && board.id !== 'main') embed.setFooter({ text: board.name });
  if (s.decidedBy && status !== 'open') embed.addFields({ name: t(locale, 'community.suggest.decidedBy'), value: `<@${s.decidedBy}>`, inline: true });
  if (s.reason) embed.addFields({ name: t(locale, 'community.suggest.reason'), value: s.reason.slice(0, 1000) });
  const open = status === 'open' || status === 'considered';
  const votes = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`community:vote:${s.id}:up`).setStyle(ButtonStyle.Success).setEmoji('👍').setLabel(String(up)).setDisabled(!open),
    new ButtonBuilder().setCustomId(`community:vote:${s.id}:down`).setStyle(ButtonStyle.Danger).setEmoji('👎').setLabel(String(down)).setDisabled(!open),
  );
  const components = board && !board.staffChannelId && open ? [votes, decisionRow(s, locale)] : [votes];
  return { embeds: [embed], components };
}

/** Nachricht im Team-Kanal: Vorschlag + Stimmen + Entscheidungs-Knöpfe + Link */
function staffMessage(s: Suggestion, locale: Locale, publicUrl: string | null) {
  const status = s.status as SuggestionStatus;
  const { up, down } = voteCounts((s.votes ?? {}) as Record<string, number>);
  const embed = new EmbedBuilder()
    .setColor(STATUS_COLOR[status] ?? STATUS_COLOR.open)
    .setAuthor({ name: s.userTag })
    .setTitle(t(locale, 'community.suggest.title', { number: String(s.number) }))
    .setDescription(s.text.slice(0, 4000))
    .addFields(
      { name: t(locale, 'community.suggest.status'), value: statusLabel(status, locale), inline: true },
      { name: t(locale, 'community.suggest.votes'), value: `👍 ${up} · 👎 ${down}`, inline: true },
    );
  if (s.decidedBy && status !== 'open') embed.addFields({ name: t(locale, 'community.suggest.decidedBy'), value: `<@${s.decidedBy}>`, inline: true });
  if (s.reason) embed.addFields({ name: t(locale, 'community.suggest.reason'), value: s.reason.slice(0, 1000) });
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [decisionRow(s, locale)];
  if (publicUrl) rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(publicUrl).setLabel(t(locale, 'community.suggest.jump'))));
  return { embeds: [embed], components: rows, allowedMentions: { parse: [] as const } };
}

/** Panel mit Knopf „Vorschlag einreichen“ – wird nach jedem neuen Vorschlag wieder ganz unten gepostet */
export function panelMessage(board: SuggestionBoard, locale: Locale) {
  const embed = new EmbedBuilder().setColor(0xff7a59).setTitle(t(locale, 'community.suggest.panelTitle', { board: board.name })).setDescription(t(locale, 'community.suggest.panelText'));
  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`community:suggest:${board.id}`).setEmoji('💡').setLabel(t(locale, 'community.suggest.panelButton')).setStyle(ButtonStyle.Primary),
  );
  return { embeds: [embed], components: [row], allowedMentions: { parse: [] as const } };
}

export async function postSuggestionPanel(bot: BotContext, guild: Guild, board: SuggestionBoard, locale: Locale): Promise<boolean> {
  const channel = guild.channels.cache.get(board.channelId);
  if (!channel?.isSendable() || !channel.isTextBased()) return false;
  const old = await bot.redis.get(panelKey(guild.id, board.id)).catch(() => null);
  if (old) await channel.messages.delete(old).catch(() => undefined);
  const message = await channel.send(panelMessage(board, locale)).catch(() => null);
  if (!message) return false;
  await bot.redis.set(panelKey(guild.id, board.id), message.id).catch(() => undefined);
  return true;
}

/** Vorschlag anlegen (aus /vorschlag oder dem Formular) */
async function createSuggestion(bot: BotContext, guild: Guild, member: GuildMember, board: SuggestionBoard, text: string, locale: Locale): Promise<string> {
  const channel = guild.channels.cache.get(board.channelId);
  if (!channel?.isSendable()) return t(locale, 'community.suggest.disabled');
  const counter = await bot.prisma.guild.update({ where: { id: guild.id }, data: { suggestionCounter: { increment: 1 } } });
  const s = await bot.prisma.suggestion.create({
    data: { guildId: guild.id, number: counter.suggestionCounter, userId: member.id, userTag: member.user.username, text: text.trim().slice(0, 2000), channelId: channel.id, boardId: board.id },
  });
  const message = await channel.send({ ...suggestionMessage(s, locale, member.displayAvatarURL(), board), allowedMentions: { parse: [] } });
  let staffMessageId: string | null = null;
  const staffChannel = board.staffChannelId ? guild.channels.cache.get(board.staffChannelId) : undefined;
  if (staffChannel?.isSendable()) {
    const staff = await staffChannel.send({ content: t(locale, 'community.suggest.staffNew', { channel: `<#${channel.id}>` }), ...staffMessage(s, locale, message.url) }).catch(() => null);
    staffMessageId = staff?.id ?? null;
  }
  await bot.prisma.suggestion.update({ where: { id: s.id }, data: { messageId: message.id, staffMessageId } });
  if (board.threads && 'startThread' in message) {
    await message.startThread({ name: t(locale, 'community.suggest.thread', { number: String(s.number) }).slice(0, 100) }).catch(() => undefined);
  }
  // Knopf wieder ganz nach unten (nur wenn es im Kanal schon ein Panel gab)
  if (await bot.redis.get(panelKey(guild.id, board.id)).catch(() => null)) await postSuggestionPanel(bot, guild, board, locale);
  return t(locale, 'community.suggest.sent', { channel: `<#${channel.id}>` });
}

export const suggestCommand: SlashCommand = {
  data: (() => {
    const desc = d('community.cmd.suggest');
    const text = d('community.cmd.suggestText');
    const board = d('community.cmd.suggestBoard');
    return new SlashCommandBuilder()
      .setName('vorschlag')
      .setNameLocalizations({ 'en-US': 'suggest', 'en-GB': 'suggest' })
      .setDescription(desc.de)
      .setDescriptionLocalizations(desc.loc)
      .setContexts(InteractionContextType.Guild)
      .addStringOption((o) => o.setName('text').setDescription(text.de).setDescriptionLocalizations(text.loc).setRequired(true).setMinLength(5).setMaxLength(2000))
      .addStringOption((o) =>
        o
          .setName('bereich')
          .setNameLocalizations({ 'en-US': 'area', 'en-GB': 'area' })
          .setDescription(board.de)
          .setDescriptionLocalizations(board.loc)
          .setRequired(false)
          .setAutocomplete(true),
      )
      .toJSON();
  })(),
  async autocomplete({ interaction, bot }) {
    if (!interaction.inCachedGuild()) return;
    const config = await communityConfig(bot, interaction.guildId);
    const typed = interaction.options.getFocused().toLowerCase();
    const boards = config.suggestions.enabled ? suggestionBoards(config.suggestions) : [];
    await interaction.respond(boards.filter((b) => b.name.toLowerCase().includes(typed)).map((b) => ({ name: b.name, value: b.id })));
  },
  async execute({ interaction, locale, bot }: CommandContext) {
    if (!interaction.inCachedGuild()) return;
    const config = await communityConfig(bot, interaction.guildId);
    const board = config.suggestions.enabled ? findSuggestionBoard(config.suggestions, interaction.options.getString('bereich')) : null;
    if (!board) return void (await interaction.reply({ content: t(locale, config.suggestions.enabled ? 'community.suggest.unknownBoard' : 'community.suggest.disabled'), flags: MessageFlags.Ephemeral }));
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply({ content: await createSuggestion(bot, interaction.guild, interaction.member, board, interaction.options.getString('text', true), locale) });
  },
};

/** Knopf „Vorschlag einreichen“ → Formular; Formular abgeschickt → Vorschlag anlegen */
export async function onSuggestButton({ interaction, args, locale, bot }: ComponentContext): Promise<void> {
  const config = await communityConfig(bot, interaction.guildId);
  const board = config.suggestions.enabled ? findSuggestionBoard(config.suggestions, args[0]) : null;
  if (!board) return void (await interaction.reply({ content: t(locale, 'community.suggest.unknownBoard'), flags: MessageFlags.Ephemeral }));
  if (interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(`community:suggest:${board.id}`)
      .setTitle(t(locale, 'community.suggest.modalTitle', { board: board.name }).slice(0, 45))
      .addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
          new TextInputBuilder().setCustomId('text').setLabel(t(locale, 'community.suggest.modalLabel')).setPlaceholder(t(locale, 'community.suggest.modalPlaceholder')).setStyle(TextInputStyle.Paragraph).setMinLength(5).setMaxLength(2000).setRequired(true),
        ),
      );
    return void (await interaction.showModal(modal));
  }
  if (!interaction.isModalSubmit()) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await interaction.editReply({ content: await createSuggestion(bot, interaction.guild, interaction.member, board, interaction.fields.getTextInputValue('text'), locale) });
}

/** Entscheidungs-Knopf (✅/❌/🤔) → Formular für die Begründung → Status setzen */
export async function onDecide({ interaction, args, locale, bot }: ComponentContext): Promise<void> {
  const [id, status] = args;
  if (!id || !SUGGESTION_STATUS.includes(status as SuggestionStatus) || status === 'open') return;
  const s = await bot.prisma.suggestion.findFirst({ where: { id, guildId: interaction.guildId } });
  if (!s) return;
  const config = await communityConfig(bot, interaction.guildId);
  const board = findSuggestionBoard(config.suggestions, s.boardId);
  if (!canDecide(interaction.member, config, board)) return void (await interaction.reply({ content: t(locale, 'community.suggest.noStaff'), flags: MessageFlags.Ephemeral }));
  if (interaction.isButton()) {
    const modal = new ModalBuilder()
      .setCustomId(`community:decide:${s.id}:${status}`)
      .setTitle(t(locale, 'community.suggest.reasonTitle', { number: String(s.number), status: statusLabel(status as SuggestionStatus, locale) }).slice(0, 45))
      .addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
          new TextInputBuilder().setCustomId('reason').setLabel(t(locale, 'community.suggest.reasonLabel')).setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(false),
        ),
      );
    return void (await interaction.showModal(modal));
  }
  if (!interaction.isModalSubmit()) return;
  const reason = interaction.fields.getTextInputValue('reason').trim();
  await bot.prisma.suggestion.update({ where: { id: s.id }, data: { status, reason: reason || null, decidedBy: interaction.user.id, decidedAt: new Date() } });
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await onSuggestionDecided(bot, interaction.guild, s.id);
  await interaction.editReply({ content: t(locale, 'community.suggest.decided', { number: String(s.number), status: statusLabel(status as SuggestionStatus, locale) }) });
}

/** 👍/👎 – nochmal klicken nimmt die Stimme zurück, Wechsel ist möglich */
export async function onVote({ interaction, args, locale, bot }: ComponentContext): Promise<void> {
  if (!interaction.isButton()) return;
  const [id, dir] = args;
  const s = await bot.prisma.suggestion.findFirst({ where: { id: id ?? '', guildId: interaction.guildId } });
  if (!s) return;
  if (s.status === 'accepted' || s.status === 'denied') return void (await interaction.reply({ content: t(locale, 'community.suggest.closed'), flags: MessageFlags.Ephemeral }));
  const value = dir === 'up' ? 1 : -1;
  const uid = interaction.user.id;
  // Atomar in der Datenbank: Klicken zwei Leute gleichzeitig, geht keine Stimme verloren.
  // Gleiche Stimme nochmal = zurücknehmen, sonst setzen/wechseln.
  const rows = await bot.prisma.$queryRaw<{ votes: unknown }[]>`UPDATE "Suggestion" SET "votes" = CASE WHEN ("votes"->>${uid}) = ${String(value)} THEN "votes" - ${uid} ELSE "votes" || jsonb_build_object(${uid}::text, ${value}::int) END WHERE "id" = ${s.id} AND "guildId" = ${interaction.guildId} RETURNING "votes"`;
  const updated: Suggestion = { ...s, votes: (rows[0]?.votes ?? s.votes) as Prisma.JsonValue };
  const config = await communityConfig(bot, interaction.guildId);
  const board = findSuggestionBoard(config.suggestions, s.boardId);
  // Avatar nur aus dem Zwischenspeicher – ein zusätzlicher Discord-Aufruf kostet Zeit von den 3 Sekunden
  const author = bot.client.users.cache.get(s.userId);
  await interaction.update(suggestionMessage(updated, locale, author?.displayAvatarURL() ?? null, board));
  // Stimmen auch im Team-Kanal aktuell halten
  if (board?.staffChannelId && updated.staffMessageId) await refreshStaffMessage(interaction.guild, updated, locale, board, interaction.message.url);
}

async function refreshStaffMessage(guild: Guild, s: Suggestion, locale: Locale, board: SuggestionBoard, publicUrl: string | null): Promise<void> {
  const channel = guild.channels.cache.get(board.staffChannelId);
  if (!s.staffMessageId || !channel?.isTextBased()) return;
  const message = await channel.messages.fetch(s.staffMessageId).catch(() => null);
  await message?.edit({ content: message.content, ...staffMessage(s, locale, publicUrl) }).catch(() => undefined);
}

/** Nach einer Entscheidung (Discord oder Dashboard): Nachrichten aktualisieren, Ergebnis-Kanal, DM */
export async function onSuggestionDecided(bot: BotContext, guild: Guild, suggestionId: string): Promise<void> {
  const s = await bot.prisma.suggestion.findFirst({ where: { id: suggestionId, guildId: guild.id } });
  if (!s) return;
  const locale = await bot.modules.locale(guild.id);
  const config = await communityConfig(bot, guild.id);
  const board = findSuggestionBoard(config.suggestions, s.boardId);
  const author = await bot.client.users.fetch(s.userId).catch(() => null);
  const avatar = author?.displayAvatarURL() ?? null;
  const channel = guild.channels.cache.get(s.channelId);
  let publicUrl: string | null = null;
  if (s.messageId && channel?.isTextBased()) {
    const message = await channel.messages.fetch(s.messageId).catch(() => null);
    publicUrl = message?.url ?? null;
    await message?.edit(suggestionMessage(s, locale, avatar, board)).catch(() => undefined);
  }
  if (board) await refreshStaffMessage(guild, s, locale, board, publicUrl);
  if ((s.status === 'accepted' || s.status === 'denied') && board?.resultChannelId) {
    const results = guild.channels.cache.get(board.resultChannelId);
    if (results?.isSendable()) {
      const { embeds } = suggestionMessage(s, locale, avatar, board);
      const link = publicUrl ? [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(publicUrl).setLabel(t(locale, 'community.suggest.jump')))] : [];
      await results.send({ embeds, components: link, allowedMentions: { parse: [] } }).catch(() => undefined);
    }
  }
  if (author && s.status !== 'open') {
    const reason = s.reason ? `\n> ${s.reason}` : '';
    await author.send({ content: t(locale, 'community.suggest.dm', { number: String(s.number), server: guild.name, status: statusLabel(s.status as SuggestionStatus, locale), reason }) }).catch(() => undefined);
  }
}
