import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventStatus,
  MessageFlags,
  PermissionFlagsBits,
  type Guild,
  type Message,
  type MessageActionRowComponentBuilder,
  type SendableChannels,
} from 'discord.js';
import { loadGuildSecrets, loadSettings, type Prisma } from '@moin/db';
import {
  alertTextHasPing,
  feedSchema,
  fillAlertText,
  parseFeedState,
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  platformUrl,
  statRenameAllowed,
  STAT_RENAME_WINDOW_MS,
  streamChannelName,
  t,
  type FeedData,
  type FeedState,
  type Locale,
  type Platform,
} from '@moin/shared';
import type { BotContext, BotModule } from '../../core/types.js';
import {
  decideLiveDebounced,
  formatDuration,
  infoChannelNames,
  parseWatchPage,
  parseYoutubeFeed,
  rememberSeen,
  scheduleLines,
  selectNewVideos,
  twitchThumbnail,
  youtubeFeedTitle,
  type FeedEntry,
  type LiveStream,
} from './logic.js';
import { kickStreams, twitchLatestVod, twitchSchedule, twitchStreams, twitchUserId, youtubeFeed, youtubeIsShort, youtubeWatchPage } from './platforms.js';
import { SELF_SERVICE_FORBIDDEN, safeRoleIds } from '../../core/role-safety.js';

/**
 * Social Media wie bei GalaxyBot: Twitch/Kick alle 15 Sekunden (gebündelt, ein Aufruf für alle Kanäle),
 * YouTube-Feeds alle 5 Minuten. Twitch/Kick in vier Darstellungen: klassisch (vorhandener Kanal), eigener
 * Kanal, eigene Kategorie mit Info-Kanälen oder Discord-Event. Dazu Ping-Knopf zum Selbst-Abonnieren,
 * Aufzeichnung (VoD) als Thread und Streamplan. „Offline“ gilt erst nach zwei Abfragen (kein Flackern).
 */

const ROUND_MS = 15_000;
const YOUTUBE_EVERY_MS = 5 * 60_000;
const YOUTUBE_LIVE_EVERY_MS = 2 * 60_000;
const SCHEDULE_EVERY_MS = 30 * 60_000;

type Creds = { clientId: string; secret: string };

interface Feed {
  id: string;
  guild: Guild;
  data: FeedData;
  state: FeedState;
  /** Zugangsdaten (eigene des Servers, sonst die der Instanz) */
  creds?: Creds | null;
}

const lastYoutubeFetch = new Map<string, number>();
let running = false;

function sendable(guild: Guild, channelId: string): SendableChannels | null {
  const channel = channelId ? guild.channels.cache.get(channelId) : undefined;
  return channel?.isSendable() ? channel : null;
}

/** Wohin die Live-Meldung geht: eigener Kanal (Kanal/Kategorie) oder der gewählte */
function targetChannelId(feed: Feed): string {
  if (feed.data.platform !== 'youtube' && (feed.data.display === 'channel' || feed.data.display === 'category')) return feed.state.managed.channelId;
  return feed.data.discordChannelId;
}

function pingText(data: FeedData): string {
  return data.pingRoleIds.map((r) => `<@&${r}>`).join(' ');
}

/** @everyone nur, wenn es in der VORLAGE des Admins steht – nicht, weil ein Stream-Titel es enthält */
function mentions(data: FeedData, template: string, test: boolean) {
  if (test) return { parse: [] as const, roles: [] };
  return { parse: /@everyone|@here/.test(template) ? (['everyone'] as const) : ([] as const), roles: data.pingRoleIds };
}

function liveButtons(locale: Locale, url: string, data: FeedData) {
  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(t(locale, 'alerts.watch')).setURL(url));
  const role = data.pingRoleIds[0];
  if (data.pingButton && role) row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setEmoji('🔔').setLabel(t(locale, 'alerts.pingButton')).setCustomId(`alerts:ping:${role}`));
  return row;
}

