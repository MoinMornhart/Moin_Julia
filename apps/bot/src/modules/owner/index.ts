import {
  AuditLogEvent,
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
  type CategoryChannel,
  type Guild,
  type GuildBasedChannel,
  type OverwriteResolvable,
  type Role,
} from 'discord.js';
import type { Prisma } from '@moin/db';
import { cleanRoleName, expectedOverwrites, overwriteProblems, parseOwnerConfig, type OwnerConfig, type Overwrite } from '@moin/shared';
import type { BotContext, BotModule } from '../../core/types.js';

/**
 * Owner-Bereich: Kategorie mit Kanälen nur für den Server-Owner und Bots. Moin_Julia setzt die Rechte,
 * prüft sie bei jeder Änderung (Kanal, neue Rolle, neuer Bot) und stellt Aufweichungen sofort zurück –
 * der Owner bekommt dann eine DM, wer es war (laut Audit-Log).
 */

function ownerConfig(bot: BotContext, guildId: string): Promise<OwnerConfig> {
  return bot.modules.config(guildId, 'owner', parseOwnerConfig);
}

const FLAG: Record<string, bigint> = {
  ViewChannel: PermissionFlagsBits.ViewChannel,
  ManageChannels: PermissionFlagsBits.ManageChannels,
  ManageRoles: PermissionFlagsBits.ManageRoles,
  SendMessages: PermissionFlagsBits.SendMessages,
  ReadMessageHistory: PermissionFlagsBits.ReadMessageHistory,
};

const toResolvable = (o: Overwrite): OverwriteResolvable => ({
  id: o.id,
  type: o.type === 'role' ? OverwriteType.Role : OverwriteType.Member,
  allow: o.allow.map((n) => FLAG[n]!).filter(Boolean),
  deny: o.deny.map((n) => FLAG[n]!).filter(Boolean),
});

/** Ist-Rechte eines Kanals in derselben Form wie die Soll-Rechte (nur die Rechte, um die es geht) */
export function currentOverwrites(channel: { permissionOverwrites: { cache: Map<string, { id: string; type: OverwriteType; allow: { has: (b: bigint) => boolean }; deny: { has: (b: bigint) => boolean } }> } }): Overwrite[] {
  return [...channel.permissionOverwrites.cache.values()].map((o) => ({
    id: o.id,
    type: o.type === OverwriteType.Role ? 'role' : 'member',
    allow: Object.keys(FLAG).filter((n) => o.allow.has(FLAG[n]!)),
    deny: Object.keys(FLAG).filter((n) => o.deny.has(FLAG[n]!)),
  }));
}

function expectedFor(guild: Guild, config: OwnerConfig): Overwrite[] {
  return expectedOverwrites({
    everyoneId: guild.roles.everyone.id,
    ownerId: guild.ownerId,
    selfId: guild.members.me?.id ?? guild.client.user.id,
    // Rollen von Bots (managed) brauchen kein Verbot – ihre Bots sind ohnehin erlaubt
    roleIds: guild.roles.cache.filter((r) => !r.managed).map((r) => r.id),
    botIds: guild.members.cache.filter((m) => m.user.bot).map((m) => m.id),
    allowBots: config.allowBots,
  });
}

function areaChannels(guild: Guild, categoryId: string): GuildBasedChannel[] {
  const category = guild.channels.cache.get(categoryId);
  if (!category) return [];
  return [category, ...guild.channels.cache.filter((c) => c.parentId === categoryId).values()];
}

const pending = new Map<string, NodeJS.Timeout>();

/** Rechte prüfen und ggf. zurückstellen (gebündelt, damit eigene Änderungen keine Schleife auslösen) */
export function scheduleEnforce(bot: BotContext, guild: Guild, reason: string): void {
  if (pending.has(guild.id)) return;
  pending.set(
    guild.id,
    setTimeout(() => {
      pending.delete(guild.id);
      void enforce(bot, guild, reason).catch((error: unknown) => bot.logger.warn({ err: error, guildId: guild.id }, 'Owner-Bereich: Prüfung fehlgeschlagen'));
    }, 2000),
  );
}

