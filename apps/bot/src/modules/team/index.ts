import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type Guild, type MessageActionRowComponentBuilder } from 'discord.js';
import { loadSettings } from '@moin/db';
import { fillTeamText, parseTeamConfig, positionSchema, t, type FormAnswer, type Locale, type TeamConfig } from '@moin/shared';
import type { BotContext, BotModule } from '../../core/types.js';
import { probationReminderDue } from './logic.js';
import { STAFF_FORBIDDEN, safeRoleIds } from '../../core/role-safety.js';

/**
 * Teams / Bewerbungen: Die Entscheidungen fallen im Dashboard; der Bot setzt sie in Discord um
 * (Rollen geben/entziehen, DMs, Log) und erinnert an endende Probezeiten.
 */

function teamConfig(bot: BotContext, guildId: string): Promise<TeamConfig> {
  return bot.modules.config(guildId, 'team', parseTeamConfig);
}

async function dashboardBase(bot: BotContext): Promise<string | null> {
  const s = await loadSettings(bot.prisma).catch(() => null);
  return s?.dashboardUrl?.replace(/\/+$/, '') ?? null;
}

async function log(guild: Guild, config: TeamConfig, payload: { content?: string; embeds?: EmbedBuilder[]; components?: ActionRowBuilder<MessageActionRowComponentBuilder>[] }) {
  if (!config.logChannelId) return;
  const channel = guild.channels.cache.get(config.logChannelId);
  if (channel?.isTextBased()) await channel.send({ ...payload, allowedMentions: { parse: [] } }).catch(() => undefined);
}

function linkRow(label: string, url: string | null) {
  if (!url) return [];
  return [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url))];
}

async function dm(bot: BotContext, userId: string, payload: { content: string; components?: ActionRowBuilder<MessageActionRowComponentBuilder>[] }) {
  const user = await bot.client.users.fetch(userId).catch(() => null);
  await user?.send(payload).catch(() => undefined);
}

const dateText = (d: Date | string) => new Date(d).toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Berlin' });

