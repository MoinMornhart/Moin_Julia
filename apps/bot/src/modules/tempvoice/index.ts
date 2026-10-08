import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type OverwriteResolvable,
  type VoiceChannel,
  type VoiceState,
} from 'discord.js';
import type { Prisma } from '@moin/db';
import { parseTempVoiceConfig, t, tempVoiceName, type TempVoiceConfig, type TempVoiceHub } from '@moin/shared';
import type { BotContext, BotModule, ComponentContext } from '../../core/types.js';
import { hubFor, joinDecision, mayControl, ownerRoleChanges, parseLimit } from './logic.js';
import { buildPanel, limitModal, renameModal, userPicker } from './panel.js';
import { SELF_SERVICE_FORBIDDEN, safeRoleIds } from '../../core/role-safety.js';

/**
 * Eigene Sprachkanäle („Join to Create“): Erstell-Kanal betreten → eigener Kanal + Bedienfeld.
 * Leere Kanäle werden nach `deleteAfterSec` gelöscht – auch nach einem Bot-Neustart (Datenbank).
 */

const deleteTimers = new Map<string, NodeJS.Timeout>();

function tempVoiceConfig(bot: BotContext, guildId: string): Promise<TempVoiceConfig> {
  return bot.modules.config(guildId, 'tempvoice', parseTempVoiceConfig);
}

function voiceChannel(guild: Guild, id: string): VoiceChannel | null {
  const c = guild.channels.cache.get(id);
  return c?.type === ChannelType.GuildVoice ? c : null;
}

/** Besitzer-Rollen geben bzw. entziehen, je nachdem ob jemand (noch) einen eigenen Kanal besitzt */
async function syncOwnerRoles(bot: BotContext, guild: Guild, config: TempVoiceConfig, userId: string): Promise<void> {
  if (!config.ownerRoleIds.length) return;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;
  const owns = (await bot.prisma.tempVoiceChannel.count({ where: { guildId: guild.id, ownerId: userId } })) > 0;
  const change = ownerRoleChanges(config.ownerRoleIds, owns, [...member.roles.cache.keys()], [...guild.roles.cache.keys()]);
  const add = safeRoleIds(guild, change.add, SELF_SERVICE_FORBIDDEN, bot.logger, 'Eigener Sprachkanal');
  if (add.length) await member.roles.add(add, 'Eigener Sprachkanal').catch(() => undefined);
  if (change.remove.length) await member.roles.remove(change.remove, 'Kein eigener Sprachkanal mehr').catch(() => undefined);
}

