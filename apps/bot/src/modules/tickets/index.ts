import {
  AttachmentBuilder,
  ChannelType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ButtonInteraction,
  type Guild,
  type GuildMember,
  type ModalSubmitInteraction,
  type OverwriteResolvable,
  type StringSelectMenuInteraction,
  type TextChannel,
} from 'discord.js';
import type { Prisma, Ticket } from '@moin/db';
import { parseTicketsConfig, t, ticketChannelName, ticketPanelSchema, type Locale, type TicketsConfig, type TranslationKey } from '@moin/shared';
import type { BotContext, BotModule, CommandContext, ComponentContext, SlashCommand } from '../../core/types.js';
import { canOpen, collectAnswers, isTeam, shouldAutoClose, stars, welcomeText } from './logic.js';
import { buildTicketPanel, closeModal, questionModal, ratingRow, ticketControls } from './panel.js';
import { renderTranscript, type TranscriptMessage } from './transcript.js';

/**
 * Tickets (wie GalaxyBot): Panel → Grund (optional mit Formular) → privater Kanal mit dem Team →
 * Übernehmen/Schließen → Transcript in den Log-Kanal und per DM, Bewertung, automatisches Schließen.
 */

const lastActivityWrite = new Map<string, number>();

function ticketsConfig(bot: BotContext, guildId: string): Promise<TicketsConfig> {
  return bot.modules.config(guildId, 'tickets', parseTicketsConfig);
}

async function loadPanel(bot: BotContext, guildId: string, panelId: string) {
  const panel = await bot.prisma.ticketPanel.findFirst({ where: { id: panelId, guildId } });
  const parsed = panel ? ticketPanelSchema.safeParse(panel.data) : null;
  return panel && parsed?.success ? { panel, data: parsed.data } : null;
}

function memberIsTeam(member: GuildMember, config: TicketsConfig, reasonTeam: string[] = []): boolean {
  return isTeam([...member.roles.cache.keys()], member.permissions.has(PermissionFlagsBits.ManageGuild), config, { teamRoleIds: reasonTeam });
}

/** Offene Tickets einer Person – Einträge ohne Kanal (von Hand gelöscht) werden dabei geschlossen */
async function openTicketsOf(bot: BotContext, guild: Guild, userId: string): Promise<Ticket[]> {
  const rows = await bot.prisma.ticket.findMany({ where: { guildId: guild.id, openerId: userId, status: 'open' } });
  const alive: Ticket[] = [];
  for (const row of rows) {
    if (guild.channels.cache.has(row.channelId)) alive.push(row);
    else await bot.prisma.ticket.update({ where: { id: row.id }, data: { status: 'closed', closedAt: new Date(), closeReason: 'Kanal gelöscht' } });
  }
  return alive;
}

type OpenInteraction = ButtonInteraction<'cached'> | StringSelectMenuInteraction<'cached'> | ModalSubmitInteraction<'cached'>;