async function onApplicationAction(bot: BotContext, guild: Guild, kind: string, appId: string, by: string): Promise<void> {
  const app = await bot.prisma.application.findFirst({ where: { id: appId, guildId: guild.id } });
  if (!app) return;
  const config = await teamConfig(bot, guild.id);
  const locale: Locale = await bot.modules.locale(guild.id);
  const base = await dashboardBase(bot);
  const inbox = base ? `${base}/g/${guild.id}/team/bewerbung/${app.id}` : null;
  const vars = { user: `<@${app.userId}>`, position: app.positionTitle, server: guild.name, reason: app.decisionReason ?? '–' };

  if (kind === 'new') {
    const answers = (Array.isArray(app.answers) ? app.answers : []) as FormAnswer[];
    const embed = new EmbedBuilder()
      .setColor(0x2f8bff)
      .setTitle(t(locale, 'team.log.new', { position: app.positionTitle }))
      .addFields({ name: t(locale, 'team.log.applicant'), value: `<@${app.userId}> (${app.userTag})` })
      .setTimestamp(app.createdAt);
    for (const a of answers.slice(0, 5)) embed.addFields({ name: a.label.slice(0, 256), value: a.value.slice(0, 300) || '–' });
    await log(guild, config, { embeds: [embed], components: linkRow(t(locale, 'team.log.open'), inbox) });
    await dm(bot, app.userId, { content: t(locale, 'team.dm.received', vars) });
    return;
  }

  if (kind === 'accept') {
    const position = await bot.prisma.jobPosition.findUnique({ where: { id: app.positionId } });
    const data = position ? positionSchema.safeParse(position.data) : null;
    const member = await guild.members.fetch(app.userId).catch(() => null);
    const probation = await bot.prisma.probation.findFirst({ where: { applicationId: app.id, status: 'running' } });
    if (member && data?.success) {
      const exists = (id: string) => guild.roles.cache.has(id);
      const add = safeRoleIds(guild, [...data.data.acceptRoleIds, ...(probation && config.probationRoleId ? [config.probationRoleId] : [])].filter(exists), STAFF_FORBIDDEN, bot.logger, 'Bewerbung');
      const remove = data.data.removeRoleIds.filter((r) => exists(r) && member.roles.cache.has(r));
      if (add.length) await member.roles.add(add, `Bewerbung angenommen (${app.positionTitle})`).catch((error: unknown) => bot.logger.warn({ err: error }, 'Bewerbung: Rollen geben fehlgeschlagen'));
      if (remove.length) await member.roles.remove(remove, `Bewerbung angenommen (${app.positionTitle})`).catch(() => undefined);
    }
    await dm(bot, app.userId, { content: fillTeamText(config.acceptText, vars) });
    const embed = new EmbedBuilder()
      .setColor(0x2fd1b8)
      .setTitle(t(locale, 'team.log.accepted', { position: app.positionTitle }))
      .addFields({ name: t(locale, 'team.log.applicant'), value: `<@${app.userId}> (${app.userTag})`, inline: true }, { name: t(locale, 'team.log.by'), value: `<@${by}>`, inline: true })
      .setTimestamp();
    if (probation) embed.addFields({ name: t(locale, 'team.log.probation'), value: dateText(probation.endAt) });
    await log(guild, config, { embeds: [embed] });
    return;
  }

  if (kind === 'reject') {
    await dm(bot, app.userId, { content: fillTeamText(config.rejectText, vars) });
    await log(guild, config, {
      embeds: [
        new EmbedBuilder()
          .setColor(0xff5d7a)
          .setTitle(t(locale, 'team.log.rejected', { position: app.positionTitle }))
          .addFields(
            { name: t(locale, 'team.log.applicant'), value: `<@${app.userId}> (${app.userTag})`, inline: true },
            { name: t(locale, 'team.log.by'), value: `<@${by}>`, inline: true },
            { name: t(locale, 'team.log.reason'), value: (app.decisionReason ?? '–').slice(0, 1024) },
          )
          .setTimestamp(),
      ],
    });
    return;
  }

  if (kind === 'interview') {
    const iv = app.interview as { at?: string; place?: string } | null;
    if (!iv?.at) return;
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`team:interview:${app.id}:yes`).setLabel(t(locale, 'team.btn.interviewYes')).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`team:interview:${app.id}:no`).setLabel(t(locale, 'team.btn.interviewNo')).setStyle(ButtonStyle.Secondary),
    );
    await dm(bot, app.userId, { content: t(locale, 'team.dm.interview', { ...vars, date: dateText(iv.at), place: iv.place ?? '–' }), components: [row] });
  }
}

async function onProbationAction(bot: BotContext, guild: Guild, kind: 'pass' | 'fail', probationId: string): Promise<void> {
  const p = await bot.prisma.probation.findFirst({ where: { id: probationId, guildId: guild.id } });
  if (!p) return;
  const config = await teamConfig(bot, guild.id);
  const locale = await bot.modules.locale(guild.id);
  const member = await guild.members.fetch(p.userId).catch(() => null);
  const remove: string[] = [];
  if (config.probationRoleId) remove.push(config.probationRoleId);
  if (kind === 'fail') {
    const app = await bot.prisma.application.findUnique({ where: { id: p.applicationId } });
    const position = app ? await bot.prisma.jobPosition.findUnique({ where: { id: app.positionId } }) : null;
    const data = position ? positionSchema.safeParse(position.data) : null;
    if (data?.success) remove.push(...data.data.acceptRoleIds);
  }
  const has = remove.filter((r) => member?.roles.cache.has(r));
  if (member && has.length) await member.roles.remove(has, kind === 'pass' ? 'Probezeit bestanden' : 'Probezeit nicht bestanden').catch(() => undefined);
  const vars = { user: `<@${p.userId}>`, position: p.positionTitle, server: guild.name };
  if (kind === 'pass') await dm(bot, p.userId, { content: t(locale, 'team.probationPassedDm', vars) });
  await log(guild, config, { content: t(locale, kind === 'pass' ? 'team.log.probationPassed' : 'team.log.probationFailed', vars) });
}