async function createFor(bot: BotContext, member: GuildMember, hub: TempVoiceHub, config: TempVoiceConfig): Promise<void> {
  const guild = member.guild;
  const existing = await bot.prisma.tempVoiceChannel.findFirst({ where: { guildId: guild.id, ownerId: member.id } });
  const decision = joinDecision(existing ? { channelId: existing.channelId, exists: Boolean(voiceChannel(guild, existing.channelId)) } : null);
  if (decision.kind === 'move') {
    await member.voice.setChannel(decision.channelId).catch(() => undefined);
    return;
  }
  if (existing) await bot.prisma.tempVoiceChannel.delete({ where: { channelId: existing.channelId } }).catch(() => undefined);

  const hubChannel = voiceChannel(guild, hub.channelId);
  const parentId = hub.categoryId ?? hubChannel?.parentId ?? null;
  const parent = parentId ? guild.channels.cache.get(parentId) : null;
  const me = guild.members.me!;
  // Rechte der Kategorie übernehmen, dazu: Besitzer:in darf alles im eigenen Kanal, der Bot auch
  const overwrites: OverwriteResolvable[] = [];
  if (parent && 'permissionOverwrites' in parent) {
    // Nur Rechte übernehmen, die der Bot selbst hat – andere darf er laut Discord nicht setzen (ohne Administrator)
    const own = me.permissions.bitfield;
    for (const o of parent.permissionOverwrites.cache.values()) overwrites.push({ id: o.id, allow: o.allow.bitfield & own, deny: o.deny.bitfield & own, type: o.type });
  }
  overwrites.push(
    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream] },
    { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers] },
  );
  if (hub.startLocked) overwrites.push({ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect] });

  const count = (await bot.prisma.tempVoiceChannel.count({ where: { guildId: guild.id } })) + 1;
  let channel: VoiceChannel;
  try {
    channel = await guild.channels.create({
      name: tempVoiceName(hub.nameTemplate, { user: member.displayName, count }),
      type: ChannelType.GuildVoice,
      parent: parentId ?? undefined,
      userLimit: hub.userLimit,
      permissionOverwrites: overwrites,
      reason: `Eigener Sprachkanal für ${member.user.tag}`,
    });
  } catch (error) {
    bot.logger.warn({ err: error, guildId: guild.id }, 'Eigener Sprachkanal: anlegen fehlgeschlagen (Rechte?)');
    return;
  }
  await bot.prisma.tempVoiceChannel.create({ data: { channelId: channel.id, guildId: guild.id, ownerId: member.id, hubId: hub.channelId } });
  const moved = await member.voice.setChannel(channel).then(
    () => true,
    () => false,
  );
  if (!moved) {
    // Schon wieder weg? Dann gleich aufräumen.
    await removeChannel(bot, guild, channel.id);
    return;
  }
  await syncOwnerRoles(bot, guild, config, member.id);
  if (config.panel) {
    const locale = await bot.modules.locale(guild.id);
    await channel.send(buildPanel(locale, channel.id, member.id)).catch(() => undefined);
  }
}

async function removeChannel(bot: BotContext, guild: Guild, channelId: string): Promise<void> {
  deleteTimers.delete(channelId);
  const row = await bot.prisma.tempVoiceChannel.findUnique({ where: { channelId } });
  const channel = voiceChannel(guild, channelId);
  if (channel && channel.members.size > 0) return;
  if (channel) await channel.delete('Eigener Sprachkanal ist leer').catch(() => undefined);
  if (row) {
    await bot.prisma.tempVoiceChannel.delete({ where: { channelId } }).catch(() => undefined);
    await syncOwnerRoles(bot, guild, await tempVoiceConfig(bot, guild.id), row.ownerId);
  }
}

function scheduleDelete(bot: BotContext, guild: Guild, channelId: string, seconds: number): void {
  clearTimeout(deleteTimers.get(channelId));
  if (seconds <= 0) {
    void removeChannel(bot, guild, channelId);
    return;
  }
  deleteTimers.set(
    channelId,
    setTimeout(() => void removeChannel(bot, guild, channelId), seconds * 1000),
  );
}

async function onVoice(bot: BotContext, before: VoiceState, after: VoiceState): Promise<void> {
  const guild = after.guild;
  const config = await tempVoiceConfig(bot, guild.id);
  if (after.channelId && after.channelId !== before.channelId) {
    clearTimeout(deleteTimers.get(after.channelId));
    deleteTimers.delete(after.channelId);
    const hub = hubFor(config, after.channelId);
    if (hub && after.member && !after.member.user.bot) await createFor(bot, after.member, hub, config);
  }
  if (before.channelId && before.channelId !== after.channelId) {
    const left = voiceChannel(guild, before.channelId);
    if (left && left.members.size === 0 && (await bot.prisma.tempVoiceChannel.findUnique({ where: { channelId: before.channelId } }))) {
      scheduleDelete(bot, guild, before.channelId, config.deleteAfterSec);
    }
  }
}

/** Nach einem Neustart: verwaiste Einträge entfernen und leere Kanäle aufräumen */
async function cleanup(bot: BotContext): Promise<void> {
  const rows = await bot.prisma.tempVoiceChannel.findMany();
  for (const row of rows) {
    const guild = bot.client.guilds.cache.get(row.guildId);
    if (!guild) continue;
    const channel = voiceChannel(guild, row.channelId);
    if (!channel || channel.members.size === 0) await removeChannel(bot, guild, row.channelId);
  }
}

