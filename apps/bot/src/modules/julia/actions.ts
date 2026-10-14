import { randomBytes } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags, PermissionFlagsBits, type Guild, type GuildMember } from 'discord.js';
import { loadSettings } from '@moin/db';
import { describeAction, JULIA_TOOL_PERMISSION, MOD_PERMISSIONS, parseJuliaConfig, parseRoyal, royalRuler, t, toolsFor, type JuliaAction, type Locale, type TranslationKey } from '@moin/shared';
import type { BotContext, ComponentContext } from '../../core/types.js';
import { applySetting, canConfigure } from './settings.js';

/**
 * Julia-Werkzeuge: Julia schlägt Aktionen vor, die fragende Person bestätigt per Knopf.
 * Beim Drücken wird ALLES noch einmal geprüft (Funktion an, Rechte, Rangfolge) – zwischen Vorschlag
 * und Klick kann sich etwas geändert haben.
 */
interface Pending {
  guildId: string;
  requesterId: string;
  actions: JuliaAction[];
  expires: number;
}

const EXPIRE_MS = 5 * 60_000;
const pending = new Map<string, Pending>();

export function resetPendingActions(): void {
  pending.clear();
}

/** Bestätigungs-Nachricht mit zwei Knöpfen – nur die fragende Person kann drücken */
export function actionPrompt(guildId: string, _channelId: string, requesterId: string, actions: JuliaAction[], locale: Locale) {
  const now = Date.now();
  for (const [key, p] of pending) if (p.expires < now) pending.delete(key);
  const id = randomBytes(6).toString('hex');
  pending.set(id, { guildId, requesterId, actions, expires: now + EXPIRE_MS });
  return {
    content: t(locale, 'julia.act.ask', { user: `<@${requesterId}>`, list: actions.map(describeAction).join('\n') }),
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`julia:act:ok:${id}`).setStyle(ButtonStyle.Danger).setLabel(t(locale, 'julia.act.ok')),
        new ButtonBuilder().setCustomId(`julia:act:no:${id}`).setStyle(ButtonStyle.Secondary).setLabel(t(locale, 'julia.act.no')),
      ),
    ],
    allowedMentions: { users: [requesterId] },
  };
}

type Fail = 'noPermission' | 'disabled' | 'notFound' | 'protected' | 'botCannot' | 'dmClosed' | 'ownerOnly' | 'invalid';

/** Darf diese Person Administrator-Rollen anlegen lassen? Nur Server-Owner und Instanz-Admin (Wunsch Philip) */
export function canCreateAdminRole(guild: Pick<Guild, 'ownerId'>, userId: string, instanceOwnerId: string | null | undefined): boolean {
  return userId === guild.ownerId || (!!instanceOwnerId && userId === instanceOwnerId);
}

/** Rechte-Prüfung für Werkzeuge: Discord-Recht – beim Instanz-Admin zählt „Rolle anlegen“ auch ohne Rollen-Recht */
export function juliaHas(member: Pick<GuildMember, 'id' | 'permissions'>, instanceOwnerId: string | null | undefined) {
  return (p: (typeof JULIA_TOOL_PERMISSION)[keyof typeof JULIA_TOOL_PERMISSION]) => member.permissions.has(PermissionFlagsBits[p]) || (p === 'ManageRoles' && !!instanceOwnerId && member.id === instanceOwnerId);
}

/** Darf `requester` die Person `target` timeouten? (wie Discord selbst: nur Leute mit niedrigerem Rang) */
export function canModerate(guild: Pick<Guild, 'ownerId'>, requester: Pick<GuildMember, 'id'> & { roles: { highest: { position: number } } }, target: Pick<GuildMember, 'id'> & { roles: { highest: { position: number } } }): boolean {
  if (target.id === requester.id || target.id === guild.ownerId) return false;
  if (requester.id === guild.ownerId) return true;
  return requester.roles.highest.position > target.roles.highest.position;
}