async function openTicket(ctx: ComponentContext, interaction: OpenInteraction, panelId: string, reasonId: string, answers: { label: string; value: string }[] | null): Promise<void> {
  const { bot, locale } = ctx;
  const guild = interaction.guild;
  const loaded = await loadPanel(bot, guild.id, panelId);
  const reason = loaded?.data.reasons.find((r) => r.id === reasonId);
  if (!loaded || !reason) {
    await interaction.reply({ content: t(locale, 'tickets.notConfigured'), flags: MessageFlags.Ephemeral });
    return;
  }
  const config = await ticketsConfig(bot, guild.id);
  const open = await openTicketsOf(bot, guild, interaction.user.id);
  if (!canOpen(open.length, config)) {
    await interaction.reply({
      content: t(locale, 'tickets.limit', { count: open.length, channels: open.map((o) => `<#${o.channelId}>`).join(', ') }),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  // Fragen? Erst das Formular zeigen (geht nur als direkte Antwort auf Knopf/Menü)
  if (reason.questions.length && answers === null && !interaction.isModalSubmit()) {
    await interaction.showModal(questionModal(panelId, reason));
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { ticketCounter: nr } = await bot.prisma.guild.update({ where: { id: guild.id }, data: { ticketCounter: { increment: 1 } }, select: { ticketCounter: true } });
  const team = [...new Set([...config.teamRoleIds, ...reason.teamRoleIds])].filter((id) => guild.roles.cache.has(id));
  const me = guild.members.me!;
  const view = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks];
  const overwrites: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: view },
    { id: me.id, allow: [...view, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] },
    ...team.map((id) => ({ id, allow: [...view, PermissionFlagsBits.ManageMessages] })),
  ];
  const parent = reason.categoryId ?? config.categoryId;
  let channel: TextChannel;
  try {
    channel = await guild.channels.create({
      name: ticketChannelName(config.nameTemplate, { nr, user: interaction.member.displayName }),
      type: ChannelType.GuildText,
      parent: parent && guild.channels.cache.get(parent)?.type === ChannelType.GuildCategory ? parent : undefined,
      topic: `Ticket #${nr} · ${reason.label} · ${interaction.user.tag}`,
      permissionOverwrites: overwrites,
      reason: `Ticket #${nr} von ${interaction.user.tag}`,
    });
  } catch (error) {
    bot.logger.warn({ err: error, guildId: guild.id }, 'Ticket: Kanal anlegen fehlgeschlagen');
    await interaction.editReply(t(locale, 'tickets.failed'));
    return;
  }
  const ticket = await bot.prisma.ticket.create({
    data: {
      guildId: guild.id,
      number: nr,
      channelId: channel.id,
      openerId: interaction.user.id,
      openerTag: interaction.user.tag,
      panelId,
      reasonId: reason.id,
      reasonLabel: reason.label,
      answers: (answers ?? []) as unknown as Prisma.InputJsonValue,
    },
  });

  const embed = new EmbedBuilder()
    .setColor(0xff7a59)
    .setTitle(t(locale, 'tickets.welcomeTitle', { nr, reason: reason.label }))
    .setDescription(welcomeText(config.welcomeText, { user: `<@${interaction.user.id}>`, nr }));
  for (const a of answers ?? []) embed.addFields({ name: a.label, value: a.value.slice(0, 1024) });
  const pings = [`<@${interaction.user.id}>`, ...(config.pingTeam ? team.map((id) => `<@&${id}>`) : [])].join(' ');
  await channel.send({
    content: pings,
    embeds: [embed],
    components: ticketControls(locale, ticket.id, false),
    allowedMentions: { users: [interaction.user.id], roles: config.pingTeam ? team : [] },
  });
  await logEvent(bot, guild, config, new EmbedBuilder()
    .setColor(0x2fd1b8)
    .setTitle(t(locale, 'tickets.log.opened', { nr }))
    .addFields(
      { name: t(locale, 'tickets.log.by'), value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
      { name: t(locale, 'tickets.log.reason'), value: reason.label, inline: true },
      { name: 'Kanal', value: `<#${channel.id}>`, inline: true },
    )
    .setTimestamp());
  await interaction.editReply(t(locale, 'tickets.opened', { channel: `<#${channel.id}>` }));
}

async function logEvent(bot: BotContext, guild: Guild, config: TicketsConfig, embed: EmbedBuilder, files: AttachmentBuilder[] = []): Promise<void> {
  if (!config.logChannelId) return;
  const channel = guild.channels.cache.get(config.logChannelId);
  if (channel?.isTextBased()) await channel.send({ embeds: [embed], files, allowedMentions: { parse: [] } }).catch((error: unknown) => bot.logger.warn({ err: error }, 'Ticket-Log fehlgeschlagen'));
}

/** Verlauf einsammeln (älteste zuerst, höchstens 2000 Nachrichten) */
async function collectMessages(channel: TextChannel): Promise<TranscriptMessage[]> {
  const all: TranscriptMessage[] = [];
  let before: string | undefined;
  for (let page = 0; page < 20; page++) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch?.size) break;
    for (const m of batch.values()) {
      all.push({
        author: m.member?.displayName ?? m.author.username,
        bot: m.author.bot,
        avatarUrl: m.author.displayAvatarURL({ size: 64 }),
        content: m.content,
        createdAt: m.createdAt,
        attachments: [...m.attachments.values()].map((a) => ({ name: a.name, url: a.url })),
        embeds: m.embeds.map((e) => ({ title: e.title, description: e.description })),
      });
    }
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }
  return all.reverse();
}

