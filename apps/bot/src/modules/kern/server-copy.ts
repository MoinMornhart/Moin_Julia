import { ChannelType, MessageType, PermissionFlagsBits, type Guild, type GuildBasedChannel, type Message, type Webhook } from 'discord.js';
import {
  COPY_JOB_TTL,
  COPY_MAX_FILE_BYTES,
  copiedMessageContent,
  copyJobKey,
  mapOverwrites,
  maskPermissions,
  parseLoggingConfig,
  planRoles,
  targetChannelType,
  webhookUsername,
  type CopyJob,
} from '@moin/shared';
import type { BotContext } from '../../core/types.js';

/**
 * Server kopieren (Wunsch Philip, 14.10.): Auftrag aus dem Dashboard (Redis) ausführen.
 * Reihenfolge: Rollen → Kategorien → Kanäle (mit Rechten) → Nachrichten (per Webhook mit Name/Bild der
 * ursprünglichen Person und Original-Datum). Vorhandene Rollen/Kanäle mit gleichem Namen werden mitbenutzt,
 * nie verändert. Was neu angelegt wird, merkt sich der Auftrag („wieder löschen“).
 */

const running = new Set<string>();

async function load(bot: BotContext, targetGuildId: string): Promise<CopyJob | null> {
  const raw = await bot.redis.get(copyJobKey(targetGuildId));
  return raw ? (JSON.parse(raw) as CopyJob) : null;
}

async function save(bot: BotContext, job: CopyJob): Promise<void> {
  // „Abbrechen“ aus dem Dashboard nicht überschreiben
  const current = await load(bot, job.targetGuildId).catch(() => null);
  if (current?.id === job.id && current.cancel) job.cancel = true;
  await bot.redis.set(copyJobKey(job.targetGuildId), JSON.stringify(job), 'EX', COPY_JOB_TTL);
}

class Cancelled extends Error {}

async function logTo(bot: BotContext, guild: Guild, text: string): Promise<void> {
  const config = await bot.modules.config(guild.id, 'logging', parseLoggingConfig).catch(() => null);
  const channel = config?.defaultChannelId ? guild.channels.cache.get(config.defaultChannelId) : null;
  if (channel?.isSendable()) await channel.send({ content: text, allowedMentions: { parse: [] } }).catch(() => undefined);
}

