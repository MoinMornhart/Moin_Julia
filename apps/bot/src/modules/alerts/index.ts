import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type Guild, type MessageActionRowComponentBuilder, type SendableChannels } from 'discord.js';
import { loadSettings, type Prisma } from '@moin/db';
import { feedSchema, fillAlertText, parseFeedState, PLATFORM_COLORS, platformUrl, t, type FeedData, type FeedState, type Locale, type Platform } from '@moin/shared';
import type { BotContext, BotModule } from '../../core/types.js';
import { decideLive, formatDuration, parseWatchPage, parseYoutubeFeed, rememberSeen, selectNewVideos, twitchThumbnail, youtubeFeedTitle, type FeedEntry, type LiveStream } from './logic.js';
import { kickStreams, twitchStreams, youtubeFeed, youtubeIsShort, youtubeWatchPage } from './platforms.js';
import { SELF_SERVICE_FORBIDDEN, safeRoleIds } from '../../core/role-safety.js';

/**
 * Social Media: fragt jede Minute Twitch/Kick ab (gebündelt, ein Aufruf für alle Kanäle) und alle
 * 5 Minuten die YouTube-Feeds. Meldungen gehen in den eingestellten Kanal; nach dem Stream wird die
 * Meldung je nach Einstellung in „war live“ umgewandelt, gelöscht oder stehen gelassen.
 */

const ROUND_MS = 60_000;
const YOUTUBE_EVERY_MS = 5 * 60_000;
const YOUTUBE_LIVE_EVERY_MS = 2 * 60_000;

interface Feed {
  id: string;
  guild: Guild;
  data: FeedData;
  state: FeedState;
}

const lastYoutubeFetch = new Map<string, number>();
let running = false;

function sendable(guild: Guild, channelId: string): SendableChannels | null {
  const channel = channelId ? guild.channels.cache.get(channelId) : undefined;
  return channel?.isSendable() ? channel : null;
}

function pingPrefix(data: FeedData): string {
  return data.pingRoleIds.map((r) => `<@&${r}>`).join(' ');
}

/** @everyone nur, wenn es in der VORLAGE des Admins steht – nicht, weil ein Stream-Titel es enthält */
function mentions(data: FeedData, template: string, test: boolean) {
  if (test) return { parse: [] as const, roles: [] };
  return { parse: /@everyone|@here/.test(template) ? (['everyone'] as const) : ([] as const), roles: data.pingRoleIds };
}

function watchRow(locale: Locale, url: string) {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(t(locale, 'alerts.watch')).setURL(url));
}

function liveEmbed(platform: Platform, data: FeedData, stream: LiveStream, url: string, locale: Locale): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(PLATFORM_COLORS[platform])
    .setAuthor({ name: stream.displayName || data.displayName || data.channelKey, url, ...(stream.avatar ? { iconURL: stream.avatar } : {}) })
    .setTitle((stream.title || stream.displayName || url).slice(0, 256))
    .setURL(url)
    .setTimestamp(new Date(stream.startedAt));
  if (stream.game) embed.addFields({ name: t(locale, 'alerts.game'), value: stream.game.slice(0, 200), inline: true });
  if (stream.viewers != null) embed.addFields({ name: t(locale, 'alerts.viewers'), value: String(stream.viewers), inline: true });
  if (stream.thumbnail) embed.setImage(platform === 'twitch' ? twitchThumbnail(stream.thumbnail) : stream.thumbnail);
  return embed;
}

async function postLive(bot: BotContext, feed: Feed, stream: LiveStream, url: string, opts: { test?: boolean } = {}): Promise<string> {
  const channel = sendable(feed.guild, feed.data.discordChannelId);
  if (!channel) throw new Error('Der Ziel-Kanal fehlt oder der Bot darf dort nicht schreiben.');
  const locale = await bot.modules.locale(feed.guild.id);
  const text = fillAlertText(feed.data.liveText, { streamer: stream.displayName || feed.data.displayName, title: stream.title, game: stream.game, url });
  const content = [opts.test ? t(locale, 'alerts.test') : '', opts.test ? '' : pingPrefix(feed.data), text].filter(Boolean).join('\n');
  const message = await channel.send({
    content,
    embeds: feed.data.embed ? [liveEmbed(feed.data.platform, feed.data, stream, url, locale)] : [],
    components: [watchRow(locale, url)],
    allowedMentions: mentions(feed.data, feed.data.liveText, !!opts.test),
  });
  return message.id;
}

async function postVideo(bot: BotContext, feed: Feed, entry: FeedEntry, kind: 'video' | 'short'): Promise<void> {
  const channel = sendable(feed.guild, feed.data.discordChannelId);
  if (!channel) throw new Error('Der Ziel-Kanal fehlt oder der Bot darf dort nicht schreiben.');
  const locale = await bot.modules.locale(feed.guild.id);
  const url = kind === 'short' ? `https://www.youtube.com/shorts/${entry.videoId}` : `https://www.youtube.com/watch?v=${entry.videoId}`;
  const text = fillAlertText(kind === 'short' ? feed.data.shortText : feed.data.videoText, { streamer: entry.author || feed.data.displayName, title: entry.title, url });
  const embed = new EmbedBuilder()
    .setColor(PLATFORM_COLORS.youtube)
    .setAuthor({ name: entry.author || feed.data.displayName || 'YouTube', url: platformUrl('youtube', feed.data.channelKey) })
    .setTitle(entry.title.slice(0, 256) || url)
    .setURL(url)
    .setImage(entry.thumbnail ?? `https://i.ytimg.com/vi/${entry.videoId}/hqdefault.jpg`);
  if (entry.published) embed.setTimestamp(new Date(entry.published));
  // Bei normalen Videos baut Discord aus dem Link selbst einen Player – das Embed nur, wenn gewünscht
  await channel.send({
    content: [pingPrefix(feed.data), text].filter(Boolean).join('\n'),
    embeds: feed.data.embed ? [embed] : [],
    allowedMentions: mentions(feed.data, kind === 'short' ? feed.data.shortText : feed.data.videoText, false),
  });
  void locale;
}