export async function closeTicket(bot: BotContext, guild: Guild, ticket: Ticket, by: { id: string; tag: string }, reason: string | null, locale: Locale): Promise<void> {
  const fresh = await bot.prisma.ticket.findUnique({ where: { id: ticket.id } });
  if (!fresh || fresh.status !== 'open') return;
  const config = await ticketsConfig(bot, guild.id);
  const channel = guild.channels.cache.get(ticket.channelId);
  const now = new Date();
  const messages = channel?.type === ChannelType.GuildText ? await collectMessages(channel) : [];
  const answers = Array.isArray(fresh.answers) ? (fresh.answers as { label: string; value: string }[]) : [];
  const html = renderTranscript(
    { server: guild.name, number: fresh.number, reason: fresh.reasonLabel, opener: fresh.openerTag, openedAt: fresh.createdAt, closedAt: now, closedBy: by.tag, closeReason: reason, answers },
    messages,
  );
  await bot.prisma.ticket.update({ where: { id: fresh.id }, data: { status: 'closed', closedAt: now, closedBy: by.id, closeReason: reason, transcript: html } });
  const file = () => new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `ticket-${fresh.number}.html` });
  const reasonText = reason ? ` (${reason})` : '';

  if (channel?.type === ChannelType.GuildText) {
    await channel.send({ content: t(locale, 'tickets.closing', { reason: reasonText, seconds: config.deleteAfterSec }), allowedMentions: { parse: [] } }).catch(() => undefined);
  }
  const log = new EmbedBuilder()
    .setColor(0x8c96ba)
    .setTitle(t(locale, 'tickets.log.closed', { nr: fresh.number }))
    .addFields(
      { name: t(locale, 'tickets.log.by'), value: `<@${fresh.openerId}> (${fresh.openerTag})`, inline: true },
      { name: t(locale, 'tickets.log.reason'), value: fresh.reasonLabel, inline: true },
      { name: t(locale, 'tickets.log.claimedBy'), value: fresh.claimedBy ? `<@${fresh.claimedBy}>` : '–', inline: true },
      { name: t(locale, 'tickets.log.closeReason'), value: `${reason ?? '–'} · <@${by.id}>` },
    )
    .setTimestamp();
  await logEvent(bot, guild, config, log, [file()]);

  if (config.transcriptDm) {
    const opener = await bot.client.users.fetch(fresh.openerId).catch(() => null);
    await opener
      ?.send({
        content: `${t(locale, 'tickets.dm.closed', { nr: fresh.number, server: guild.name, reason: reasonText })}${config.feedback ? `\n\n${t(locale, 'tickets.dm.rate')}` : ''}`,
        files: [file()],
        components: config.feedback ? ratingRow(fresh.id) : [],
      })
      .catch(() => undefined);
  }
  if (channel) {
    setTimeout(() => void channel.delete(`Ticket #${fresh.number} geschlossen`).catch(() => undefined), config.deleteAfterSec * 1000);
  }
}

// ── Komponenten ─────────────────────────────────────────────────────────────

async function onComponent(ctx: ComponentContext): Promise<void> {
  const { interaction, action, args, locale, bot } = ctx;
  if (action === 'open' && interaction.isButton()) return openTicket(ctx, interaction, args[0] ?? '', args[1] ?? '', null);
  if (action === 'select' && interaction.isStringSelectMenu()) return openTicket(ctx, interaction, args[0] ?? '', interaction.values[0] ?? '', null);
  if (action === 'form' && interaction.isModalSubmit()) {
    const loaded = await loadPanel(bot, interaction.guildId, args[0] ?? '');
    const reason = loaded?.data.reasons.find((r) => r.id === args[1]);
    const values = (reason?.questions ?? []).map((_, i) => interaction.fields.getTextInputValue(`q${i}`));
    return openTicket(ctx, interaction, args[0] ?? '', args[1] ?? '', collectAnswers(reason?.questions ?? [], values));
  }

  const ticket = await bot.prisma.ticket.findFirst({ where: { id: args[0] ?? '', guildId: interaction.guildId } });
  if (!ticket || ticket.status !== 'open') {
    await interaction.reply({ content: t(locale, 'tickets.notTicket'), flags: MessageFlags.Ephemeral });
    return;
  }
  const config = await ticketsConfig(bot, interaction.guildId);
  const loaded = ticket.panelId ? await loadPanel(bot, interaction.guildId, ticket.panelId) : null;
  const reasonTeam = loaded?.data.reasons.find((r) => r.id === ticket.reasonId)?.teamRoleIds ?? [];
  const team = memberIsTeam(interaction.member, config, reasonTeam);

  if (action === 'claim' && interaction.isButton()) {
    if (!team) return void (await interaction.reply({ content: t(locale, 'tickets.teamOnly'), flags: MessageFlags.Ephemeral }));
    if (ticket.claimedBy) return void (await interaction.reply({ content: t(locale, 'tickets.alreadyClaimed', { user: `<@${ticket.claimedBy}>` }), flags: MessageFlags.Ephemeral }));
    await bot.prisma.ticket.update({ where: { id: ticket.id }, data: { claimedBy: interaction.user.id } });
    await interaction.update({ components: ticketControls(locale, ticket.id, true) });
    await interaction.followUp({ content: t(locale, 'tickets.claimed', { user: `<@${interaction.user.id}>` }), allowedMentions: { parse: [] } });
    return;
  }
  // Schließen dürfen Team und die Person, die das Ticket geöffnet hat
  if (action === 'close' && interaction.isButton()) {
    if (!team && interaction.user.id !== ticket.openerId) return void (await interaction.reply({ content: t(locale, 'tickets.teamOnly'), flags: MessageFlags.Ephemeral }));
    await interaction.showModal(closeModal(locale, ticket.id));
    return;
  }
  if (action === 'close-submit' && interaction.isModalSubmit()) {
    if (!team && interaction.user.id !== ticket.openerId) return void (await interaction.reply({ content: t(locale, 'tickets.teamOnly'), flags: MessageFlags.Ephemeral }));
    await interaction.deferUpdate().catch(() => undefined);
    const reason = interaction.fields.getTextInputValue('reason').trim() || null;
    await closeTicket(bot, interaction.guild, ticket, { id: interaction.user.id, tag: interaction.user.tag }, reason, locale);
  }
}