function liveEmbed(platform: Platform, data: FeedData, stream: LiveStream, url: string, locale: Locale): EmbedBuilder {
  const name = stream.displayName || data.displayName || data.channelKey;
  const embed = new EmbedBuilder()
    .setColor(PLATFORM_COLORS[platform])
    .setAuthor({ name: t(locale, 'alerts.isLive', { streamer: name, platform: PLATFORM_LABELS[platform] }).slice(0, 256), url, ...(stream.avatar ? { iconURL: stream.avatar } : {}) })
    .setTitle((stream.title || name || url).slice(0, 256))
    .setURL(url)
    .setFooter({ text: PLATFORM_LABELS[platform] })
    .setTimestamp(new Date(stream.startedAt));
  if (stream.avatar) embed.setThumbnail(stream.avatar);
  if (stream.game) embed.addFields({ name: t(locale, 'alerts.game'), value: stream.game.slice(0, 200), inline: true });
  if (stream.viewers != null) embed.addFields({ name: t(locale, 'alerts.viewers'), value: stream.viewers.toLocaleString('de-DE'), inline: true });
  if (stream.thumbnail) embed.setImage(platform === 'twitch' ? twitchThumbnail(stream.thumbnail) : stream.thumbnail);
  return embed;
}

async function postLive(bot: BotContext, feed: Feed, stream: LiveStream, url: string, opts: { test?: boolean } = {}): Promise<{ messageId: string; channelId: string } | null> {
  const channelId = targetChannelId(feed);
  // Darstellung „Event“ ohne Kanal: nur das Event, keine Nachricht
  if (!channelId && feed.data.display === 'event' && !opts.test) return null;
  const channel = sendable(feed.guild, channelId);
  if (!channel) throw new Error('Der Ziel-Kanal fehlt oder der Bot darf dort nicht schreiben.');
  const locale = await bot.modules.locale(feed.guild.id);
  const ping = opts.test ? '' : pingText(feed.data);
  const text = fillAlertText(feed.data.liveText, { streamer: stream.displayName || feed.data.displayName, title: stream.title, game: stream.game, url, ping });
  const content = [opts.test ? t(locale, 'alerts.test') : '', alertTextHasPing(feed.data.liveText) ? '' : ping, text].filter(Boolean).join('\n');
  const message = await channel.send({
    content,
    embeds: feed.data.embed ? [liveEmbed(feed.data.platform, feed.data, stream, url, locale)] : [],
    components: [liveButtons(locale, url, feed.data)],
    allowedMentions: mentions(feed.data, feed.data.liveText, !!opts.test),
  });
  // In Ankündigungskanälen auch veröffentlichen (wie GalaxyBot) – dann sehen es folgende Server
  if (!opts.test && channel.type === ChannelType.GuildAnnouncement) await message.crosspost().catch(() => undefined);
  return { messageId: message.id, channelId };
}

async function postVideo(bot: BotContext, feed: Feed, entry: FeedEntry, kind: 'video' | 'short'): Promise<void> {
  const channel = sendable(feed.guild, feed.data.discordChannelId);
  if (!channel) throw new Error('Der Ziel-Kanal fehlt oder der Bot darf dort nicht schreiben.');
  const url = kind === 'short' ? `https://www.youtube.com/shorts/${entry.videoId}` : `https://www.youtube.com/watch?v=${entry.videoId}`;
  const template = kind === 'short' ? feed.data.shortText : feed.data.videoText;
  const ping = pingText(feed.data);
  const text = fillAlertText(template, { streamer: entry.author || feed.data.displayName, title: entry.title, url, ping });
  const embed = new EmbedBuilder()
    .setColor(PLATFORM_COLORS.youtube)
    .setAuthor({ name: entry.author || feed.data.displayName || 'YouTube', url: platformUrl('youtube', feed.data.channelKey) })
    .setTitle(entry.title.slice(0, 256) || url)
    .setURL(url)
    .setImage(entry.thumbnail ?? `https://i.ytimg.com/vi/${entry.videoId}/hqdefault.jpg`);
  if (entry.published) embed.setTimestamp(new Date(entry.published));
  // Bei normalen Videos baut Discord aus dem Link selbst einen Player – das Embed nur, wenn gewünscht
  const message = await channel.send({
    content: [alertTextHasPing(template) ? '' : ping, text].filter(Boolean).join('\n'),
    embeds: feed.data.embed ? [embed] : [],
    allowedMentions: mentions(feed.data, template, false),
  });
  if (channel.type === ChannelType.GuildAnnouncement) await message.crosspost().catch(() => undefined);
}