// ── Bedienfeld ──────────────────────────────────────────────────────────────

async function onComponent(ctx: ComponentContext): Promise<void> {
  const { interaction, action, args, locale, bot } = ctx;
  const channelId = args[0] ?? '';
  const reply = (content: string) =>
    interaction.replied || interaction.deferred ? interaction.followUp({ content, flags: MessageFlags.Ephemeral }) : interaction.reply({ content, flags: MessageFlags.Ephemeral });

  const row = await bot.prisma.tempVoiceChannel.findUnique({ where: { channelId } });
  const channel = voiceChannel(interaction.guild, channelId);
  if (!row || !channel) {
    await reply(t(locale, 'tempvoice.gone'));
    return;
  }
  const base = action.replace(/-(pick|submit)$/, '');
  const check = mayControl(base, row.ownerId, interaction.user.id, channel.members.has(row.ownerId));
  if (check !== 'ok') {
    await reply(t(locale, check === 'owner-here' ? 'tempvoice.claimOwnerHere' : 'tempvoice.notOwner', { owner: `<@${row.ownerId}>` }));
    return;
  }
  const config = await tempVoiceConfig(bot, interaction.guildId);
  const everyone = interaction.guild.roles.everyone.id;

  try {
    switch (action) {
      case 'rename':
        if (interaction.isButton()) await interaction.showModal(renameModal(locale, channelId, channel.name));
        return;
      case 'rename-submit': {
        if (!interaction.isModalSubmit()) return;
        const name = interaction.fields.getTextInputValue('name').trim().slice(0, 100);
        const done = await Promise.race([channel.setName(name).then(() => true), new Promise<boolean>((r) => setTimeout(() => r(false), 4000))]);
        await reply(done ? t(locale, 'tempvoice.renamed', { name }) : t(locale, 'tempvoice.renameSlow'));
        return;
      }
      case 'limit':
        if (interaction.isButton()) await interaction.showModal(limitModal(locale, channelId, channel.userLimit));
        return;
      case 'limit-submit': {
        if (!interaction.isModalSubmit()) return;
        const limit = parseLimit(interaction.fields.getTextInputValue('limit'));
        if (limit === null) return void (await reply(t(locale, 'tempvoice.limitInvalid')));
        await channel.setUserLimit(limit);
        await reply(limit ? t(locale, 'tempvoice.limitSet', { limit }) : t(locale, 'tempvoice.limitNone'));
        return;
      }
      case 'lock': {
        const locked = channel.permissionOverwrites.cache.get(everyone)?.deny.has(PermissionFlagsBits.Connect) ?? false;
        await channel.permissionOverwrites.edit(everyone, { Connect: locked ? null : false });
        await reply(t(locale, locked ? 'tempvoice.unlocked' : 'tempvoice.locked'));
        return;
      }
      case 'hide': {
        const hidden = channel.permissionOverwrites.cache.get(everyone)?.deny.has(PermissionFlagsBits.ViewChannel) ?? false;
        await channel.permissionOverwrites.edit(everyone, { ViewChannel: hidden ? null : false });
        await reply(t(locale, hidden ? 'tempvoice.shown' : 'tempvoice.hidden'));
        return;
      }
      case 'invite':
      case 'kick':
      case 'transfer':
        if (interaction.isButton()) await interaction.reply({ components: userPicker(locale, action, channelId), flags: MessageFlags.Ephemeral });
        return;
      case 'invite-pick': {
        if (!interaction.isUserSelectMenu()) return;
        for (const id of interaction.values) await channel.permissionOverwrites.edit(id, { ViewChannel: true, Connect: true });
        await reply(t(locale, 'tempvoice.invited', { users: interaction.values.map((id) => `<@${id}>`).join(', ') }));
        return;
      }
      case 'kick-pick': {
        if (!interaction.isUserSelectMenu()) return;
        const targets = interaction.values.filter((id) => id !== row.ownerId);
        if (!targets.length) return void (await reply(t(locale, 'tempvoice.kickSelf')));
        for (const id of targets) {
          await channel.permissionOverwrites.edit(id, { Connect: false });
          const m = channel.members.get(id);
          if (m) await m.voice.disconnect('Aus eigenem Sprachkanal geworfen').catch(() => undefined);
        }
        await reply(t(locale, 'tempvoice.kicked', { users: targets.map((id) => `<@${id}>`).join(', ') }));
        return;
      }
      case 'transfer-pick': {
        if (!interaction.isUserSelectMenu()) return;
        const target = interaction.users.first();
        if (!target || target.bot) return void (await reply(t(locale, 'tempvoice.transferBot')));
        await setOwner(bot, interaction.guild, config, channel, row.ownerId, target.id);
        await reply(t(locale, 'tempvoice.transferred', { user: `<@${target.id}>` }));
        return;
      }
      case 'claim':
        await setOwner(bot, interaction.guild, config, channel, row.ownerId, interaction.user.id);
        await reply(t(locale, 'tempvoice.claimed'));
        return;
    }
  } catch (error) {
    bot.logger.warn({ err: error, channelId }, 'Eigener Sprachkanal: Aktion fehlgeschlagen');
    await reply(t(locale, 'tempvoice.noPermission')).catch(() => undefined);
  }
}