/** Auftrag starten (Dashboard → module-action „copy-start“) */
export async function runServerCopy(bot: BotContext, targetGuildId: string, by: string): Promise<void> {
  if (running.has(targetGuildId)) return;
  const job = await load(bot, targetGuildId);
  if (!job || job.status !== 'queued' || job.by !== by) return;
  running.add(targetGuildId);
  let lastSave = 0;
  const progress = async (step: string, force = false) => {
    job.step = step;
    if (!force && Date.now() - lastSave < 1500) return;
    lastSave = Date.now();
    await save(bot, job);
    if (job.cancel) throw new Cancelled();
  };
  try {
    job.status = 'running';
    await progress('Prüfe beide Server …', true);
    const source = await bot.client.guilds.fetch(job.sourceGuildId).catch(() => null);
    const target = await bot.client.guilds.fetch(job.targetGuildId).catch(() => null);
    if (!source || !target) throw new Error('Der Bot ist nicht (mehr) auf beiden Servern.');
    // Erneut prüfen: Die Person muss auf beiden Servern Owner oder Administrator sein (Rechte könnten sich geändert haben)
    for (const g of [source, target]) {
      const member = await g.members.fetch(by).catch(() => null);
      if (!member || (g.ownerId !== by && !member.permissions.has(PermissionFlagsBits.Administrator))) throw new Error(`Auf „${g.name}“ bist du nicht (mehr) Owner oder Administrator.`);
    }
    const me = await target.members.fetchMe();
    const botPerms = me.permissions.bitfield;
    const needed = [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels, ...(job.options.messages ? [PermissionFlagsBits.ManageWebhooks] : [])];
    if (!needed.every((p) => me.permissions.has(p))) throw new Error('Dem Bot fehlen auf dem Ziel-Server Rechte: Rollen verwalten, Kanäle verwalten' + (job.options.messages ? ', Webhooks verwalten' : '') + '.');

    // 1) Rollen
    const roleMap = new Map<string, string>();
    const sourceRoles = await source.roles.fetch();
    const targetRoles = await target.roles.fetch();
    const plan = planRoles(
      [...sourceRoles.values()].map((r) => ({ id: r.id, name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable, permissions: r.permissions.bitfield, position: r.position, managed: r.managed })),
      [...targetRoles.values()].filter((r) => !r.managed && r.id !== target.id).map((r) => ({ id: r.id, name: r.name })),
      source.id,
    );
    for (const item of plan) {
      if (item.reuseId) {
        roleMap.set(item.source.id, item.reuseId);
        job.counts.reusedRoles++;
        continue;
      }
      if (!job.options.roles) continue;
      await progress(`Rolle „${item.source.name}“ …`);
      try {
        const role = await target.roles.create({
          name: item.source.name,
          color: item.source.color,
          hoist: item.source.hoist,
          mentionable: item.source.mentionable,
          permissions: maskPermissions(item.source.permissions, botPerms),
          reason: `Server-Kopie von „${source.name}“ (${job.byName})`,
        });
        roleMap.set(item.source.id, role.id);
        job.created.roleIds.push(role.id);
        job.counts.roles++;
      } catch (error) {
        job.errors.push(`Rolle „${item.source.name}“: ${error instanceof Error ? error.message : 'Fehler'}`);
      }
    }

    // 2) Kategorien + Kanäle
    const channelMap = new Map<string, string>();
    if (job.options.channels) {
      const community = target.features.includes('COMMUNITY');
      const all = [...(await source.channels.fetch()).values()].filter((c): c is NonNullable<typeof c> => !!c);
      const targetChannels = [...(await target.channels.fetch()).values()].filter((c): c is NonNullable<typeof c> => !!c);
      const ids = { sourceGuildId: source.id, targetGuildId: target.id, botId: me.id };
      const overwritesOf = (c: GuildBasedChannel) =>
        'permissionOverwrites' in c ? mapOverwrites([...c.permissionOverwrites.cache.values()].map((o) => ({ id: o.id, type: o.type as 0 | 1, allow: o.allow.bitfield, deny: o.deny.bitfield })), roleMap, ids, botPerms) : [];
      const ordered = (list: GuildBasedChannel[]) => list.sort((a, b) => ('rawPosition' in a ? a.rawPosition : 0) - ('rawPosition' in b ? b.rawPosition : 0));
      const categories = ordered(all.filter((c) => c.type === ChannelType.GuildCategory));
      const rest = ordered(all.filter((c) => c.type !== ChannelType.GuildCategory));
      for (const c of [...categories, ...rest]) {
        const type = targetChannelType(c.type, community);
        if (type === null) continue;
        const parentId = c.parentId ? (channelMap.get(c.parentId) ?? null) : null;
        const existing = targetChannels.find((t) => t.name.toLowerCase() === c.name.toLowerCase() && (t.type === ChannelType.GuildCategory) === (type === 4) && (type === 4 || t.parentId === parentId));
        if (existing) {
          channelMap.set(c.id, existing.id);
          job.counts.reusedChannels++;
          continue;
        }
        await progress(`Kanal „${c.name}“ …`);
        try {
          const created = await target.channels.create({
            name: c.name,
            type: type as ChannelType.GuildText,
            parent: parentId ?? undefined,
            topic: 'topic' in c && c.topic ? c.topic.slice(0, 1024) : undefined,
            nsfw: 'nsfw' in c ? c.nsfw : undefined,
            rateLimitPerUser: 'rateLimitPerUser' in c && c.rateLimitPerUser ? c.rateLimitPerUser : undefined,
            userLimit: 'userLimit' in c && c.userLimit ? c.userLimit : undefined,
            bitrate: 'bitrate' in c && c.bitrate ? Math.min(c.bitrate, target.maximumBitrate) : undefined,
            permissionOverwrites: overwritesOf(c),
            reason: `Server-Kopie von „${source.name}“ (${job.byName})`,
          });
          channelMap.set(c.id, created.id);
          job.created.channelIds.push(created.id);
          job.counts.channels++;
        } catch (error) {
          job.errors.push(`Kanal „${c.name}“: ${error instanceof Error ? error.message : 'Fehler'}`);
        }
      }
    }

    // 3) Nachrichten
    if (job.options.messages > 0) {
      const textChannels = [...source.channels.cache.values()].filter((c) => (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) && channelMap.has(c.id));
      // Erst zählen, damit der Fortschrittsbalken stimmt
      const batches: { from: GuildBasedChannel; to: string; messages: Message[] }[] = [];
      for (const c of textChannels) {
        if (!c.isTextBased() || !c.permissionsFor(source.members.me!)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])) continue;
        await progress(`Lese #${c.name} …`);
        const messages: Message[] = [];
        let before: string | undefined;
        while (messages.length < job.options.messages) {
          const page = await c.messages.fetch({ limit: Math.min(100, job.options.messages - messages.length), before }).catch(() => null);
          if (!page?.size) break;
          messages.push(...page.values());
          before = page.last()!.id;
          if (page.size < 100) break;
        }
        const usable = messages.filter((m) => m.type === MessageType.Default || m.type === MessageType.Reply).reverse();
        job.counts.messageTotal += usable.length;
        batches.push({ from: c, to: channelMap.get(c.id)!, messages: usable });
      }
      for (const batch of batches) {
        const channel = target.channels.cache.get(batch.to);
        if (!channel || !('createWebhook' in channel) || !batch.messages.length) continue;
        let hook: Webhook | null = null;
        try {
          hook = await channel.createWebhook({ name: 'Moin_Julia Kopie', reason: `Server-Kopie von „${source.name}“` });
          for (const m of batch.messages) {
            await progress(`#${channel.name}: ${job.counts.messages + 1} / ${job.counts.messageTotal}`);
            await sendCopy(hook, m).catch((error: unknown) => job.errors.length < 50 && job.errors.push(`#${channel.name}: ${error instanceof Error ? error.message : 'Nachricht fehlgeschlagen'}`));
            job.counts.messages++;
          }
        } finally {
          await hook?.delete('Server-Kopie fertig').catch(() => undefined);
        }
      }
    }

    job.status = 'done';
    job.finishedAt = Date.now();
    await progress('Fertig ✅', true).catch(() => undefined);
    const what = `${job.counts.roles} Rollen, ${job.counts.channels} Kanäle${job.options.messages ? `, ${job.counts.messages} Nachrichten` : ''}`;
    await logTo(bot, target, `📋 <@${by}> hat „${source.name}“ hierher kopiert (${what}).`);
    await logTo(bot, source, `📋 <@${by}> hat diesen Server nach „${target.name}“ kopiert (${what}).`);
  } catch (error) {
    job.status = error instanceof Cancelled ? 'cancelled' : 'failed';
    job.finishedAt = Date.now();
    job.step = error instanceof Cancelled ? 'Abgebrochen' : error instanceof Error ? error.message : 'Fehler';
    await save(bot, job).catch(() => undefined);
    if (!(error instanceof Cancelled)) bot.logger.warn({ err: error, guildId: targetGuildId }, 'Server-Kopie fehlgeschlagen');
  } finally {
    running.delete(targetGuildId);
  }
}