async function setLiveRole(feed: Feed, on: boolean): Promise<void> {
  const { liveRoleId, liveMemberId } = feed.data;
  if (!liveRoleId || !liveMemberId || !feed.guild.roles.cache.has(liveRoleId)) return;
  const member = await feed.guild.members.fetch(liveMemberId).catch(() => null);
  if (!member) return;
  if (on && !member.roles.cache.has(liveRoleId) && safeRoleIds(feed.guild, [liveRoleId], SELF_SERVICE_FORBIDDEN, undefined, 'Live-Rolle').length) await member.roles.add(liveRoleId, 'Live-Rolle (Social Media)').catch(() => undefined);
  if (!on && member.roles.cache.has(liveRoleId)) await member.roles.remove(liveRoleId, 'Live-Rolle (Social Media)').catch(() => undefined);
}

// ── Eigene Kanäle (Darstellung „Kanal“ / „Kategorie“) ──────────────────────

/** Umbenennen nur, wenn Discord es erlaubt (2 pro 10 min pro Kanal) – sonst beim nächsten freien Platz */
async function renameBudgeted(feed: Feed, channelId: string, name: string): Promise<void> {
  const channel = channelId ? feed.guild.channels.cache.get(channelId) : undefined;
  if (!channel || channel.isThread() || channel.name === name) return;
  const now = Date.now();
  const history = (feed.state.managed.renames[channelId] ?? []).filter((at) => now - at < STAT_RENAME_WINDOW_MS);
  if (!statRenameAllowed(history, now)) return;
  feed.state.managed.renames[channelId] = [...history, now];
  await channel.setName(name, 'Social Media (Live-Status)').catch(() => undefined);
}

/** Kanal/Kategorie anlegen, falls noch nicht da (oder gelöscht) */
async function ensureManaged(feed: Feed): Promise<void> {
  if (feed.data.platform === 'youtube' || (feed.data.display !== 'channel' && feed.data.display !== 'category')) return;
  const m = feed.state.managed;
  const exists = (id: string) => !!id && feed.guild.channels.cache.has(id);
  const name = feed.data.displayName || feed.data.channelKey;
  const url = platformUrl(feed.data.platform, feed.data.channelKey);
  if (feed.data.display === 'category' && !exists(m.categoryId)) {
    const category = await feed.guild.channels.create({ name: `📺 ${name}`.slice(0, 100), type: ChannelType.GuildCategory, reason: 'Social Media: Kategorie' });
    m.categoryId = category.id;
    m.channelId = '';
    m.titleChannelId = m.uptimeChannelId = m.viewersChannelId = '';
  }
  const parent = feed.data.display === 'category' ? m.categoryId : (feed.guild.channels.cache.get(feed.data.discordChannelId)?.parentId ?? undefined);
  if (!exists(m.channelId)) {
    const channel = await feed.guild.channels.create({ name: streamChannelName(name, false), type: ChannelType.GuildText, parent, topic: `${PLATFORM_LABELS[feed.data.platform]}: ${url}`, reason: 'Social Media: Stream-Kanal' });
    m.channelId = channel.id;
  }
  if (feed.data.display === 'category') {
    // Info-Kanäle: Sprachkanäle, die niemand betreten kann – der Name ist die Anzeige
    const deny = [{ id: feed.guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect] }];
    const names = infoChannelNames(null);
    for (const key of ['titleChannelId', 'uptimeChannelId', 'viewersChannelId'] as const) {
      if (exists(m[key])) continue;
      const label = key === 'titleChannelId' ? names.title : key === 'uptimeChannelId' ? names.uptime : names.viewers;
      const channel = await feed.guild.channels.create({ name: label, type: ChannelType.GuildVoice, parent: m.categoryId, permissionOverwrites: deny, reason: 'Social Media: Info-Kanal' });
      m[key] = channel.id;
    }
  }
}