async function run(bot: BotContext, guild: Guild, requester: GuildMember, action: JuliaAction, locale: Locale): Promise<Fail | null> {
  const reason = t(locale, 'julia.act.reason', { user: requester.user.username }).slice(0, 400);
  if (action.kind === 'einstellung') {
    const done = await applySetting(bot, guild, action, requester.id);
    return done.ok ? null : 'invalid';
  }
  if (action.kind === 'rolle') {
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) return 'botCannot';
    if (action.rights === 'admin') {
      const settings = await loadSettings(bot.prisma).catch(() => null);
      if (!canCreateAdminRole(guild, requester.id, settings?.instanceOwnerId)) return 'ownerOnly';
    }
    const permissions = action.rights === 'admin' ? PermissionFlagsBits.Administrator : action.rights === 'mod' ? MOD_PERMISSIONS : 0n;
    if (action.rights === 'mod' && !requester.permissions.has(MOD_PERMISSIONS)) {
      const settings = await loadSettings(bot.prisma).catch(() => null);
      if (!canCreateAdminRole(guild, requester.id, settings?.instanceOwnerId)) return 'noPermission';
    }
    // Discord: eine Rolle darf nur Rechte bekommen, die der Bot selbst hat
    if (permissions && !me.permissions.has(permissions)) return 'botCannot';
    const created = await guild.roles
      .create({ name: action.name, permissions, ...(action.color !== null ? { colors: { primaryColor: action.color } } : {}), hoist: action.rights !== 'keine', reason })
      .catch(() => null);
    return created ? null : 'botCannot';
  }
  if (action.kind === 'kanal') {
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) return 'botCannot';
    const created = await guild.channels.create({ name: action.name, type: action.voice ? ChannelType.GuildVoice : ChannelType.GuildText, reason }).catch(() => null);
    return created ? null : 'botCannot';
  }
  const target = await guild.members.fetch(action.userId).catch(() => null);
  if (!target || target.user.bot) return 'notFound';
  if (action.kind === 'dm') {
    const text = t(locale, 'julia.act.dm', { server: guild.name, user: requester.displayName, text: action.text.replaceAll('\n', '\n> ') });
    const sent = await target.send({ content: text.slice(0, 2000), allowedMentions: { parse: [] } }).catch(() => null);
    return sent ? null : 'dmClosed';
  }
  // Timeout: nie gegen Server-Owner, Herrscher, sich selbst oder Höhergestellte
  const settings = await loadSettings(bot.prisma).catch(() => null);
  if (royalRuler(parseRoyal(settings?.juliaRoyal), target.id, settings?.instanceOwnerId ?? null)) return 'protected';
  if (!canModerate(guild, requester, target)) return 'protected';
  if (!target.moderatable) return 'botCannot';
  const done = await target.timeout(action.minutes * 60_000, reason).catch(() => null);
  return done ? null : 'botCannot';
}

/** Knopf „Ja, ausführen“ / „Abbrechen“ */
export async function onActionButton(ctx: ComponentContext): Promise<void> {
  const { interaction, args, locale, bot } = ctx;
  if (!interaction.isButton()) return;
  const [answer, id = ''] = args;
  const entry = pending.get(id);
  if (!entry || entry.expires < Date.now() || entry.guildId !== interaction.guildId) {
    pending.delete(id);
    return void (await interaction.update({ content: t(locale, 'julia.act.expired'), components: [], allowedMentions: { parse: [] } }));
  }
  if (interaction.user.id !== entry.requesterId) return void (await interaction.reply({ content: t(locale, 'julia.act.notYours'), flags: MessageFlags.Ephemeral }));
  pending.delete(id);
  if (answer !== 'ok') return void (await interaction.update({ content: t(locale, 'julia.act.cancelled'), components: [], allowedMentions: { parse: [] } }));

  const guild = interaction.guild;
  const requester = await guild?.members.fetch(interaction.user.id).catch(() => null);
  if (!guild || !requester) return;
  await interaction.deferUpdate();
  const config = await bot.modules.config(guild.id, 'julia', parseJuliaConfig);
  const settings = await loadSettings(bot.prisma).catch(() => null);
  const tools = toolsFor(config.tools, juliaHas(requester, settings?.instanceOwnerId));
  const lines: string[] = [];
  for (const action of entry.actions) {
    // Einstellungen hängen nicht an den Julia-Werkzeugen, sondern an Owner/Admin/Instanz-Admin
    const fail: Fail | null =
      action.kind === 'einstellung'
        ? canConfigure(guild, requester, settings?.instanceOwnerId)
          ? await run(bot, guild, requester, action, locale)
          : 'noPermission'
        : !config.tools.enabled
          ? 'disabled'
          : !tools.includes(action.kind)
            ? 'noPermission'
            : await run(bot, guild, requester, action, locale);
    lines.push(fail ? `${describeAction(action)}\n${t(locale, 'julia.act.failed', { reason: t(locale, `julia.act.r.${fail}` as TranslationKey) })}` : describeAction(action));
    if (!fail) bot.logger.info({ guildId: guild.id, by: requester.id, action: action.kind }, 'Julia-Werkzeug ausgeführt');
  }
  await interaction.editReply({ content: t(locale, 'julia.act.done', { user: `<@${requester.id}>`, list: lines.join('\n') }).slice(0, 2000), components: [], allowedMentions: { parse: [] } });
}
