import { AttachmentBuilder, ChannelType, type GuildBasedChannel, type Message, type PartialMessage } from 'discord.js';
import type { BotModule, ModuleSetup } from '../../core/types.js';
import {
  bulkDeletedEmbed,
  bulkTranscript,
  channelEmbed,
  diffChannel,
  diffGuild,
  diffIds,
  diffRole,
  inviteEmbed,
  memberJoinedEmbed,
  memberLeftEmbed,
  messageDeletedEmbed,
  messageEditedEmbed,
  moderationEmbed,
  nickChangedEmbed,
  roleEmbed,
  rolesChangedEmbed,
  serverUpdatedEmbed,
  timeoutEmbed,
  voiceEmbed,
  type ChannelSnapshot,
} from './embeds.js';
import { AuditLogEvent, findAudit, logChannelIds, loggingConfig, sendLog, userRef } from './send.js';

function channelSnapshot(channel: GuildBasedChannel): ChannelSnapshot {
  const c = channel as GuildBasedChannel & { topic?: string | null; nsfw?: boolean; rateLimitPerUser?: number | null };
  return {
    name: channel.name,
    topic: c.topic ?? null,
    nsfw: c.nsfw ?? false,
    slowmode: c.rateLimitPerUser ?? 0,
    parentId: channel.parentId,
  };
}

/** Prüft, ob ein Nachrichten-Ereignis geloggt werden soll (ignorierte Kanäle, Bots, Log-Kanäle selbst). */
async function shouldLogMessage({ bot }: ModuleSetup, message: Message | PartialMessage) {
  if (!message.guildId) return null;
  const config = await loggingConfig(bot, message.guildId);
  if (config.ignoredChannelIds.includes(message.channelId)) return null;
  if (logChannelIds(config).has(message.channelId)) return null;
  if (config.ignoreBots && message.author?.bot) return null;
  if (message.author?.id === bot.client.user?.id) return null;
  return config;
}

