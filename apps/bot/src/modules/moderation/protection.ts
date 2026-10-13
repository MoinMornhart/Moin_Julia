import { AuditLogEvent, ChannelType, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type Guild, type GuildAuditLogsEntry, type GuildBasedChannel } from 'discord.js';
import type { Prisma } from '@moin/db';
import { everyoneCanView, protectedOverwrites, t, type ModerationConfig, type TranslationKey } from '@moin/shared';
import { setProtectedRoles } from '../../core/role-safety.js';
import type { BotContext, SlashCommand } from '../../core/types.js';
import { moderationConfig } from './cases.js';

/**
 * Geschützte Kanäle & Rollen (Issue #5):
 *  - Geschützte Rollen vergibt Moin_Julia nie per Selbstbedienung (Rollen-Panels, Auto-Rollen, Level …).
 *  - Geschützte Kanäle sieht @everyone nicht, die geschützten Rollen schon. Der Bot setzt das beim Speichern
 *    und – wenn eingeschaltet – sofort wieder, falls jemand die Rechte ändert (mit Meldung im Mod-Log).
 */
type OverwriteChannel = GuildBasedChannel & { permissionOverwrites: { cache: Map<string, { id: string; type: number; allow: { bitfield: bigint }; deny: { bitfield: bigint } }>; edit: (id: string, options: Record<string, boolean | null>, extra?: { reason?: string; type?: number }) => Promise<unknown> } };

const hasOverwrites = (c: GuildBasedChannel | undefined): c is OverwriteChannel => !!c && 'permissionOverwrites' in c;

function currentOverwrites(channel: OverwriteChannel) {
  return [...channel.permissionOverwrites.cache.values()].map((o) => ({ id: o.id, type: o.type, allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString() }));
}

/** Rechte eines geschützten Kanals herstellen; gibt zurück, ob etwas geändert wurde */
export async function secureChannel(channel: OverwriteChannel, roleIds: readonly string[], reason: string): Promise<boolean> {
  const guildId = channel.guild.id;
  const fixes = protectedOverwrites(guildId, currentOverwrites(channel), roleIds);
  for (const fix of fixes) {
    if (fix.id === guildId) await channel.permissionOverwrites.edit(guildId, { ViewChannel: false }, { reason, type: 0 });
    else await channel.permissionOverwrites.edit(fix.id, { ViewChannel: true, SendMessages: true }, { reason, type: 0 });
  }
  return fixes.length > 0;
}

/** Einstellungen laden: Rollen-Sperre setzen und alle geschützten Kanäle absichern */
/** Nur die Liste der geschützten Rollen laden (ohne Kanäle anzufassen) */
export async function loadProtectedRoles(bot: BotContext, guild: Guild): Promise<void> {
  const enabled = await bot.modules.isEnabled(guild.id, 'moderation');
  const config = await moderationConfig(bot, guild.id);
  setProtectedRoles(guild.id, enabled ? config.protection.roleIds : []);
}

export async function applyProtection(bot: BotContext, guild: Guild): Promise<{ secured: number; failed: number }> {
  const enabled = await bot.modules.isEnabled(guild.id, 'moderation');
  const config = await moderationConfig(bot, guild.id);
  const { roleIds, channelIds } = config.protection;
  setProtectedRoles(guild.id, enabled ? roleIds : []);
  if (!enabled) return { secured: 0, failed: 0 };
  let secured = 0;
  let failed = 0;
  for (const id of channelIds) {
    const channel = guild.channels.cache.get(id);
    if (!hasOverwrites(channel)) continue;
    try {
      if (await secureChannel(channel, roleIds.filter((r) => guild.roles.cache.has(r)), 'Geschützter Kanal (Moin_Julia)')) secured++;
    } catch (error) {
      failed++;
      bot.logger.warn({ err: error, guildId: guild.id, channelId: id }, 'Geschützter Kanal konnte nicht abgesichert werden');
    }
  }
  return { secured, failed };
}

/** Wächter: Rechte eines geschützten Kanals geändert → melden und (Standard) sofort wiederherstellen */
export async function onProtectedOverwrite(bot: BotContext, entry: Pick<GuildAuditLogsEntry, 'action' | 'executorId' | 'targetId'>, guild: Guild): Promise<'fixed' | 'warned' | null> {
  if (![AuditLogEvent.ChannelOverwriteCreate, AuditLogEvent.ChannelOverwriteUpdate, AuditLogEvent.ChannelOverwriteDelete].includes(entry.action as AuditLogEvent)) return null;
  if (!entry.targetId || entry.executorId === guild.members.me?.id) return null;
  if (!(await bot.modules.isEnabled(guild.id, 'moderation'))) return null;
  const config = await moderationConfig(bot, guild.id);
  if (!config.protection.channelIds.includes(entry.targetId)) return null;
  const channel = guild.channels.cache.get(entry.targetId);
  if (!hasOverwrites(channel) || !everyoneCanView(guild.id, { overwrites: currentOverwrites(channel) })) return null;
  const locale = await bot.modules.locale(guild.id);
  let fixed = false;
  if (config.protection.autoFix) fixed = await secureChannel(channel, config.protection.roleIds, 'Geschützter Kanal: Rechte wiederhergestellt (Moin_Julia)').then(() => true, () => false);
  const log = config.modLogChannelId ? guild.channels.cache.get(config.modLogChannelId) : undefined;
  if (log?.isSendable()) {
    const key: TranslationKey = fixed ? 'mod.prot.alertFixed' : 'mod.prot.alertOpen';
    await log.send({ embeds: [{ color: 0xffc857, title: t(locale, 'mod.prot.alertTitle'), description: t(locale, key, { user: entry.executorId ? `<@${entry.executorId}>` : '?', channel: `<#${entry.targetId}>` }), timestamp: new Date().toISOString() }], allowedMentions: { parse: [] } }).catch(() => undefined);
  }
  return fixed ? 'fixed' : 'warned';
}