/** Kanalname und Info-Kanäle auf den aktuellen Stand (live oder offline) */
async function refreshManaged(feed: Feed): Promise<void> {
  if (feed.data.platform === 'youtube' || (feed.data.display !== 'channel' && feed.data.display !== 'category')) return;
  const m = feed.state.managed;
  const name = feed.data.displayName || feed.data.channelKey;
  await renameBudgeted(feed, m.channelId, streamChannelName(name, !!feed.state.live));
  if (feed.data.display !== 'category') return;
  const names = infoChannelNames(feed.state.live ? { title: feed.state.live.title, startedAt: feed.state.live.startedAt, viewers: feed.state.live.viewers } : null);
  await renameBudgeted(feed, m.titleChannelId, names.title);
  await renameBudgeted(feed, m.uptimeChannelId, names.uptime);
  await renameBudgeted(feed, m.viewersChannelId, names.viewers);
}

// ── Discord-Event (Darstellung „Event“) ─────────────────────────────────────

async function startEvent(feed: Feed, stream: LiveStream, url: string): Promise<void> {
  if (feed.data.platform === 'youtube' || feed.data.display !== 'event') return;
  const name = stream.displayName || feed.data.displayName || feed.data.channelKey;
  const event = await feed.guild.scheduledEvents.create({
    name: (stream.title || `${name} ist live`).slice(0, 100),
    description: `🔴 ${name} ist live auf ${PLATFORM_LABELS[feed.data.platform]}${stream.game ? ` – ${stream.game}` : ''}\n${url}`.slice(0, 1000),
    // Startzeit muss in der Zukunft liegen – danach sofort starten
    scheduledStartTime: new Date(Date.now() + 5_000),
    scheduledEndTime: new Date(Date.now() + 12 * 3_600_000),
    privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
    entityType: GuildScheduledEventEntityType.External,
    entityMetadata: { location: url },
    reason: 'Social Media: Stream live',
  });
  feed.state.managed.eventId = event.id;
  await event.setStatus(GuildScheduledEventStatus.Active).catch(() => undefined);
}

async function endEvent(feed: Feed): Promise<void> {
  const id = feed.state.managed.eventId;
  if (!id) return;
  feed.state.managed.eventId = '';
  const event = await feed.guild.scheduledEvents.fetch(id).catch(() => null);
  if (!event) return;
  if (event.status === GuildScheduledEventStatus.Active) await event.setStatus(GuildScheduledEventStatus.Completed).catch(() => undefined);
  else if (event.status === GuildScheduledEventStatus.Scheduled) await event.delete().catch(() => undefined);
}

// ── Aufzeichnung (VoD) als Thread ───────────────────────────────────────────

async function postVod(bot: BotContext, feed: Feed, message: Message | null, live: NonNullable<FeedState['live']>): Promise<void> {
  if (feed.data.platform !== 'twitch' || !feed.data.vodThread || !live.userId || !feed.creds) return;
  const vod = await twitchLatestVod(live.userId, feed.creds).catch(() => null);
  if (!vod) return;
  const locale = await bot.modules.locale(feed.guild.id);
  const date = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(live.startedAt));
  const name = `🎬 ${t(locale, 'alerts.vod')} ${date} – ${live.title || feed.data.displayName}`.slice(0, 100);
  const channel = message?.channel ?? feed.guild.channels.cache.get(live.channelId);
  const thread = message?.startThread
    ? await message.startThread({ name, reason: 'Social Media: Aufzeichnung' }).catch(() => null)
    : channel && 'threads' in channel && channel.type === ChannelType.GuildText
      ? await channel.threads.create({ name, reason: 'Social Media: Aufzeichnung' }).catch(() => null)
      : null;
  await thread?.send({ content: `${vod.title ? `**${vod.title.slice(0, 200)}**\n` : ''}${vod.url}`, allowedMentions: { parse: [] } }).catch(() => undefined);
}

// ── Live-Ablauf ─────────────────────────────────────────────────────────────

