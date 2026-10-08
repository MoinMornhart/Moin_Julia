import {
  ActionRowBuilder,
  AuditLogEvent,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type APIEmbed,
  type Guild,
  type GuildAuditLogsEntry,
  type GuildMember,
} from 'discord.js';
import { parseSchutzConfig, raidKey, t, type Locale, type NukeKind, type SchutzConfig, type TranslationKey } from '@moin/shared';
import type { BotContext, BotModule, ComponentContext } from '../../core/types.js';
import { accountAgeDays, AUDIT_KIND, CaptchaStore, formatAge, isExempt, NukeDetector, RaidDetector } from './logic.js';

const raid = new RaidDetector();
const nuke = new NukeDetector();
const captchas = new CaptchaStore();
const raidTimers = new Map<string, NodeJS.Timeout>();

function schutzConfig(bot: BotContext, guildId: string): Promise<SchutzConfig> {
  return bot.modules.config(guildId, 'schutz', parseSchutzConfig);
}

/** Alarm in den Schutz-Kanal, optional mit Rollen-Ping. */
async function alert(bot: BotContext, guild: Guild, embed: APIEmbed, config?: SchutzConfig): Promise<void> {
  const cfg = config ?? (await schutzConfig(bot, guild.id));
  if (!cfg.alertChannelId) return;
  const channel = guild.channels.cache.get(cfg.alertChannelId);
  if (!channel?.isTextBased()) return;
  await channel
    .send({
      content: cfg.alertRoleId ? `<@&${cfg.alertRoleId}>` : undefined,
      embeds: [embed],
      allowedMentions: { roles: cfg.alertRoleId ? [cfg.alertRoleId] : [] },
    })
    .catch((error: unknown) => bot.logger.warn({ err: error, guildId: guild.id }, 'Schutz-Alarm nicht gesendet'));
}

// ── Anti-Raid ───────────────────────────────────────────────────────────────

async function startRaid(bot: BotContext, guild: Guild, config: SchutzConfig, joins: number): Promise<void> {
  const locale = await bot.modules.locale(guild.id);
  const until = Date.now() + config.antiRaid.durationMin * 60_000;
  raid.start(guild.id, until);
  await bot.redis.set(raidKey(guild.id), new Date(until).toISOString(), 'PX', until - Date.now()).catch(() => undefined);

  let paused = true;
  if (guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await guild.disableInvites(true).catch(() => (paused = false));
  } else {
    paused = false;
  }
  const lines = [t(locale, 'schutz.alert.raidText', { joins, seconds: config.antiRaid.seconds, until: `<t:${Math.floor(until / 1000)}:t>` })];
  if (config.antiRaid.action === 'pause_kick') lines.push(t(locale, 'schutz.alert.raidKick'));
  if (!paused) lines.push(`⚠️ ${t(locale, 'schutz.alert.raidNoPerm')}`);
  await alert(bot, guild, { color: 0xff5d7a, title: t(locale, 'schutz.alert.raidTitle'), description: lines.join('\n\n'), timestamp: new Date().toISOString() }, config);
  scheduleRaidEnd(bot, guild, until);
}

function scheduleRaidEnd(bot: BotContext, guild: Guild, until: number): void {
  clearTimeout(raidTimers.get(guild.id));
  raidTimers.set(
    guild.id,
    setTimeout(() => void endRaid(bot, guild), Math.max(0, until - Date.now())),
  );
}

async function endRaid(bot: BotContext, guild: Guild): Promise<void> {
  clearTimeout(raidTimers.get(guild.id));
  raidTimers.delete(guild.id);
  raid.end(guild.id);
  await bot.redis.del(raidKey(guild.id)).catch(() => undefined);
  if (guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) await guild.disableInvites(false).catch(() => undefined);
  const locale = await bot.modules.locale(guild.id);
  await alert(bot, guild, { color: 0x2fd1b8, description: t(locale, 'schutz.alert.raidEnded'), timestamp: new Date().toISOString() });
}

// ── Beitritte: Raid + Account-Alter ─────────────────────────────────────────