async function setLiveRole(feed: Feed, on: boolean): Promise<void> {
  const { liveRoleId, liveMemberId } = feed.data;
  if (!liveRoleId || !liveMemberId || !feed.guild.roles.cache.has(liveRoleId)) return;
  const member = await feed.guild.members.fetch(liveMemberId).catch(() => null);
  if (!member) return;
  if (on && !member.roles.cache.has(liveRoleId) && safeRoleIds(feed.guild, [liveRoleId], SELF_SERVICE_FORBIDDEN, undefined, 'Live-Rolle').length) await member.roles.add(liveRoleId, 'Live-Rolle (Social Media)').catch(() => undefined);
  if (!on && member.roles.cache.has(liveRoleId)) await member.roles.remove(liveRoleId, 'Live-Rolle (Social Media)').catch(() => undefined);
}

async function endLive(bot: BotContext, feed: Feed): Promise<void> {
  const live = feed.state.live;
  if (!live) return;
  await setLiveRole(feed, false);
  const channel = live.channelId ? feed.guild.channels.cache.get(live.channelId) : undefined;
  const message = channel?.isTextBased() && live.messageId ? await channel.messages.fetch(live.messageId).catch(() => null) : null;
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
}

async function handleLive(bot: BotContext, feed: Feed, stream: LiveStream | null, url: string): Promise<void> {
  const decision = decideLive(feed.state, stream);
  if (decision === 'none') {
    if (stream && feed.state.live) {
      feed.state.live.title = stream.title;
      feed.state.live.game = stream.game;
    }
    return;
  }
  if (decision === 'end' || decision === 'restart') await endLive(bot, feed);
  if (stream && (decision === 'start' || decision === 'restart')) {
    const messageId = await postLive(bot, feed, stream, url);
    feed.state.live = { streamId: stream.id, startedAt: stream.startedAt, title: stream.title, game: stream.game, messageId, channelId: feed.data.discordChannelId };
    await setLiveRole(feed, true);
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
    if (!data.success || data.data.paused || !data.data.discordChannelId) continue;
    feeds.push({ id: row.id, guild, data: data.data, state: parseFeedState(row.state) });
  }
  return feeds;
}

async function streamRound(bot: BotContext, platform: 'twitch' | 'kick', feeds: Feed[]): Promise<void> {
  if (!feeds.length) return;
  const settings = await loadSettings(bot.prisma);
  const clientId = platform === 'twitch' ? settings.twitchClientId : settings.kickClientId;
  const secret = platform === 'twitch' ? settings.twitchClientSecret : settings.kickClientSecret;
  if (!clientId || !secret) {
    const label = platform === 'twitch' ? 'Twitch' : 'Kick';
    for (const feed of feeds) await saveFeed(bot, feed, `${label} ist noch nicht verbunden – im Dashboard unter Social Media → Verbindungen einrichten.`);
    return;
  }
  let streams: Map<string, LiveStream>;
  try {
    const keys = [...new Set(feeds.map((f) => f.data.channelKey))];
    streams = platform === 'twitch' ? await twitchStreams(keys, { clientId, secret }) : await kickStreams(keys, { clientId, secret });
  } catch (error) {
    // Abfrage gescheitert → nichts beenden, nur Fehler merken
    for (const feed of feeds) await saveFeed(bot, feed, error instanceof Error ? error.message : String(error));
    return;
  }
  for (const feed of feeds) {
    let error: string | null = null;
    try {
      await handleLive(bot, feed, streams.get(feed.data.channelKey) ?? null, platformUrl(platform, feed.data.channelKey));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    await saveFeed(bot, feed, error);
  }
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
    await postLive(bot, feed, { id: 'test', title: 'Test-Stream – so sieht deine Live-Meldung aus', game: 'Just Chatting', viewers: 42, startedAt: new Date().toISOString(), thumbnail: null, displayName: name }, url, { test: true });
    await bot.prisma.socialFeed.update({ where: { id: row.id }, data: { lastError: null } });
  } catch (error) {
    await bot.prisma.socialFeed.update({ where: { id: row.id }, data: { lastError: error instanceof Error ? error.message : String(error) } });
  }
}

export const alertsModule: BotModule = {
  id: 'alerts',
  onReady(bot) {
    const run = () => void alertsRound(bot).catch((error: unknown) => bot.logger.warn({ err: error }, 'Social-Media-Runde fehlgeschlagen'));
    setInterval(run, ROUND_MS).unref();
    setTimeout(run, 10_000).unref();
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