async function endLive(bot: BotContext, feed: Feed): Promise<void> {
  const live = feed.state.live;
  if (!live) return;
  await setLiveRole(feed, false);
  await endEvent(feed);
  const channel = live.channelId ? feed.guild.channels.cache.get(live.channelId) : undefined;
  const message = channel?.isTextBased() && live.messageId ? await channel.messages.fetch(live.messageId).catch(() => null) : null;
  if (feed.data.endMode !== 'delete') await postVod(bot, feed, message, live);
  else await postVod(bot, feed, null, live);
  if (message && feed.data.endMode === 'delete') await message.delete().catch(() => undefined);
  if (message && feed.data.endMode === 'edit') {
    const locale = await bot.modules.locale(feed.guild.id);
    const name = feed.data.displayName || feed.data.channelKey;
    const duration = formatDuration(Date.now() - Date.parse(live.startedAt));
    const embed = new EmbedBuilder()
      .setColor(0x4f5660)
      .setTitle(t(locale, 'alerts.wasLive', { streamer: name }).slice(0, 256))
      .setDescription(live.title ? live.title.slice(0, 300) : null)
      .addFields({ name: t(locale, 'alerts.duration'), value: duration, inline: true })
      .setTimestamp(new Date(live.startedAt));
    if (live.game) embed.addFields({ name: t(locale, 'alerts.game'), value: live.game.slice(0, 200), inline: true });
    await message.edit({ content: t(locale, 'alerts.wasLive', { streamer: `**${name}**` }), embeds: feed.data.embed ? [embed] : [], allowedMentions: { parse: [] } }).catch(() => undefined);
  }
  feed.state.live = null;
  await refreshManaged(feed);
}

async function handleLive(bot: BotContext, feed: Feed, stream: LiveStream | null, url: string): Promise<void> {
  const { decision, misses } = decideLiveDebounced(feed.state, stream);
  feed.state.misses = misses;
  if (decision === 'none') {
    if (stream && feed.state.live) {
      feed.state.live.title = stream.title;
      feed.state.live.game = stream.game;
      feed.state.live.viewers = stream.viewers;
    }
    await refreshManaged(feed);
    return;
  }
  if (decision === 'end' || decision === 'restart') await endLive(bot, feed);
  if (stream && (decision === 'start' || decision === 'restart')) {
    await ensureManaged(feed);
    const posted = await postLive(bot, feed, stream, url);
    feed.state.live = {
      streamId: stream.id,
      startedAt: stream.startedAt,
      title: stream.title,
      game: stream.game,
      messageId: posted?.messageId ?? '',
      channelId: posted?.channelId ?? '',
      userId: stream.userId ?? '',
      viewers: stream.viewers,
    };
    await startEvent(feed, stream, url).catch((error: unknown) => bot.logger.warn({ err: error, guildId: feed.guild.id }, 'Social Media: Event konnte nicht erstellt werden'));
    await setLiveRole(feed, true);
    await refreshManaged(feed);
  }
}

async function handleYoutube(bot: BotContext, feed: Feed, xml: string, now: Date): Promise<void> {
  const entries = parseYoutubeFeed(xml);
  if (!feed.data.displayName) feed.data.displayName = youtubeFeedTitle(xml);
  if (!feed.state.initialized) {
    feed.state.seen = rememberSeen([], entries.map((e) => e.videoId));
    feed.state.initialized = true;
    return;
  }
  const handled: string[] = [];
  // „Gesehen“ auch merken, wenn mittendrin etwas schiefgeht – sonst würde ein schon geposteter Titel
  // bei jeder Runde erneut gepostet, solange der Fehler beim nächsten besteht
  try {
    for (const entry of selectNewVideos(feed.state, entries, now)) {
      const page = parseWatchPage(await youtubeWatchPage(entry.videoId).catch(() => ''));
      if (page.upcoming && !page.liveNow) continue; // geplanter Stream: später nochmal ansehen
      handled.push(entry.videoId);
      if (page.liveNow) {
        if (!feed.data.notifyLive) continue;
        // YouTube: kein Flackern möglich (Seite wird direkt geprüft) – sofort starten
        feed.state.misses = 0;
        await handleLive(bot, feed, { id: entry.videoId, title: entry.title, game: '', viewers: null, startedAt: now.toISOString(), thumbnail: entry.thumbnail, displayName: entry.author }, `https://www.youtube.com/watch?v=${entry.videoId}`);
        continue;
      }
      const short = await youtubeIsShort(entry.videoId);
      if (short ? feed.data.notifyShorts : feed.data.notifyVideos) await postVideo(bot, feed, entry, short ? 'short' : 'video');
    }
  } finally {
    feed.state.seen = rememberSeen(feed.state.seen, handled);
  }
}