/** Eine Nachricht über den Webhook nachbauen */
async function sendCopy(hook: Webhook, m: Message): Promise<void> {
  const files: { attachment: Buffer; name: string }[] = [];
  const links: string[] = [];
  for (const a of m.attachments.values()) {
    if (a.size <= COPY_MAX_FILE_BYTES && files.length < 10) {
      const res = await fetch(a.url).catch(() => null);
      if (res?.ok) {
        files.push({ attachment: Buffer.from(await res.arrayBuffer()), name: a.name });
        continue;
      }
    }
    links.push(`📎 ${a.url}`);
  }
  for (const s of m.stickers.values()) links.push(`🏷️ Sticker: ${s.name}`);
  const content = copiedMessageContent({ createdAt: m.createdTimestamp, content: m.content, edited: !!m.editedTimestamp, extra: links });
  await hook.send({
    username: webhookUsername(m.member?.displayName ?? m.author.displayName ?? m.author.username),
    avatarURL: m.member?.displayAvatarURL() ?? m.author.displayAvatarURL(),
    content,
    embeds: m.embeds.slice(0, 10).map((e) => e.toJSON()),
    files,
    allowedMentions: { parse: [] },
  });
}

/** „Angelegtes wieder löschen“ (Dashboard → „copy-undo“): erst Kanäle, dann Rollen */
export async function undoServerCopy(bot: BotContext, targetGuildId: string, by: string): Promise<void> {
  if (running.has(targetGuildId)) return;
  const job = await load(bot, targetGuildId);
  if (!job || job.status === 'running' || job.status === 'queued') return;
  const target = await bot.client.guilds.fetch(targetGuildId).catch(() => null);
  if (!target) return;
  const member = await target.members.fetch(by).catch(() => null);
  if (!member || (target.ownerId !== by && !member.permissions.has(PermissionFlagsBits.Administrator))) return;
  running.add(targetGuildId);
  try {
    job.step = 'Lösche Angelegtes …';
    await save(bot, job);
    // Unterkanäle vor Kategorien
    const channels = job.created.channelIds.map((id) => target.channels.cache.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
    for (const c of [...channels.filter((c) => c.type !== ChannelType.GuildCategory), ...channels.filter((c) => c.type === ChannelType.GuildCategory)]) await c.delete('Server-Kopie rückgängig').catch(() => undefined);
    for (const id of job.created.roleIds) await target.roles.delete(id, 'Server-Kopie rückgängig').catch(() => undefined);
    job.step = `Wieder gelöscht: ${job.created.channelIds.length} Kanäle, ${job.created.roleIds.length} Rollen 🧹`;
    job.created = { roleIds: [], channelIds: [] };
    await save(bot, job);
    await logTo(bot, target, `🧹 <@${by}> hat die Server-Kopie von „${job.sourceName}“ wieder entfernt.`);
  } finally {
    running.delete(targetGuildId);
  }
}