async function sendPanel(bot: BotContext, guild: Guild): Promise<void> {
  const config = await teamConfig(bot, guild.id);
  if (!config.panelChannelId) return;
  const channel = guild.channels.cache.get(config.panelChannelId);
  if (!channel?.isTextBased()) return;
  const locale = await bot.modules.locale(guild.id);
  const base = await dashboardBase(bot);
  const embed = new EmbedBuilder().setColor(0xff7a59).setTitle(t(locale, 'team.panel.title')).setDescription(config.panelText);
  await channel.send({ embeds: [embed], components: linkRow(t(locale, 'team.panel.button'), base ? `${base}/bewerben/${guild.id}` : null) });
}

/** Alle 6 Stunden: Erinnerung an endende Probezeiten (N Tage vorher, danach alle 3 Tage) */
async function probationRound(bot: BotContext): Promise<void> {
  const running = await bot.prisma.probation.findMany({ where: { status: 'running' } });
  const now = new Date();
  for (const p of running) {
    const guild = bot.client.guilds.cache.get(p.guildId);
    if (!guild || !(await bot.modules.isEnabled(guild.id, 'team'))) continue;
    const config = await teamConfig(bot, guild.id);
    if (!probationReminderDue(p, config.probationReminderDays, now)) continue;
    const locale = await bot.modules.locale(guild.id);
    await log(guild, config, { content: t(locale, 'team.log.probationReminder', { user: `<@${p.userId}>`, position: p.positionTitle, date: dateText(p.endAt) }) });
    await bot.prisma.probation.update({ where: { id: p.id }, data: { remindedAt: now } });
  }
}

export const teamModule: BotModule = {
  id: 'team',
  onReady(bot) {
    setInterval(() => void probationRound(bot).catch((error: unknown) => bot.logger.warn({ err: error }, 'Probezeit-Runde fehlgeschlagen')), 6 * 3_600_000).unref();
    void probationRound(bot).catch(() => undefined);
  },
  async onAction(bot, guildId, action, by) {
    const guild = bot.client.guilds.cache.get(guildId);
    if (!guild) return;
    const [kind, id] = action.split(':');
    if (kind === 'panel') return sendPanel(bot, guild);
    if (kind === 'probation-pass' || kind === 'probation-fail') return onProbationAction(bot, guild, kind === 'probation-pass' ? 'pass' : 'fail', id ?? '');
    if (kind && id) return onApplicationAction(bot, guild, kind, id, by);
  },
  async onDmComponent({ interaction, action, args, bot }) {
    if (action !== 'interview') return;
    const [appId, answer] = args;
    const app = await bot.prisma.application.findUnique({ where: { id: appId ?? '' } });
    if (!app || app.userId !== interaction.user.id) return;
    const iv = (app.interview ?? {}) as { at?: string; place?: string; status?: string };
    await bot.prisma.application.update({ where: { id: app.id }, data: { interview: { ...iv, status: answer === 'yes' ? 'accepted' : 'declined' } } });
    const locale = await bot.modules.locale(app.guildId);
    await interaction.update({ components: [], content: `${interaction.message.content}\n\n${t(locale, answer === 'yes' ? 'team.interview.thanksYes' : 'team.interview.thanksNo')}` });
    const guild = bot.client.guilds.cache.get(app.guildId);
    if (guild) {
      await log(guild, await teamConfig(bot, guild.id), {
        content: t(locale, 'team.log.interview', { user: `<@${app.userId}>`, answer: t(locale, answer === 'yes' ? 'team.interview.accepted' : 'team.interview.declined'), date: iv.at ? dateText(iv.at) : '–' }),
      });
    }
  },
};