// ── Befehle ─────────────────────────────────────────────────────────────────

function d(key: TranslationKey) {
  return { de: t('de', key), loc: { 'en-US': t('en', key), 'en-GB': t('en', key) } };
}

const ticketCommand: SlashCommand = {
  data: (() => {
    const root = d('tickets.cmd.desc');
    const close = d('tickets.cmd.close');
    const add = d('tickets.cmd.add');
    const remove = d('tickets.cmd.remove');
    const user = d('tickets.cmd.user');
    const reason = d('tickets.cmd.reason');
    return new SlashCommandBuilder()
      .setName('ticket')
      .setDescription(root.de)
      .setDescriptionLocalizations(root.loc)
      .setContexts(InteractionContextType.Guild)
      .addSubcommand((s) =>
        s
          .setName('close')
          .setDescription(close.de)
          .setDescriptionLocalizations(close.loc)
          .addStringOption((o) => o.setName('reason').setDescription(reason.de).setDescriptionLocalizations(reason.loc).setMaxLength(200)),
      )
      .addSubcommand((s) =>
        s
          .setName('add')
          .setDescription(add.de)
          .setDescriptionLocalizations(add.loc)
          .addUserOption((o) => o.setName('user').setDescription(user.de).setDescriptionLocalizations(user.loc).setRequired(true)),
      )
      .addSubcommand((s) =>
        s
          .setName('remove')
          .setDescription(remove.de)
          .setDescriptionLocalizations(remove.loc)
          .addUserOption((o) => o.setName('user').setDescription(user.de).setDescriptionLocalizations(user.loc).setRequired(true)),
      )
      .toJSON();
  })(),
  async execute({ interaction, locale, bot }: CommandContext) {
    if (!interaction.inCachedGuild()) return;
    const ticket = await bot.prisma.ticket.findFirst({ where: { channelId: interaction.channelId, status: 'open' } });
    if (!ticket) return void (await interaction.reply({ content: t(locale, 'tickets.notTicket'), flags: MessageFlags.Ephemeral }));
    const config = await ticketsConfig(bot, interaction.guildId);
    const team = memberIsTeam(interaction.member, config);
    const sub = interaction.options.getSubcommand();
    if (sub === 'close') {
      if (!team && interaction.user.id !== ticket.openerId) return void (await interaction.reply({ content: t(locale, 'tickets.teamOnly'), flags: MessageFlags.Ephemeral }));
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await closeTicket(bot, interaction.guild, ticket, { id: interaction.user.id, tag: interaction.user.tag }, interaction.options.getString('reason'), locale);
      await interaction.deleteReply().catch(() => undefined);
      return;
    }
    if (!team) return void (await interaction.reply({ content: t(locale, 'tickets.teamOnly'), flags: MessageFlags.Ephemeral }));
    const user = interaction.options.getUser('user', true);
    const channel = interaction.channel;
    if (channel?.type !== ChannelType.GuildText) return;
    if (sub === 'add') {
      await channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true });
      await interaction.reply({ content: t(locale, 'tickets.added', { user: `<@${user.id}>` }), allowedMentions: { parse: [] } });
    } else {
      await channel.permissionOverwrites.delete(user.id);
      await interaction.reply({ content: t(locale, 'tickets.removed', { user: `<@${user.id}>` }), allowedMentions: { parse: [] } });
    }
  },
};