export async function enforce(bot: BotContext, guild: Guild, reason: string): Promise<string[]> {
  if (!(await bot.modules.isEnabled(guild.id, 'owner'))) return [];
  const config = await ownerConfig(bot, guild.id);
  if (!config.categoryId) return [];
  const expected = expectedFor(guild, config);
  const fixed: string[] = [];
  for (const channel of areaChannels(guild, config.categoryId)) {
    if (!('permissionOverwrites' in channel)) continue;
    const problems = overwriteProblems(currentOverwrites(channel as never), expected);
    if (!problems.length) continue;
    await channel.permissionOverwrites.set(expected.map(toResolvable), 'Owner-Bereich: Rechte wiederhergestellt');
    fixed.push(channel.name);
  }
  if (fixed.length && config.notifyOwner && reason !== 'setup') await notifyOwner(bot, guild, fixed, reason);
  return fixed;
}

async function notifyOwner(bot: BotContext, guild: Guild, channels: string[], reason: string): Promise<void> {
  let who = '';
  const logs = await guild.fetchAuditLogs({ limit: 5 }).catch(() => null);
  const entry = logs?.entries.find(
    (e) =>
      [AuditLogEvent.ChannelOverwriteCreate, AuditLogEvent.ChannelOverwriteUpdate, AuditLogEvent.ChannelOverwriteDelete, AuditLogEvent.ChannelUpdate].includes(e.action) &&
      e.executorId !== bot.client.user?.id &&
      Date.now() - e.createdTimestamp < 60_000,
  );
  if (entry?.executorId) who = ` von <@${entry.executorId}>`;
  const owner = await guild.fetchOwner().catch(() => null);
  const locale = await bot.modules.locale(guild.id);
  const text =
    locale === 'en'
      ? `🔒 **${guild.name}**: someone changed the permissions of your owner area${who} (${channels.map((c) => `#${c}`).join(', ')}). I restored them.`
      : `🔒 **${guild.name}**: Jemand hat die Rechte deines Owner-Bereichs geändert${who} (${channels.map((c) => `#${c}`).join(', ')}). Ich habe sie wiederhergestellt.`;
  await owner?.send({ content: text, allowedMentions: { parse: [] } }).catch(() => undefined);
  bot.logger.info({ guildId: guild.id, channels, reason }, 'Owner-Bereich: Rechte wiederhergestellt');
}

/** Dashboard: „Owner-Bereich anlegen“ – Kategorie + erster Kanal, ID wird gespeichert */
async function setup(bot: BotContext, guild: Guild, by: string): Promise<void> {
  const config = await ownerConfig(bot, guild.id);
  if (config.categoryId && guild.channels.cache.has(config.categoryId)) {
    await enforce(bot, guild, 'setup');
    return;
  }
  await guild.members.fetch().catch(() => undefined); // alle Bots kennen
  const expected = expectedFor(guild, config).map(toResolvable);
  const category = await guild.channels.create({ name: '🔒 Owner-Bereich', type: ChannelType.GuildCategory, permissionOverwrites: expected, reason: 'Owner-Bereich angelegt (Dashboard)' });
  await guild.channels.create({ name: 'owner-notizen', type: ChannelType.GuildText, parent: category.id, permissionOverwrites: expected, reason: 'Owner-Bereich angelegt (Dashboard)' });
  await saveConfig(bot, guild.id, { ...config, categoryId: category.id }, by);
}

async function saveConfig(bot: BotContext, guildId: string, config: OwnerConfig, by: string): Promise<void> {
  const data = config as unknown as Prisma.InputJsonValue;
  await bot.prisma.guildModule.upsert({
    where: { guildId_moduleId: { guildId, moduleId: 'owner' } },
    create: { guildId, moduleId: 'owner', enabled: true, config: data, updatedBy: by },
    update: { config: data, updatedBy: by },
  });
  bot.modules.invalidate(guildId);
}

async function addChannel(bot: BotContext, guild: Guild, kind: 'text' | 'voice', name: string): Promise<void> {
  const config = await ownerConfig(bot, guild.id);
  const category = config.categoryId ? (guild.channels.cache.get(config.categoryId) as CategoryChannel | undefined) : undefined;
  if (!category) return;
  await guild.channels.create({
    name: name.slice(0, 90) || 'owner',
    type: kind === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: expectedFor(guild, config).map(toResolvable),
    reason: 'Owner-Bereich: Kanal angelegt (Dashboard)',
  });
}

/**
 * „Administrator“ einer Rolle durch alle Einzelrechte ersetzen: Die Rolle kann praktisch dasselbe,
 * sieht aber den Owner-Bereich nicht mehr. Vorher wird gesichert (Wiederherstellen im Dashboard).
 */