// ── /geschuetzt ─────────────────────────────────────────────────────────────

function d(key: TranslationKey) {
  return { de: t('de', key), loc: { 'en-US': t('en', key), 'en-GB': t('en', key) } };
}
const en = (name: string) => ({ 'en-US': name, 'en-GB': name });

async function saveProtection(bot: BotContext, guildId: string, protection: ModerationConfig['protection'], by: string): Promise<void> {
  const config = await moderationConfig(bot, guildId);
  const data = { ...config, protection } as unknown as Prisma.InputJsonValue;
  await bot.prisma.guildModule.upsert({
    where: { guildId_moduleId: { guildId, moduleId: 'moderation' } },
    create: { guildId, moduleId: 'moderation', enabled: true, config: data, updatedBy: by },
    update: { config: data, updatedBy: by },
  });
  bot.modules.invalidate(guildId);
}

export const protectionCommand: SlashCommand = {
  data: (() => {
    const choice = (o: import('discord.js').SlashCommandStringOption) =>
      o
        .setName('aktion')
        .setNameLocalizations(en('action'))
        .setDescription(d('mod.prot.optAction').de)
        .setDescriptionLocalizations(d('mod.prot.optAction').loc)
        .setRequired(true)
        .addChoices({ name: 'schützen', name_localizations: en('protect'), value: 'an' }, { name: 'nicht mehr schützen', name_localizations: en('unprotect'), value: 'aus' });
    return new SlashCommandBuilder()
      .setName('geschuetzt')
      .setNameLocalizations(en('protected'))
      .setDescription(d('mod.prot.cmd').de)
      .setDescriptionLocalizations(d('mod.prot.cmd').loc)
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setContexts(InteractionContextType.Guild)
      .addSubcommand((s) =>
        s
          .setName('kanal')
          .setNameLocalizations(en('channel'))
          .setDescription(d('mod.prot.cmdChannel').de)
          .setDescriptionLocalizations(d('mod.prot.cmdChannel').loc)
          .addChannelOption((o) => o.setName('kanal').setNameLocalizations(en('channel')).setDescription(d('mod.prot.optChannel').de).setDescriptionLocalizations(d('mod.prot.optChannel').loc).setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildCategory))
          .addStringOption(choice),
      )
      .addSubcommand((s) =>
        s
          .setName('rolle')
          .setNameLocalizations(en('role'))
          .setDescription(d('mod.prot.cmdRole').de)
          .setDescriptionLocalizations(d('mod.prot.cmdRole').loc)
          .addRoleOption((o) => o.setName('rolle').setNameLocalizations(en('role')).setDescription(d('mod.prot.optRole').de).setDescriptionLocalizations(d('mod.prot.optRole').loc).setRequired(true))
          .addStringOption(choice),
      )
      .addSubcommand((s) => s.setName('liste').setNameLocalizations(en('list')).setDescription(d('mod.prot.cmdList').de).setDescriptionLocalizations(d('mod.prot.cmdList').loc))
      .toJSON();
  })(),
  async execute({ interaction, bot, locale }) {
    if (!interaction.inCachedGuild()) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guild = interaction.guild;
    const config = await moderationConfig(bot, guild.id);
    const p = { ...config.protection, roleIds: [...config.protection.roleIds], channelIds: [...config.protection.channelIds] };
    const sub = interaction.options.getSubcommand();
    const reply = (key: TranslationKey, vars: Record<string, string | number> = {}) => interaction.editReply({ content: t(locale, key, vars), allowedMentions: { parse: [] } });

    if (sub === 'liste') {
      const roles = p.roleIds.map((id) => `<@&${id}>`).join(', ') || '–';
      const channels = p.channelIds.map((id) => `<#${id}>`).join(', ') || '–';
      return void (await reply('mod.prot.list', { roles, channels }));
    }
    const on = interaction.options.getString('aktion', true) === 'an';
    if (sub === 'rolle') {
      const role = interaction.options.getRole('rolle', true);
      // @everyone und Bot-Rollen ergeben als „geschützte Rolle“ keinen Sinn (würde Team-Kanäle für alle öffnen)
      if (role.id === guild.id || role.managed) return void (await reply('mod.prot.badRole'));
      p.roleIds = on ? [...new Set([...p.roleIds, role.id])].slice(0, 25) : p.roleIds.filter((id) => id !== role.id);
      await saveProtection(bot, guild.id, p, interaction.user.id);
      await applyProtection(bot, guild);
      return void (await reply(on ? 'mod.prot.roleOn' : 'mod.prot.roleOff', { role: `<@&${role.id}>` }));
    }
    const channel = interaction.options.getChannel('kanal', true);
    p.channelIds = on ? [...new Set([...p.channelIds, channel.id])].slice(0, 50) : p.channelIds.filter((id) => id !== channel.id);
    await saveProtection(bot, guild.id, p, interaction.user.id);
    const result = await applyProtection(bot, guild);
    if (on && !p.roleIds.length) return void (await reply('mod.prot.channelOnNoRoles', { channel: `<#${channel.id}>` }));
    return void (await reply(on ? (result.failed ? 'mod.prot.channelFailed' : 'mod.prot.channelOn') : 'mod.prot.channelOff', { channel: `<#${channel.id}>` }));
  },
};