async function setOwner(bot: BotContext, guild: Guild, config: TempVoiceConfig, channel: VoiceChannel, oldOwner: string, newOwner: string): Promise<void> {
  if (oldOwner === newOwner) return;
  await channel.permissionOverwrites.edit(newOwner, { ViewChannel: true, Connect: true, Speak: true, Stream: true });
  await bot.prisma.tempVoiceChannel.update({ where: { channelId: channel.id }, data: { ownerId: newOwner } });
  await syncOwnerRoles(bot, guild, config, oldOwner);
  await syncOwnerRoles(bot, guild, config, newOwner);
}

// ── Aufträge aus dem Dashboard ──────────────────────────────────────────────

/** „Erstell-Kanal anlegen“: Kategorie + „➕ Kanal erstellen“ anlegen und als Erstell-Kanal eintragen */
async function createHub(bot: BotContext, guildId: string): Promise<void> {
  const guild = bot.client.guilds.cache.get(guildId);
  if (!guild) return;
  const category = await guild.channels.create({ name: '🎙️ Eigene Sprachkanäle', type: ChannelType.GuildCategory, reason: 'Moin_Julia: eigene Sprachkanäle' });
  const hub = await guild.channels.create({ name: '➕ Kanal erstellen', type: ChannelType.GuildVoice, parent: category.id, reason: 'Moin_Julia: Erstell-Kanal' });
  const row = await bot.prisma.guildModule.findUnique({ where: { guildId_moduleId: { guildId, moduleId: 'tempvoice' } } });
  const config = parseTempVoiceConfig(row?.config);
  config.hubs = [...config.hubs, { channelId: hub.id, categoryId: category.id, nameTemplate: '🔊 {user}s Kanal', userLimit: 0, startLocked: false }].slice(0, 5);
  await bot.prisma.guildModule.upsert({
    where: { guildId_moduleId: { guildId, moduleId: 'tempvoice' } },
    create: { guildId, moduleId: 'tempvoice', enabled: true, config: config as unknown as Prisma.InputJsonValue },
    update: { config: config as unknown as Prisma.InputJsonValue },
  });
  bot.modules.invalidate(guildId);
}

export const tempvoiceModule: BotModule = {
  id: 'tempvoice',
  setup({ bot, on }) {
    on('voiceStateUpdate', (_before, after) => after.guild.id, (before, after) => onVoice(bot, before, after));
  },
  onReady: (bot) => cleanup(bot),
  onComponent,
  async onAction(bot, guildId, action) {
    if (action === 'create-hub') await createHub(bot, guildId).catch((error: unknown) => bot.logger.warn({ err: error, guildId }, 'Erstell-Kanal anlegen fehlgeschlagen'));
  },
};