export async function replaceAdministrator(bot: BotContext, guild: Guild, roleId: string, by: string): Promise<boolean> {
  const role = guild.roles.cache.get(roleId);
  if (!role || !role.permissions.has(PermissionFlagsBits.Administrator)) return false;
  const backup = await bot.prisma.ownerRoleBackup.create({
    data: { guildId: guild.id, roleId, roleName: role.name, permissions: role.permissions.bitfield.toString(), createdBy: by },
  });
  try {
    const reason = by === 'auto' ? 'Owner-Bereich: neue Admin-Rolle automatisch auf Einzelrechte umgestellt' : 'Owner-Bereich: Administrator durch Einzelrechte ersetzt (Dashboard)';
    await role.setPermissions(allButAdministrator(guild), reason);
    return true;
  } catch (error) {
    const message = role.editable ? (error instanceof Error ? error.message : String(error)) : 'Die Rolle steht über Moin_Julia – in den Server-Einstellungen Moin_Julias Rolle darüber ziehen.';
    await bot.prisma.ownerRoleBackup.update({ where: { id: backup.id }, data: { status: 'failed', error: message.slice(0, 300) } });
    return false;
  }
}

/** Alle Rechte außer „Administrator“ – begrenzt auf das, was Moin_Julia selbst hat (Discord-Regel) */
export function allButAdministrator(guild: Guild): bigint {
  const every = Object.values(PermissionFlagsBits).reduce((acc, bit) => acc | bit, 0n);
  return every & (guild.members?.me?.permissions.bitfield ?? every) & ~PermissionFlagsBits.Administrator;
}

/**
 * Neue Admin-Rolle anlegen. `ownerSafe` (Häkchen „Zugriff auf alles außer den Owner-Bereich“):
 * alle Einzelrechte statt „Administrator“ – so sieht die Rolle den Owner-Bereich nicht.
 */
export async function createAdminRole(bot: BotContext, guild: Guild, name: string, color: number | null, ownerSafe: boolean): Promise<Role | null> {
  const permissions = ownerSafe ? allButAdministrator(guild) : PermissionFlagsBits.Administrator;
  try {
    return await guild.roles.create({
      name,
      ...(color !== null ? { colors: { primaryColor: color } } : {}),
      permissions,
      reason: ownerSafe ? 'Owner-Bereich: Admin-Rolle ohne Zugriff auf den Owner-Bereich (Dashboard)' : 'Admin-Rolle (Dashboard)',
    });
  } catch (error) {
    bot.logger.warn({ err: error, guildId: guild.id }, 'Owner-Bereich: Admin-Rolle anlegen fehlgeschlagen');
    return null;
  }
}

/** Automatisch: Rolle hat (neu) „Administrator“ → umstellen, außer der Owner hat sie bewusst wiederhergestellt */
export async function autoReplace(bot: BotContext, role: Role): Promise<void> {
  if (role.managed || role.id === role.guild.id || !role.permissions.has(PermissionFlagsBits.Administrator)) return;
  if (!(await bot.modules.isEnabled(role.guild.id, 'owner'))) return;
  const config = await ownerConfig(bot, role.guild.id);
  if (!config.autoReplaceAdmin) return;
  const restored = await bot.prisma.ownerRoleBackup.findFirst({ where: { guildId: role.guild.id, roleId: role.id, status: 'restored' } });
  if (restored) return; // vom Owner absichtlich zurückgeholt
  if (!(await replaceAdministrator(bot, role.guild, role.id, 'auto'))) return;
  if (!config.notifyOwner) return;
  const owner = await role.guild.fetchOwner().catch(() => null);
  const locale = await bot.modules.locale(role.guild.id);
  const text =
    locale === 'en'
      ? `🔒 **${role.guild.name}**: the role **${role.name}** got “Administrator”. I replaced it with individual permissions so it can’t see your owner area (backup in the dashboard → Owner area).`
      : `🔒 **${role.guild.name}**: Die Rolle **${role.name}** hatte „Administrator“. Ich habe das durch Einzelrechte ersetzt, damit sie deinen Owner-Bereich nicht sieht (Sicherung im Dashboard → Owner-Bereich).`;
  await owner?.send({ content: text, allowedMentions: { parse: [] } }).catch(() => undefined);
}