async function onJoin(bot: BotContext, member: GuildMember): Promise<void> {
  const config = await schutzConfig(bot, member.guild.id);
  const locale = await bot.modules.locale(member.guild.id);
  const now = Date.now();

  if (config.antiRaid.enabled) {
    if (raid.isActive(member.guild.id, now) && config.antiRaid.action === 'pause_kick' && !member.user.bot) {
      await member.kick(t(locale, 'schutz.reason.raid')).catch(() => undefined);
      return;
    }
    if (raid.join(member.guild.id, now, config.antiRaid.joins, config.antiRaid.seconds * 1000)) {
      await startRaid(bot, member.guild, config, config.antiRaid.joins);
    }
  }

  if (config.accountAge.enabled && !member.user.bot) {
    const days = config.accountAge.minDays;
    if (accountAgeDays(member.user.createdAt, new Date(now)) < days) {
      const action = config.accountAge.action;
      const reason = t(locale, 'schutz.age.reason', { days });
      if (action === 'kick') {
        await member.send(t(locale, 'schutz.age.dmKick', { server: member.guild.name, days })).catch(() => undefined);
        await member.kick(reason).catch(() => undefined);
      } else if (action === 'timeout') {
        await member.timeout(24 * 36e5, reason).catch(() => undefined);
      }
      await alert(
        bot,
        member.guild,
        {
          color: 0xffc857,
          title: t(locale, 'schutz.alert.ageTitle'),
          description: t(locale, 'schutz.alert.ageText', {
            user: `<@${member.id}> (\`${member.user.tag}\`)`,
            age: formatAge(member.user.createdAt, new Date(now), locale),
            days,
            action: t(locale, `schutz.action.${action}` as TranslationKey),
          }),
          timestamp: new Date().toISOString(),
        },
        config,
      );
    }
  }
}

// ── Anti-Nuke ───────────────────────────────────────────────────────────────

/** Bestimmt die beobachtete Art eines Audit-Log-Eintrags (inkl. „Admin-Rechte vergeben“). */
function nukeKind(entry: GuildAuditLogsEntry, guild: Guild): NukeKind | null {
  const direct = AUDIT_KIND[entry.action];
  if (direct) return direct;
  const isAdminRole = (id: string) => guild.roles.cache.get(id)?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
  if (entry.action === AuditLogEvent.MemberRoleUpdate) {
    const added = entry.changes.find((c) => c.key === '$add')?.new as { id: string }[] | undefined;
    if (added?.some((r) => isAdminRole(r.id))) return 'adminGrant';
  }
  if (entry.action === AuditLogEvent.RoleUpdate) {
    const perms = entry.changes.find((c) => c.key === 'permissions');
    const admin = (v: unknown) => (BigInt(String(v ?? 0)) & PermissionFlagsBits.Administrator) !== 0n;
    if (perms && !admin(perms.old) && admin(perms.new)) return 'adminGrant';
  }
  return null;
}

async function onAuditEntry(bot: BotContext, entry: GuildAuditLogsEntry, guild: Guild): Promise<void> {
  const config = await schutzConfig(bot, guild.id);
  const { antiNuke } = config;
  if (!antiNuke.enabled || !entry.executorId) return;
  const kind = nukeKind(entry, guild);
  if (!kind || !antiNuke.watch[kind]) return;

  const executor = await guild.members.fetch(entry.executorId).catch(() => null);
  if (
    isExempt({
      executorId: entry.executorId,
      ownerId: guild.ownerId,
      botId: guild.members.me!.id,
      roleIds: executor ? [...executor.roles.cache.keys()] : [],
      whitelistUserIds: antiNuke.whitelistUserIds,
      whitelistRoleIds: antiNuke.whitelistRoleIds,
    })
  ) {
    return;
  }
  // Admin-Rechte zu vergeben ist schon beim ersten Mal ein Alarm
  const threshold = kind === 'adminGrant' ? 1 : antiNuke.threshold;
  const count = nuke.record(guild.id, entry.executorId, kind, Date.now(), threshold, antiNuke.seconds * 1000);
  if (count === null) return;

  const locale = await bot.modules.locale(guild.id);
  const kindLabel = t(locale, `schutz.kind.${kind}` as TranslationKey);
  const reason = t(locale, 'schutz.reason.nuke', { count, kind: kindLabel, seconds: antiNuke.seconds });
  let failed: string | null = null;
  try {
    if (!executor) throw new Error('Mitglied nicht gefunden');
    if (antiNuke.punishment === 'ban') await guild.members.ban(executor.id, { reason });
    else if (antiNuke.punishment === 'kick') await executor.kick(reason);
    else await executor.roles.set(executor.roles.cache.filter((r) => r.managed || r.id === guild.id), reason);
  } catch (error) {
    failed = error instanceof Error ? error.message : String(error);
  }
  const lines = [
    t(locale, 'schutz.alert.nukeText', { user: `<@${entry.executorId}>`, count, kind: kindLabel, seconds: antiNuke.seconds }),
    failed ? `⚠️ ${t(locale, 'schutz.alert.nukeFailed', { error: failed })}` : t(locale, 'schutz.alert.nukeAction', { action: t(locale, `schutz.action.${antiNuke.punishment}` as TranslationKey) }),
  ];
  await alert(bot, guild, { color: 0xff5d7a, title: t(locale, 'schutz.alert.nukeTitle'), description: lines.join('\n\n'), timestamp: new Date().toISOString() }, config);
}