// ── Hintergrund ─────────────────────────────────────────────────────────────

/** Alle 10 Minuten: inaktive Tickets automatisch schließen (wo eingeschaltet) */
async function autoCloseRound(bot: BotContext): Promise<void> {
  const open = await bot.prisma.ticket.findMany({ where: { status: 'open' } });
  const now = new Date();
  for (const ticket of open) {
    const guild = bot.client.guilds.cache.get(ticket.guildId);
    if (!guild || !(await bot.modules.isEnabled(guild.id, 'tickets'))) continue;
    const config = await ticketsConfig(bot, guild.id);
    if (!shouldAutoClose(ticket.lastActivity, now, config)) continue;
    const locale = await bot.modules.locale(guild.id);
    const me = bot.client.user!;
    await closeTicket(bot, guild, ticket, { id: me.id, tag: me.tag }, t(locale, 'tickets.autoClosed', { hours: config.autoClose.hours }), locale).catch((error: unknown) =>
      bot.logger.warn({ err: error, ticket: ticket.id }, 'Automatisches Schließen fehlgeschlagen'),
    );
  }
}

async function sendPanel(bot: BotContext, guildId: string, panelId: string): Promise<void> {
  const guild = bot.client.guilds.cache.get(guildId);
  const loaded = guild ? await loadPanel(bot, guildId, panelId) : null;
  if (!guild || !loaded?.panel.channelId) return;
  const channel = guild.channels.cache.get(loaded.panel.channelId);
  if (!channel?.isTextBased() || !('messages' in channel)) return;
  const me = guild.members.me!;
  const message = buildTicketPanel(panelId, loaded.data, {
    userId: me.id,
    userName: me.displayName,
    userTag: me.user.tag,
    userAvatarUrl: me.user.displayAvatarURL(),
    serverName: guild.name,
    serverIconUrl: guild.iconURL(),
    memberCount: guild.memberCount,
  });
  if (loaded.panel.messageId) {
    const existing = await channel.messages.fetch(loaded.panel.messageId).catch(() => null);
    if (existing) {
      await existing.edit(message);
      return;
    }
  }
  const sent = await channel.send(message);
  await bot.prisma.ticketPanel.update({ where: { id: panelId }, data: { messageId: sent.id } });
}

export const ticketsModule: BotModule = {
  id: 'tickets',
  commands: [ticketCommand],
  setup({ bot, on }) {
    // Aktivität merken (für automatisches Schließen) – höchstens alle 5 Minuten pro Kanal schreiben
    on('messageCreate', (m) => m.guildId, async (message) => {
      if (message.author.bot) return;
      const last = lastActivityWrite.get(message.channelId) ?? 0;
      if (Date.now() - last < 5 * 60_000) return;
      const res = await bot.prisma.ticket.updateMany({ where: { channelId: message.channelId, status: 'open' }, data: { lastActivity: new Date() } });
      if (res.count) lastActivityWrite.set(message.channelId, Date.now());
    });
    // Von Hand gelöschter Ticket-Kanal → Ticket als geschlossen markieren
    on('channelDelete', (c) => ('guildId' in c ? c.guildId : null), async (channel) => {
      await bot.prisma.ticket.updateMany({ where: { channelId: channel.id, status: 'open' }, data: { status: 'closed', closedAt: new Date(), closeReason: 'Kanal gelöscht' } });
    });
  },
  onReady(bot) {
    setInterval(() => void autoCloseRound(bot).catch((error: unknown) => bot.logger.warn({ err: error }, 'Ticket-Runde fehlgeschlagen')), 10 * 60_000).unref();
  },
  onComponent,
  async onDmComponent({ interaction, action, args, bot }) {
    if (action !== 'rate') return;
    const rating = Number(args[1]);
    const ticket = await bot.prisma.ticket.findUnique({ where: { id: args[0] ?? '' } });
    if (!ticket || ticket.openerId !== interaction.user.id || !(rating >= 1 && rating <= 5)) return;
    if (ticket.rating === null) await bot.prisma.ticket.update({ where: { id: ticket.id }, data: { rating } });
    const locale = await bot.modules.locale(ticket.guildId);
    await interaction.update({ components: [], content: `${interaction.message.content.split('\n\n')[0]}\n\n${t(locale, 'tickets.rated', { stars: stars(ticket.rating ?? rating) })}` });
  },
  async onAction(bot, guildId, action) {
    if (action.startsWith('panel:')) await sendPanel(bot, guildId, action.slice(6));
  },
};