function setup(ctx: ModuleSetup): void {
  const { bot, on } = ctx;
  const now = () => new Date();

  // ── Nachrichten ───────────────────────────────────────────────────────────
  on('messageDelete', (m) => m.guildId, async (message) => {
    const config = await shouldLogMessage(ctx, message);
    if (!config || !message.guild) return;
    const locale = await bot.modules.locale(message.guildId);
    await sendLog(bot, message.guild, 'messages', {
      embeds: [
        messageDeletedEmbed({
          locale,
          author: message.author ? userRef(message.author) : null,
          channelId: message.channelId,
          messageId: message.id,
          content: message.partial ? null : message.content,
          attachments: message.attachments.map((a) => a.name),
          now: now(),
        }),
      ],
    }, config);
  });

  on('messageUpdate', (_old, m) => m.guildId, async (before, after) => {
    if (!after.guild) return;
    const message = after.partial ? await after.fetch().catch(() => null) : after;
    if (!message) return;
    // Discord meldet auch Link-Vorschauen als „bearbeitet“ – nur echte Textänderungen loggen
    if (!before.partial && before.content === message.content) return;
    if (before.partial && !message.editedTimestamp) return;
    const config = await shouldLogMessage(ctx, message);
    if (!config) return;
    const locale = await bot.modules.locale(message.guildId);
    await sendLog(bot, message.guild!, 'messages', {
      embeds: [
        messageEditedEmbed({
          locale,
          author: userRef(message.author),
          channelId: message.channelId,
          messageId: message.id,
          url: message.url,
          before: before.partial ? null : before.content,
          after: message.content,
          now: now(),
        }),
      ],
    }, config);
  });

  on('messageDeleteBulk', (_messages, channel) => channel.guildId, async (messages, channel) => {
    const config = await loggingConfig(bot, channel.guildId);
    if (config.ignoredChannelIds.includes(channel.id) || logChannelIds(config).has(channel.id)) return;
    const locale = await bot.modules.locale(channel.guildId);
    const transcript = bulkTranscript(
      [...messages.values()].map((m) => ({
        createdAt: new Date(m.createdTimestamp),
        authorTag: m.author?.tag ?? null,
        content: m.partial ? null : m.content,
        attachments: m.attachments.map((a) => a.name),
      })),
    );
    const file = new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: `geloescht-${channel.name}.txt` });
    await sendLog(bot, channel.guild, 'messages', {
      embeds: [bulkDeletedEmbed({ locale, channelId: channel.id, count: messages.size, now: now() })],
      files: [file],
    }, config);
  });

  // ── Mitglieder ────────────────────────────────────────────────────────────
  on('guildMemberAdd', (m) => m.guild.id, async (member) => {
    const locale = await bot.modules.locale(member.guild.id);
    await sendLog(bot, member.guild, 'members', {
      embeds: [
        memberJoinedEmbed({
          locale,
          user: userRef(member.user),
          accountCreated: member.user.createdAt,
          memberCount: member.guild.memberCount,
          now: now(),
        }),
      ],
    });
  });

  on('guildMemberRemove', (m) => m.guild.id, async (member) => {
    const locale = await bot.modules.locale(member.guild.id);
    const user = userRef(member.user);
    // Ban? Dann loggt guildBanAdd. Kick? Dann als Moderation loggen.
    const ban = await findAudit(member.guild, AuditLogEvent.MemberBanAdd, member.id);
    if (ban) return;
    const kick = await findAudit(member.guild, AuditLogEvent.MemberKick, member.id);
    if (kick) {
      await sendLog(bot, member.guild, 'moderation', {
        embeds: [moderationEmbed({ locale, kind: 'kick', user, moderator: kick.executor, reason: kick.reason, now: now() })],
      });
      return;
    }
    await sendLog(bot, member.guild, 'members', {
      embeds: [
        memberLeftEmbed({
          locale,
          user,
          joinedAt: member.joinedAt,
          roleIds: member.partial ? [] : member.roles.cache.filter((r) => r.id !== member.guild.id).map((r) => r.id),
          now: now(),
        }),
      ],
    });
  });

  on('guildMemberUpdate', (_old, m) => m.guild.id, async (before, after) => {
    const locale = await bot.modules.locale(after.guild.id);
    const user = userRef(after.user);

    if (!before.partial) {
      const { added, removed } = diffIds(
        [...before.roles.cache.keys()].filter((id) => id !== after.guild.id),
        [...after.roles.cache.keys()].filter((id) => id !== after.guild.id),
      );
      if (added.length || removed.length) {
        const audit = await findAudit(after.guild, AuditLogEvent.MemberRoleUpdate, after.id);
        await sendLog(bot, after.guild, 'memberUpdates', {
          embeds: [rolesChangedEmbed({ locale, user, added, removed, moderator: audit?.executor ?? null, now: now() })],
        });
      }
      if (before.nickname !== after.nickname) {
        await sendLog(bot, after.guild, 'memberUpdates', {
          embeds: [nickChangedEmbed({ locale, user, before: before.nickname, after: after.nickname, now: now() })],
        });
      }
    }

    const wasTimedOut = !before.partial && before.isCommunicationDisabled();
    const isTimedOut = after.isCommunicationDisabled();
    if (wasTimedOut !== isTimedOut || (isTimedOut && before.communicationDisabledUntilTimestamp !== after.communicationDisabledUntilTimestamp)) {
      const audit = await findAudit(after.guild, AuditLogEvent.MemberUpdate, after.id);
      await sendLog(bot, after.guild, 'memberUpdates', {
        embeds: [
          timeoutEmbed({
            locale,
            user,
            until: isTimedOut ? after.communicationDisabledUntil : null,
            moderator: audit?.executor ?? null,
            reason: audit?.reason ?? null,
            now: now(),
          }),
        ],
      });
    }
  });

  on('guildBanAdd', (b) => b.guild.id, async (ban) => {
    const locale = await bot.modules.locale(ban.guild.id);
    const audit = await findAudit(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    await sendLog(bot, ban.guild, 'moderation', {
      embeds: [
        moderationEmbed({
          locale,
          kind: 'ban',
          user: userRef(ban.user),
          moderator: audit?.executor ?? null,
          reason: audit?.reason ?? ban.reason ?? null,
          now: now(),
        }),
      ],
    });
  });

  on('guildBanRemove', (b) => b.guild.id, async (ban) => {
    const locale = await bot.modules.locale(ban.guild.id);
    const audit = await findAudit(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    await sendLog(bot, ban.guild, 'moderation', {
      embeds: [moderationEmbed({ locale, kind: 'unban', user: userRef(ban.user), moderator: audit?.executor ?? null, reason: null, now: now() })],
    });
  });

  // ── Kanäle ────────────────────────────────────────────────────────────────
  on('channelCreate', (c) => c.guild.id, async (channel) => {
    const locale = await bot.modules.locale(channel.guild.id);
    const audit = await findAudit(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
    await sendLog(bot, channel.guild, 'channels', {
      embeds: [channelEmbed({ locale, kind: 'created', channelId: channel.id, name: channel.name, moderator: audit?.executor ?? null, now: now() })],
    });
  });

  on('channelDelete', (c) => (c.type === ChannelType.DM ? null : c.guild.id), async (channel) => {
    if (channel.type === ChannelType.DM) return;
    const locale = await bot.modules.locale(channel.guild.id);
    const audit = await findAudit(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
    await sendLog(bot, channel.guild, 'channels', {
      embeds: [channelEmbed({ locale, kind: 'deleted', channelId: channel.id, name: channel.name, moderator: audit?.executor ?? null, now: now() })],
    });
  });

  on('channelUpdate', (_o, c) => (c.type === ChannelType.DM ? null : c.guild.id), async (before, after) => {
    if (before.type === ChannelType.DM || after.type === ChannelType.DM) return;
    const locale = await bot.modules.locale(after.guild.id);
    const changes = diffChannel(locale, channelSnapshot(before), channelSnapshot(after));
    if (!changes.length) return; // z. B. nur Position oder Rechte verschoben
    const audit = await findAudit(after.guild, AuditLogEvent.ChannelUpdate, after.id);
    await sendLog(bot, after.guild, 'channels', {
      embeds: [channelEmbed({ locale, kind: 'updated', channelId: after.id, name: after.name, changes, moderator: audit?.executor ?? null, now: now() })],
    });
  });

  // ── Rollen ────────────────────────────────────────────────────────────────
  on('roleCreate', (r) => r.guild.id, async (role) => {
    if (role.managed) return;
    const locale = await bot.modules.locale(role.guild.id);
    const audit = await findAudit(role.guild, AuditLogEvent.RoleCreate, role.id);
    await sendLog(bot, role.guild, 'roles', {
      embeds: [roleEmbed({ locale, kind: 'created', roleId: role.id, name: role.name, color: role.color, moderator: audit?.executor ?? null, now: now() })],
    });
  });

  on('roleDelete', (r) => r.guild.id, async (role) => {
    const locale = await bot.modules.locale(role.guild.id);
    const audit = await findAudit(role.guild, AuditLogEvent.RoleDelete, role.id);
    await sendLog(bot, role.guild, 'roles', {
      embeds: [roleEmbed({ locale, kind: 'deleted', roleId: role.id, name: role.name, color: role.color, moderator: audit?.executor ?? null, now: now() })],
    });
  });

  on('roleUpdate', (_o, r) => r.guild.id, async (before, after) => {
    const locale = await bot.modules.locale(after.guild.id);
    const snap = (r: typeof after) => ({
      name: r.name,
      color: r.color,
      hoist: r.hoist,
      mentionable: r.mentionable,
      permissions: r.permissions.toArray().join(', ') || '–',
    });
    const changes = diffRole(locale, snap(before), snap(after));
    if (!changes.length) return;
    const audit = await findAudit(after.guild, AuditLogEvent.RoleUpdate, after.id);
    await sendLog(bot, after.guild, 'roles', {
      embeds: [
        roleEmbed({ locale, kind: 'updated', roleId: after.id, name: after.name, color: after.color, changes, moderator: audit?.executor ?? null, now: now() }),
      ],
    });
  });

  // ── Voice ─────────────────────────────────────────────────────────────────
  on('voiceStateUpdate', (_o, s) => s.guild.id, async (before, after) => {
    const member = after.member ?? before.member;
    if (!member || member.user.bot) return;
    const locale = await bot.modules.locale(after.guild.id);
    const embed = voiceEmbed({ locale, user: userRef(member.user), from: before.channelId, to: after.channelId, now: now() });
    if (embed) await sendLog(bot, after.guild, 'voice', { embeds: [embed] });
  });

  // ── Server & Einladungen ──────────────────────────────────────────────────
  on('guildUpdate', (_o, g) => g.id, async (before, after) => {
    const locale = await bot.modules.locale(after.id);
    const snap = (g: typeof after) => ({
      name: g.name,
      icon: g.icon,
      banner: g.banner,
      description: g.description,
      verificationLevel: g.verificationLevel,
    });
    const changes = diffGuild(snap(before), snap(after));
    if (!changes.length) return;
    const audit = await findAudit(after, AuditLogEvent.GuildUpdate, after.id);
    await sendLog(bot, after, 'server', { embeds: [serverUpdatedEmbed({ locale, changes, moderator: audit?.executor ?? null, now: now() })] });
  });

  on('inviteCreate', (i) => i.guild?.id, async (invite) => {
    const guild = invite.guild && 'members' in invite.guild ? invite.guild : null;
    if (!guild) return;
    const locale = await bot.modules.locale(guild.id);
    await sendLog(bot, guild, 'server', {
      embeds: [
        inviteEmbed({
          locale,
          kind: 'created',
          code: invite.code,
          channelId: invite.channelId,
          inviter: invite.inviter ? userRef(invite.inviter) : null,
          maxUses: invite.maxUses,
          expiresAt: invite.expiresAt,
          now: now(),
        }),
      ],
    });
  });

  on('inviteDelete', (i) => i.guild?.id, async (invite) => {
    const guild = invite.guild && 'members' in invite.guild ? invite.guild : null;
    if (!guild) return;
    const locale = await bot.modules.locale(guild.id);
    await sendLog(bot, guild, 'server', {
      embeds: [inviteEmbed({ locale, kind: 'deleted', code: invite.code, channelId: invite.channelId, inviter: null, maxUses: null, expiresAt: null, now: now() })],
    });
  });
}

export const loggingModule: BotModule = { id: 'logging', setup };