/** YouTube-Livestream noch aktiv? */
async function checkYoutubeLive(bot: BotContext, feed: Feed): Promise<void> {
  if (!feed.state.live) return;
  const html = await youtubeWatchPage(feed.state.live.streamId);
  if (!parseWatchPage(html).liveNow) await endLive(bot, feed);
}

/**
 * Nur den Prüf-Stand schreiben. Die Einstellungen (data) gehören dem Dashboard – sonst würde eine Änderung,
 * die während einer Prüf-Runde gespeichert wird, mit dem alten Stand überschrieben. Einzige Ausnahme: der
 * Anzeigename, wenn er bisher fehlte.
 */
async function saveFeed(bot: BotContext, feed: Feed, error: string | null): Promise<void> {
  const fresh = await bot.prisma.socialFeed.findUnique({ where: { id: feed.id }, select: { data: true } });
  if (!fresh) return; // inzwischen gelöscht
  const current = (fresh.data ?? {}) as Record<string, unknown>;
  const nameMissing = !current.displayName && !!feed.data.displayName;
  await bot.prisma.socialFeed.updateMany({
    where: { id: feed.id },
    data: {
      state: feed.state as unknown as Prisma.InputJsonValue,
      ...(nameMissing ? { data: { ...current, displayName: feed.data.displayName } as Prisma.InputJsonValue } : {}),
      lastCheckedAt: new Date(),
      lastError: error,
    },
  });
}

async function activeFeeds(bot: BotContext): Promise<Feed[]> {
  const rows = await bot.prisma.socialFeed.findMany();
  const feeds: Feed[] = [];
  for (const row of rows) {
    const guild = bot.client.guilds.cache.get(row.guildId);
    if (!guild || !(await bot.modules.isEnabled(guild.id, 'alerts'))) continue;
    const data = feedSchema.safeParse(row.data);
    if (!data.success || data.data.paused) continue;
    // Kanal/Kategorie/Event brauchen keinen vorhandenen Kanal
    if (!data.data.discordChannelId && (data.data.platform === 'youtube' || data.data.display === 'classic')) continue;
    feeds.push({ id: row.id, guild, data: data.data, state: parseFeedState(row.state) });
  }
  return feeds;
}

/** Eigene Zugangsdaten des Servers, sonst die der Instanz */
async function credsFor(bot: BotContext, platform: 'twitch' | 'kick', guildId: string, instance: Creds | null, cache: Map<string, Creds | null>): Promise<Creds | null> {
  const key = `${platform}:${guildId}`;
  if (cache.has(key)) return cache.get(key)!;
  const own = await loadGuildSecrets(bot.prisma, guildId).catch(() => null);
  const id = platform === 'twitch' ? own?.twitchClientId : own?.kickClientId;
  const secret = platform === 'twitch' ? own?.twitchClientSecret : own?.kickClientSecret;
  const creds = id && secret ? { clientId: id, secret } : instance;
  cache.set(key, creds);
  return creds;
}