// ── Verifizierung ───────────────────────────────────────────────────────────

export function verifyPanel(locale: Locale, config: SchutzConfig) {
  const embed = new EmbedBuilder().setColor(0xff7a59).setTitle(config.verification.title).setDescription(config.verification.message);
  const button = new ButtonBuilder().setCustomId('schutz:verify').setLabel(t(locale, 'schutz.verify.button')).setEmoji('✅').setStyle(ButtonStyle.Success);
  return { embeds: [embed], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)] };
}

async function grantVerifiedRole(ctx: ComponentContext, config: SchutzConfig): Promise<string> {
  const { interaction, locale } = ctx;
  const roleId = config.verification.roleId;
  if (!roleId || !interaction.guild.roles.cache.has(roleId)) return t(locale, 'schutz.verify.noRole');
  if (interaction.member.roles.cache.has(roleId)) return t(locale, 'schutz.verify.already');
  try {
    await interaction.member.roles.add(roleId, 'Verifizierung');
    return t(locale, 'schutz.verify.done');
  } catch {
    return t(locale, 'schutz.verify.failed');
  }
}

async function onComponent(ctx: ComponentContext): Promise<void> {
  const { interaction, locale, bot, action } = ctx;
  const config = await schutzConfig(bot, interaction.guildId);
  const key = `${interaction.guildId}:${interaction.user.id}`;

  if (action === 'verify' && interaction.isButton()) {
    if (config.verification.mode === 'captcha' && !interaction.member.roles.cache.has(config.verification.roleId ?? '')) {
      const { a, b } = captchas.create(key, Date.now());
      const input = new TextInputBuilder().setCustomId('answer').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(4);
      const modal = new ModalBuilder()
        .setCustomId('schutz:captcha')
        .setTitle(t(locale, 'schutz.captcha.title'))
        .addLabelComponents(new LabelBuilder().setLabel(t(locale, 'schutz.captcha.question', { a, b })).setTextInputComponent(input));
      await interaction.showModal(modal);
      return;
    }
    await interaction.reply({ content: await grantVerifiedRole(ctx, config), flags: MessageFlags.Ephemeral });
    return;
  }

  if (action === 'captcha' && interaction.isModalSubmit()) {
    const result = captchas.check(key, interaction.fields.getTextInputValue('answer'), Date.now());
    const content =
      result === 'ok' ? await grantVerifiedRole(ctx, config) : t(locale, result === 'wrong' ? 'schutz.captcha.wrong' : 'schutz.captcha.expired');
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}

// ── Aufträge aus dem Dashboard ──────────────────────────────────────────────

async function onAction(bot: BotContext, guildId: string, action: string): Promise<void> {
  const guild = bot.client.guilds.cache.get(guildId);
  if (!guild) return;
  if (action === 'end-raid') {
    await endRaid(bot, guild);
    return;
  }
  if (action === 'post-verify-panel') {
    const config = await schutzConfig(bot, guildId);
    const channel = config.verification.channelId ? guild.channels.cache.get(config.verification.channelId) : null;
    if (!channel?.isTextBased()) {
      bot.logger.warn({ guildId }, 'Verifizierungs-Panel: Kanal fehlt');
      return;
    }
    await channel.send(verifyPanel(await bot.modules.locale(guildId), config));
  }
}

export const schutzModule: BotModule = {
  id: 'schutz',

  setup({ bot, on }) {
    on('guildMemberAdd', (m) => m.guild.id, (member) => onJoin(bot, member));
    on('guildAuditLogEntryCreate', (_e, g) => g.id, (entry, guild) => onAuditEntry(bot, entry, guild));
  },

  // Laufende Raid-Modi nach einem Neustart wieder aufnehmen
  async onReady(bot) {
    for (const guild of bot.client.guilds.cache.values()) {
      const until = await bot.redis.get(raidKey(guild.id)).catch(() => null);
      if (!until) continue;
      const end = new Date(until).getTime();
      raid.start(guild.id, end);
      scheduleRaidEnd(bot, guild, end);
    }
  },

  onComponent,
  onAction: (bot, guildId, action) => onAction(bot, guildId, action),
};