export async function restoreRole(bot: BotContext, guild: Guild, backupId: string): Promise<void> {
  const backup = await bot.prisma.ownerRoleBackup.findFirst({ where: { id: backupId, guildId: guild.id, status: 'applied' } });
  const role = backup ? guild.roles.cache.get(backup.roleId) : undefined;
  if (!backup || !role) return;
  try {
    await role.setPermissions(BigInt(backup.permissions), 'Owner-Bereich: ursprüngliche Rechte wiederhergestellt (Dashboard)');
    await bot.prisma.ownerRoleBackup.update({ where: { id: backup.id }, data: { status: 'restored', restoredAt: new Date() } });
  } catch (error) {
    await bot.prisma.ownerRoleBackup.update({ where: { id: backup.id }, data: { error: (error instanceof Error ? error.message : String(error)).slice(0, 300) } });
  }
}

export const ownerModule: BotModule = {
  id: 'owner',
  setup({ bot, on }) {
    const inArea = async (guild: Guild, channel: { id: string; parentId?: string | null }) => {
      const config = await ownerConfig(bot, guild.id);
      return !!config.categoryId && (channel.id === config.categoryId || channel.parentId === config.categoryId);
    };
    on('channelUpdate', (_o, n) => ('guild' in n ? n.guild.id : null), (_o, n) => {
      if (!('guild' in n)) return;
      void inArea(n.guild, n).then((yes) => yes && scheduleEnforce(bot, n.guild, 'channelUpdate'));
    });
    on('channelCreate', (c) => c.guild.id, (c) => void inArea(c.guild, c).then((yes) => yes && scheduleEnforce(bot, c.guild, 'channelCreate')));
    // Neue Rolle → muss ebenfalls gesperrt werden; neue Bots → dürfen rein
    on('roleCreate', (r) => r.guild.id, (r) => {
      scheduleEnforce(bot, r.guild, 'roleCreate');
      void autoReplace(bot, r).catch((error: unknown) => bot.logger.warn({ err: error }, 'Owner-Bereich: automatisches Umstellen fehlgeschlagen'));
    });
    // Rolle bekommt „Administrator“ → (wenn eingeschaltet) sofort auf Einzelrechte umstellen
    on('roleUpdate', (_o, n) => n.guild.id, (o, n) => {
      if (!o.permissions.has(PermissionFlagsBits.Administrator) && n.permissions.has(PermissionFlagsBits.Administrator)) {
        void autoReplace(bot, n).catch((error: unknown) => bot.logger.warn({ err: error }, 'Owner-Bereich: automatisches Umstellen fehlgeschlagen'));
      }
    });
    on('guildMemberAdd', (m) => m.guild.id, (m) => m.user.bot && scheduleEnforce(bot, m.guild, 'botJoin'));
  },
  async onReady(bot) {
    for (const guild of bot.client.guilds.cache.values()) {
      if (await bot.modules.isEnabled(guild.id, 'owner')) scheduleEnforce(bot, guild, 'start');
    }
  },
  async onConfigChange(bot, guildId) {
    const guild = bot.client.guilds.cache.get(guildId);
    if (guild) scheduleEnforce(bot, guild, 'config');
  },
  async onAction(bot, guildId, action, by) {
    const guild = bot.client.guilds.cache.get(guildId);
    if (!guild) return;
    if (action === 'setup') return setup(bot, guild, by);
    if (action === 'check') {
      await enforce(bot, guild, 'manual');
      return;
    }
    const [kind, b64] = action.split(':');
    if (kind === 'deadmin' && b64) {
      await replaceAdministrator(bot, guild, b64, by);
      return;
    }
    if (kind === 'adminrole' && b64) {
      // adminrole:<Name base64url>:<1 = ohne Owner-Zugriff>:<Farbe hex oder leer>
      const [, , safe, hex] = action.split(':');
      const name = cleanRoleName(Buffer.from(b64, 'base64url').toString('utf8'));
      const color = hex && /^[0-9a-f]{6}$/i.test(hex) ? parseInt(hex, 16) : null;
      if (name) await createAdminRole(bot, guild, name, color, safe !== '0');
      return;
    }
    if (kind === 'restore' && b64) return restoreRole(bot, guild, b64);
    if ((kind === 'text' || kind === 'voice') && b64) return addChannel(bot, guild, kind, Buffer.from(b64, 'base64url').toString('utf8'));
  },
};