async function streamRound(bot: BotContext, platform: 'twitch' | 'kick', feeds: Feed[]): Promise<void> {
  if (!feeds.length) return;
  const settings = await loadSettings(bot.prisma);
  const clientId = platform === 'twitch' ? settings.twitchClientId : settings.kickClientId;
  const secret = platform === 'twitch' ? settings.twitchClientSecret : settings.kickClientSecret;
  const instance = clientId && secret ? { clientId, secret } : null;
  const cache = new Map<string, Creds | null>();
  // Nach Zugangsdaten gruppieren – eine Abfrage pro Zugang für alle seine Kanäle
  const groups = new Map<string, { creds: Creds; feeds: Feed[] }>();
  for (const feed of feeds) {
    feed.creds = await credsFor(bot, platform, feed.guild.id, instance, cache);
    if (!feed.creds) {
      await saveFeed(bot, feed, `${PLATFORM_LABELS[platform]} ist noch nicht verbunden – im Dashboard unter Social Media → Verbindungen einrichten.`);
      continue;
    }
    const group = groups.get(feed.creds.clientId) ?? { creds: feed.creds, feeds: [] };
    group.feeds.push(feed);
    groups.set(feed.creds.clientId, group);
  }
  for (const { creds, feeds: list } of groups.values()) {
    let streams: Map<string, LiveStream>;
    try {
      const keys = [...new Set(list.map((f) => f.data.channelKey))];
      streams = platform === 'twitch' ? await twitchStreams(keys, creds) : await kickStreams(keys, creds);
    } catch (error) {
      // Abfrage gescheitert → nichts beenden, nur Fehler merken
      for (const feed of list) await saveFeed(bot, feed, error instanceof Error ? error.message : String(error));
      continue;
    }
    for (const feed of list) {
      let error: string | null = null;
      try {
        await handleLive(bot, feed, streams.get(feed.data.channelKey) ?? null, platformUrl(platform, feed.data.channelKey));
        if (platform === 'twitch') await scheduleRound(bot, feed);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
      await saveFeed(bot, feed, error);
    }
  }
}

/** Streamplan (Twitch) alle 30 Minuten im gewählten Kanal aktualisieren */
async function scheduleRound(bot: BotContext, feed: Feed, force = false): Promise<void> {
  if (!feed.data.scheduleChannelId || !feed.creds) return;
  const m = feed.state.managed;
  if (!force && Date.now() - m.scheduleAt < SCHEDULE_EVERY_MS) return;
  m.scheduleAt = Date.now();
  const channel = sendable(feed.guild, feed.data.scheduleChannelId);
  if (!channel) return;
  if (!m.broadcasterId) m.broadcasterId = (await twitchUserId(feed.data.channelKey, feed.creds)) ?? '';
  if (!m.broadcasterId) return;
  const locale = await bot.modules.locale(feed.guild.id);
  const name = feed.data.displayName || feed.data.channelKey;
  const embed = new EmbedBuilder()
    .setColor(PLATFORM_COLORS.twitch)
    .setTitle(t(locale, 'alerts.schedule', { streamer: name }).slice(0, 256))
    .setURL(`https://www.twitch.tv/${feed.data.channelKey}/schedule`)
    .setDescription(scheduleLines(await twitchSchedule(m.broadcasterId, feed.creds)).slice(0, 4000))
    .setTimestamp(new Date());
  const old = m.scheduleMessageId && channel.isTextBased() ? await channel.messages.fetch(m.scheduleMessageId).catch(() => null) : null;
  if (old) await old.edit({ embeds: [embed] });
  else m.scheduleMessageId = (await channel.send({ embeds: [embed], allowedMentions: { parse: [] } })).id;
}

async function youtubeRound(bot: BotContext, feeds: Feed[], now: Date): Promise<void> {
  const byChannel = new Map<string, Feed[]>();
  for (const feed of feeds) byChannel.set(feed.data.channelKey, [...(byChannel.get(feed.data.channelKey) ?? []), feed]);
  for (const [channelId, list] of byChannel) {
    const anyLive = list.some((f) => f.state.live);
    const due = now.getTime() - (lastYoutubeFetch.get(channelId) ?? 0) >= (anyLive ? YOUTUBE_LIVE_EVERY_MS : YOUTUBE_EVERY_MS);
    const fresh = list.some((f) => !f.state.initialized);
    if (!due && !fresh) continue;
    lastYoutubeFetch.set(channelId, now.getTime());
    let xml: string;
    try {
      xml = await youtubeFeed(channelId);
    } catch (error) {
      for (const feed of list) await saveFeed(bot, feed, error instanceof Error ? error.message : String(error));
      continue;
    }
    for (const feed of list) {
      let error: string | null = null;
      try {
        await checkYoutubeLive(bot, feed);
        await handleYoutube(bot, feed, xml, now);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
      await saveFeed(bot, feed, error);
    }
  }
}

export async function alertsRound(bot: BotContext): Promise<void> {
  if (running) return;
  running = true;
  try {
    const feeds = await activeFeeds(bot);
    const now = new Date();
    await streamRound(bot, 'twitch', feeds.filter((f) => f.data.platform === 'twitch'));
    await streamRound(bot, 'kick', feeds.filter((f) => f.data.platform === 'kick'));
    await youtubeRound(bot, feeds.filter((f) => f.data.platform === 'youtube'), now);
  } finally {
    running = false;
  }
}

/** Test-Meldung aus dem Dashboard: zeigt, wie es aussehen wird (ohne Pings) */
async function sendTest(bot: BotContext, guild: Guild, feedId: string): Promise<void> {
  const row = await bot.prisma.socialFeed.findFirst({ where: { id: feedId, guildId: guild.id } });
  const data = row ? feedSchema.safeParse(row.data) : null;
  if (!row || !data?.success) return;
  const feed: Feed = { id: row.id, guild, data: data.data, state: parseFeedState(row.state) };
  const name = data.data.displayName || data.data.channelKey;
  const url = platformUrl(data.data.platform, data.data.channelKey);
  try {
    await ensureManaged(feed);
    await postLive(bot, feed, { id: 'test', title: 'Test-Stream – so sieht deine Live-Meldung aus', game: 'Just Chatting', viewers: 42, startedAt: new Date().toISOString(), thumbnail: null, displayName: name }, url, { test: true });
    await bot.prisma.socialFeed.updateMany({ where: { id: row.id }, data: { lastError: null, state: feed.state as unknown as Prisma.InputJsonValue } });
  } catch (error) {
    await bot.prisma.socialFeed.updateMany({ where: { id: row.id }, data: { lastError: error instanceof Error ? error.message : String(error) } });
  }
}

/** 🔔-Knopf: Mitglied holt sich die Ping-Rolle bzw. gibt sie zurück – nur Rollen, die ein Feed hier pingt */
async function onPingButton(bot: BotContext, interaction: Parameters<NonNullable<BotModule['onComponent']>>[0]['interaction'], roleId: string, locale: Locale): Promise<void> {
  if (!interaction.isButton()) return;
  const guild = interaction.guild;
  const feeds = await bot.prisma.socialFeed.findMany({ where: { guildId: guild.id }, select: { data: true } });
  const allowed = feeds.some((f) => ((f.data as { pingRoleIds?: string[] }).pingRoleIds ?? []).includes(roleId));
  const safe = allowed && safeRoleIds(guild, [roleId], SELF_SERVICE_FORBIDDEN, bot.logger, 'Ping-Rolle').length > 0;
  if (!safe) return void (await interaction.reply({ content: t(locale, 'alerts.pingUnavailable'), flags: MessageFlags.Ephemeral }));
  const member = interaction.member;
  const has = member.roles.cache.has(roleId);
  try {
    if (has) await member.roles.remove(roleId, 'Social Media: Benachrichtigung aus');
    else await member.roles.add(roleId, 'Social Media: Benachrichtigung an');
  } catch {
    return void (await interaction.reply({ content: t(locale, 'alerts.pingUnavailable'), flags: MessageFlags.Ephemeral }));
  }
  await interaction.reply({ content: t(locale, has ? 'alerts.pingOff' : 'alerts.pingOn', { role: `<@&${roleId}>` }), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
}

export const alertsModule: BotModule = {
  id: 'alerts',
  onReady(bot) {
    const run = () => void alertsRound(bot).catch((error: unknown) => bot.logger.warn({ err: error }, 'Social-Media-Runde fehlgeschlagen'));
    setInterval(run, ROUND_MS).unref();
    setTimeout(run, 10_000).unref();
  },
  async onComponent({ interaction, action, args, locale, bot }) {
    if (action === 'ping' && args[0]) return onPingButton(bot, interaction, args[0], locale);
  },
  async onAction(bot, guildId, action) {
    const guild = bot.client.guilds.cache.get(guildId);
    if (!guild) return;
    const [kind, id] = action.split(':');
    if (kind === 'test' && id) return sendTest(bot, guild, id);
    if (kind === 'check') {
      lastYoutubeFetch.clear();
      return alertsRound(bot);
    }
  },
};
