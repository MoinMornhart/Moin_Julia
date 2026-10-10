import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  type Guild,
  type GuildMember,
  type Message,
  type MessageActionRowComponentBuilder,
  type SendableChannels,
} from 'discord.js';
import { loadSettings, type Prisma } from '@moin/db';
import {
  formatClock,
  isMusicEffect,
  isYtdlpUrl,
  LIKED_PLAYLIST,
  LOOP_MODES,
  lyricsWindow,
  MUSIC_EFFECT_IDS,
  MUSIC_EFFECTS,
  musicLastQueueKey,
  parseMusicConfig,
  parseTime,
  PLAYLIST_MAX_TRACKS,
  progressBar,
  streamingLinkKind,
  t,
  titleFromUrl,
  TRACK_KINDS,
  type Locale,
  type LoopMode,
  type MusicConfig,
  type TranslationKey,
} from '@moin/shared';
import type { BotContext, BotModule, CommandContext, SlashCommand } from '../../core/types.js';
import { findLyrics } from './lyrics.js';
import { GuildMusic } from './player.js';
import type { Track } from './queue.js';
import { getStation, searchStations, vetUrl } from './source.js';
import { streamingLinkQuery, ytResolve, ytSearch, ytSelfUpdate } from './youtube.js';

/**
 * Musik wie Euphony: YouTube/SoundCloud (nur mit Freigabe des Instanz-Admins, eigenes Risiko),
 * Spotify-/Apple-Links (werden auf YouTube gesucht), Internet-Radio und Audio-Links.
 * Warteschlange, Effekte, Autoplay, 24/7, Vote-Skip, Playlists, Lieblingssongs, Liedtexte, Wiederherstellen.
 * Steuerung per /musik, Steuer-Panel mit Knöpfen und aus dem Dashboard.
 */

function musicConfig(bot: BotContext, guildId: string): Promise<MusicConfig> {
  return bot.modules.config(guildId, 'musik', parseMusicConfig);
}

/** YouTube erlaubt? (Instanz-Einstellung, 30 s zwischengespeichert) */
let ytCache: { at: number; on: boolean } | null = null;
async function youtubeAllowed(bot: BotContext): Promise<boolean> {
  if (ytCache && Date.now() - ytCache.at < 30_000) return ytCache.on;
  const on = (await loadSettings(bot.prisma).catch(() => null))?.musicYoutube === 'true';
  ytCache = { at: Date.now(), on };
  return on;
}

const players = new Map<string, GuildMusic>();
const panels = new Map<string, Message>();
const panelTimers = new Map<string, NodeJS.Timeout>();

function d(key: TranslationKey) {
  return { de: t('de', key), loc: { 'en-US': t('en', key), 'en-GB': t('en', key) } };
}
const en = (name: string) => ({ 'en-US': name, 'en-GB': name });

/** DJ: „Server verwalten“ oder DJ-Rolle */
function isDj(member: GuildMember, config: Pick<MusicConfig, 'djRoleIds'>): boolean {
  return member.permissions.has(PermissionFlagsBits.ManageGuild) || config.djRoleIds.some((r) => member.roles.cache.has(r));
}

/** Steuern dürfen: „Server verwalten“, DJ-Rolle – oder (ohne DJ-Rollen) alle im selben Sprachkanal */
export function canControl(member: GuildMember, config: Pick<MusicConfig, 'djRoleIds'>, botChannelId: string | null): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (config.djRoleIds.length) return config.djRoleIds.some((r) => member.roles.cache.has(r));
  return !botChannelId || member.voice.channelId === botChannelId;
}

/** Wie viele Stimmen braucht Vote-Skip? 2/3 der Zuhörer (aufgerundet) */
export function votesNeeded(listeners: number): number {
  return Math.max(1, Math.ceil((listeners * 2) / 3));
}

async function getPlayer(bot: BotContext, guild: Guild, locale: Locale): Promise<GuildMusic> {
  let gm = players.get(guild.id);
  if (!gm) {
    const config = await musicConfig(bot, guild.id);
    gm = new GuildMusic(bot, guild, config.defaultVolume, config.leaveAfterSeconds * 1000, (kind, track) => {
      const channel = panels.get(guild.id)?.channel;
      if (!channel?.isSendable()) return;
      const text = kind === 'left' ? t(locale, 'music.left') : kind === 'autoplay' ? t(locale, 'music.autoplayNext', { title: track?.title ?? '?' }) : t(locale, 'music.error', { title: track?.title ?? '?' });
      void channel.send({ content: text, allowedMentions: { parse: [] } }).catch(() => undefined);
    });
    applyConfig(gm, config);
    gm.youtubeAllowed = () => youtubeAllowed(bot);
    gm.setListener(() => schedulePanelUpdate(guild.id, locale));
    players.set(guild.id, gm);
  }
  return gm;
}

function applyConfig(gm: GuildMusic, config: MusicConfig): void {
  gm.autoplay = config.autoplay;
  gm.stay247 = config.stay247;
  gm.leaveAfterMs = config.leaveAfterSeconds * 1000;
  if (config.stay247) gm.cancelLeave();
}

// ── Steuer-Panel ────────────────────────────────────────────────────────────
const KIND_LABEL: Record<(typeof TRACK_KINDS)[number], TranslationKey> = { radio: 'music.radio', file: 'music.file', youtube: 'music.youtube' };

function panelPayload(gm: GuildMusic, locale: Locale) {
  const s = gm.state();
  const embed = new EmbedBuilder().setColor(0x2fd1b8);
  if (!s.current) {
    embed.setDescription(t(locale, 'music.nothing'));
  } else {
    const position = gm.position();
    embed
      .setAuthor({ name: `${t(locale, 'music.nowPlaying')} · ${t(locale, KIND_LABEL[s.current.kind])}` })
      .setTitle(s.current.title.slice(0, 256))
      .addFields(
        { name: t(locale, 'music.requestedBy'), value: `<@${s.current.requestedBy}>`, inline: true },
        { name: t(locale, 'music.volume'), value: `${s.volume} %`, inline: true },
        { name: t(locale, 'music.loop'), value: t(locale, `music.loop.${s.loop}` as TranslationKey), inline: true },
      );
    if (/^https?:\/\//.test(s.current.url) && s.current.kind === 'youtube') embed.setURL(s.current.url);
    if (s.current.thumbnail) embed.setThumbnail(s.current.thumbnail);
    if (s.current.author) embed.setDescription(`👤 ${s.current.author.slice(0, 100)}`);
    const extras = [s.effect ? `${MUSIC_EFFECTS[s.effect].emoji} ${MUSIC_EFFECTS[s.effect][locale]}` : null, s.autoplay ? `✨ ${t(locale, 'music.autoplay')}` : null, gm.stay247 ? `🕒 ${t(locale, 'music.stay247')}` : null].filter(Boolean);
    if (extras.length) embed.addFields({ name: t(locale, 'music.effect'), value: extras.join(' · '), inline: false });
    if (s.current.kind !== 'radio' && s.current.durationMs) {
      embed.addFields({ name: '​', value: `${progressBar(position, s.current.durationMs)}  \`${formatClock(position)} / ${formatClock(s.current.durationMs)}\`${s.paused ? ' ⏸' : ''}` });
    } else if (s.current.kind !== 'radio') embed.setFooter({ text: `⏱ ${formatClock(position)}${s.paused ? ' · ⏸' : ''}` });
    else if (s.paused) embed.setFooter({ text: '⏸' });
    if (s.queue.length) {
      embed.addFields({
        name: `${t(locale, 'music.upNext')} (${gm.queue.upcoming.length})`,
        value: s.queue
          .slice(0, 5)
          .map((q, i) => `${i + 1}. ${q.title.slice(0, 60)}${q.durationMs ? ` \`${formatClock(q.durationMs)}\`` : ''}`)
          .join('\n'),
      });
    }
  }
  const btn = (id: string, emoji: string, style = ButtonStyle.Secondary, disabled = false) => new ButtonBuilder().setCustomId(`musik:btn:${id}`).setEmoji(emoji).setStyle(style).setDisabled(disabled);
  const idle = !s.current;
  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    btn('back', '⏮️', ButtonStyle.Secondary, !gm.queue.history.length),
    btn('pause', s.paused ? '▶️' : '⏸️', ButtonStyle.Primary, idle),
    btn('skip', '⏭️', ButtonStyle.Secondary, idle),
    btn('stop', '⏹️', ButtonStyle.Danger, idle && !s.channelId),
    btn('loop', '🔁', s.loop === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success, idle),
  );
  const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    btn('shuffle', '🔀', ButtonStyle.Secondary, gm.queue.upcoming.length < 2),
    btn('voldown', '🔉', ButtonStyle.Secondary, idle),
    btn('volup', '🔊', ButtonStyle.Secondary, idle),
    btn('like', '❤️', ButtonStyle.Secondary, idle),
    btn('lyrics', '📜', ButtonStyle.Secondary, idle || s.current?.kind === 'radio'),
  );
  const fx = new StringSelectMenuBuilder()
    .setCustomId('musik:fx')
    .setPlaceholder(t(locale, 'music.effectPlaceholder'))
    .setDisabled(idle)
    .addOptions(
      { label: t(locale, 'music.effectNone'), value: 'aus', emoji: '✖️', default: !s.effect },
      ...MUSIC_EFFECT_IDS.map((id) => ({ label: MUSIC_EFFECTS[id][locale], value: id, emoji: MUSIC_EFFECTS[id].emoji, default: s.effect === id })),
    );
  const row3 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(fx);
  return { embeds: [embed], components: [row, row2, row3], allowedMentions: { parse: [] as const } };
}

function schedulePanelUpdate(guildId: string, locale: Locale): void {
  if (panelTimers.has(guildId)) return;
  panelTimers.set(
    guildId,
    setTimeout(() => {
      panelTimers.delete(guildId);
      const panel = panels.get(guildId);
      const gm = players.get(guildId);
      if (panel && gm) void panel.edit(panelPayload(gm, locale)).catch(() => panels.delete(guildId));
    }, 1200),
  );
}

async function postPanel(channel: SendableChannels, gm: GuildMusic, locale: Locale): Promise<void> {
  const old = panels.get(gm.guild.id);
  if (old) await old.delete().catch(() => undefined);
  const msg = await channel.send(panelPayload(gm, locale)).catch(() => null);
  if (msg) panels.set(gm.guild.id, msg);
}

/** Fortschrittsbalken alle 15 s auffrischen, solange etwas mit bekannter Länge läuft */
let ticker: NodeJS.Timeout | null = null;
function startTicker(locale: (guildId: string) => Promise<Locale>): void {
  if (ticker) return;
  ticker = setInterval(() => {
    for (const [guildId, gm] of players) {
      const cur = gm.queue.current;
      if (cur && cur.kind !== 'radio' && !gm.paused && panels.has(guildId)) void locale(guildId).then((l) => schedulePanelUpdate(guildId, l));
    }
  }, 15_000);
  ticker.unref();
}

/** Befehle, die ffmpeg/den Stream neu starten (können länger als 3 s dauern) */
const SLOW_ACTION = /^(volup|voldown|volume:|effect:|seek:|jump:|back$)/;

const nextLoop = (mode: LoopMode): LoopMode => LOOP_MODES[(LOOP_MODES.indexOf(mode) + 1) % LOOP_MODES.length]!;

// ── Abspielen ───────────────────────────────────────────────────────────────
type PlayResult = { ok: true; message: string } | { ok: false; message: string };
const AUDIO_FILE = /\.(mp3|ogg|opus|m4a|aac|flac|wav|webm)(\?|$)/i;

/** Eingabe → Titel: Favorit (fav:N), Radiosender (radio:UUID), YouTube/SoundCloud/Spotify/Apple, Link oder Suche */
async function resolveInput(bot: BotContext, input: string, config: MusicConfig, member: GuildMember, locale: Locale): Promise<Track[] | PlayResult> {
  const value = input.trim();
  const yt = await youtubeAllowed(bot);
  const base = { requestedBy: member.id };
  const fromYt = (r: { title: string; url: string; durationMs?: number; author?: string; thumbnail?: string }): Track => ({ ...base, kind: 'youtube', title: r.title, url: r.url, durationMs: r.durationMs, author: r.author, thumbnail: r.thumbnail });
  const notFound = (q: string): PlayResult => ({ ok: false, message: t(locale, 'music.notFound', { query: q.slice(0, 60) }) });

  if (value.startsWith('fav:')) {
    const preset = config.presets[Number(value.slice(4))];
    if (!preset) return notFound(value);
    return resolveInput(bot, preset.url, config, member, locale).then((r) => (Array.isArray(r) ? r.map((tr) => ({ ...tr, title: tr.kind === 'youtube' ? tr.title : preset.name })) : r));
  }
  if (value.startsWith('radio:')) {
    const station = await getStation(value.slice(6)).catch(() => null);
    if (!station) return notFound(value);
    const vetted = await vetUrl(station.url, false);
    if (!vetted.ok) return notFound(station.name);
    return [{ ...base, title: station.name, url: vetted.url, kind: 'radio' }];
  }
  if (/^https?:\/\//i.test(value)) {
    if (isYtdlpUrl(value) || streamingLinkKind(value)) {
      if (!yt) return { ok: false, message: t(locale, 'music.youtubeOff') };
      if (streamingLinkKind(value)) {
        const query = await streamingLinkQuery(value).catch(() => null);
        const [hit] = query ? await ytSearch(query, 1).catch(() => []) : [];
        return hit ? [fromYt(hit)] : notFound(value);
      }
      const tracks = await ytResolve(value, config.maxQueue).catch(() => []);
      return tracks.length ? tracks.map(fromYt) : notFound(value);
    }
    const vetted = await vetUrl(value, config.allowPrivateUrls);
    if (!vetted.ok) return { ok: false, message: vetted.reason === 'private' ? t(locale, 'music.privateUrl') : t(locale, 'music.badUrl', { error: vetted.error ?? '' }) };
    return [{ ...base, allowPrivate: config.allowPrivateUrls, title: titleFromUrl(vetted.url), url: vetted.url, kind: AUDIO_FILE.test(vetted.url) ? 'file' : 'radio' }];
  }
  // Freier Text: mit YouTube-Freigabe der beste YouTube-Treffer (wie Euphony), sonst bester Radiosender
  if (yt) {
    const [hit] = await ytSearch(value, 1).catch(() => []);
    if (hit) return [fromYt(hit)];
  }
  const [best] = await searchStations(value, fetch, 1).catch(() => []);
  if (!best) return notFound(value);
  // Auch Treffer aus dem Verzeichnis prüfen – dort kann jeder Sender mit beliebiger Adresse eintragen
  const vetted = await vetUrl(best.url, false);
  if (!vetted.ok) return notFound(best.name);
  return [{ ...base, title: best.name, url: vetted.url, kind: 'radio' }];
}

/** Vorbedingungen: im Sprachkanal, gleicher Kanal wie der Bot, Rechte, Bot darf rein */
async function prepare(bot: BotContext, member: GuildMember, locale: Locale): Promise<{ gm: GuildMusic; config: MusicConfig } | PlayResult> {
  const config = await musicConfig(bot, member.guild.id);
  const voice = member.voice.channel;
  if (!voice) return { ok: false, message: t(locale, 'music.notInVoice') };
  const gm = await getPlayer(bot, member.guild, locale);
  if (gm.channelId && gm.channelId !== voice.id && gm.queue.current) return { ok: false, message: t(locale, 'music.otherChannel', { channel: `<#${gm.channelId}>` }) };
  if (!canControl(member, config, gm.queue.current ? gm.channelId : null)) return { ok: false, message: t(locale, 'music.noPermission') };
  const me = member.guild.members.me;
  const perms = me ? voice.permissionsFor(me) : null;
  if (!perms?.has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) return { ok: false, message: t(locale, 'music.cannotJoin', { channel: `<#${voice.id}>` }) };
  return { gm, config };
}

async function enqueueTracks(gm: GuildMusic, member: GuildMember, tracks: Track[], config: MusicConfig, locale: Locale, panelChannel: SendableChannels | null): Promise<PlayResult> {
  try {
    await gm.join(member.voice.channel!);
  } catch {
    return { ok: false, message: t(locale, 'music.cannotJoin', { channel: `<#${member.voice.channelId}>` }) };
  }
  const wasIdle = !gm.queue.current;
  if (tracks.length === 1) {
    const position = await gm.enqueue(tracks[0]!, config.maxQueue);
    if (position === 'full') return { ok: false, message: t(locale, 'music.queueFull', { max: String(config.maxQueue) }) };
    if (panelChannel && (!panels.has(member.guild.id) || position === 1)) await postPanel(panelChannel, gm, locale);
    return { ok: true, message: position === 1 ? `🎵 **${tracks[0]!.title}**` : t(locale, 'music.queued', { position: String(position), title: tracks[0]!.title }) };
  }
  const added = await gm.enqueueMany(tracks, config.maxQueue);
  if (!added) return { ok: false, message: t(locale, 'music.queueFull', { max: String(config.maxQueue) }) };
  if (panelChannel && (!panels.has(member.guild.id) || wasIdle)) await postPanel(panelChannel, gm, locale);
  return { ok: true, message: t(locale, 'music.queuedMany', { count: String(added) }) };
}

export async function play(bot: BotContext, member: GuildMember, input: string, locale: Locale, panelChannel: SendableChannels | null): Promise<PlayResult> {
  const ready = await prepare(bot, member, locale);
  if ('ok' in ready) return ready;
  const tracks = await resolveInput(bot, input, ready.config, member, locale);
  if (!Array.isArray(tracks)) return tracks;
  return enqueueTracks(ready.gm, member, tracks, ready.config, locale, panelChannel);
}

/** Gespeicherte Titel (Playlist/Wiederherstellen) erneut prüfen, bevor sie spielen */
async function revalidate(bot: BotContext, raw: unknown, config: MusicConfig, member: GuildMember): Promise<Track[]> {
  const yt = await youtubeAllowed(bot);
  const list = (Array.isArray(raw) ? raw : []) as Partial<Track>[];
  const out: Track[] = [];
  for (const item of list.slice(0, PLAYLIST_MAX_TRACKS)) {
    if (typeof item.url !== 'string' || typeof item.title !== 'string' || !TRACK_KINDS.includes(item.kind as Track['kind'])) continue;
    if (item.kind === 'youtube') {
      if (yt && isYtdlpUrl(item.url)) out.push({ title: item.title, url: item.url, kind: 'youtube', requestedBy: member.id, durationMs: item.durationMs, author: item.author, thumbnail: item.thumbnail });
      continue;
    }
    const vetted = await vetUrl(item.url, config.allowPrivateUrls);
    if (vetted.ok) out.push({ title: item.title, url: vetted.url, kind: item.kind!, requestedBy: member.id, allowPrivate: config.allowPrivateUrls });
  }
  return out;
}

const storable = (tr: Track) => ({ title: tr.title, url: tr.url, kind: tr.kind, durationMs: tr.durationMs, author: tr.author, thumbnail: tr.thumbnail });

/** Ergebnis eines Steuer-Befehls; `notice` = nur ein Hinweis (z. B. Abstimmungsstand), am Player änderte sich nichts */
export interface ControlResult {
  text: string;
  notice?: boolean;
}

/** Steuer-Befehle (Knopf, /musik oder Dashboard). `member` = wer es auslöst (für Vote-Skip) */
export async function control(bot: BotContext, guild: Guild, action: string, locale: Locale, member?: GuildMember): Promise<ControlResult> {
  const done = (text: string): ControlResult => ({ text });
  const notice = (text: string): ControlResult => ({ text, notice: true });
  const gm = players.get(guild.id);
  if (!gm || (!gm.queue.current && !['stop', 'back'].includes(action))) return notice(t(locale, 'music.nothing'));
  if (action === 'skip') {
    const config = await musicConfig(bot, guild.id);
    if (member && config.voteSkip && !isDj(member, config) && gm.queue.current?.requestedBy !== member.id) {
      const listeners = gm.listeners();
      const needed = votesNeeded(listeners.length);
      if (gm.skipVotes.has(member.id)) return notice(t(locale, 'music.voteAlready', { votes: String(gm.skipVotes.size), needed: String(needed) }));
      gm.skipVotes.add(member.id);
      const votes = [...gm.skipVotes].filter((id) => listeners.includes(id)).length;
      if (votes < needed) return notice(t(locale, 'music.voteSkip', { votes: String(votes), needed: String(needed) }));
      gm.skip();
      return done(t(locale, 'music.voteSkipDone'));
    }
    gm.skip();
    return done(t(locale, 'music.skipped'));
  }
  if (action === 'stop') {
    gm.destroy();
    players.delete(guild.id);
    const panel = panels.get(guild.id);
    panels.delete(guild.id);
    await panel?.edit({ ...panelPayload(gm, locale), components: [] }).catch(() => undefined);
    return done(t(locale, 'music.stopped'));
  }
  if (action === 'back') return (await gm.back()) ? done(t(locale, 'music.back', { title: gm.queue.current?.title ?? '' })) : notice(t(locale, 'music.noBack'));
  if (action === 'pause') return done(t(locale, gm.togglePause() ? 'music.paused' : 'music.resumed'));
  if (action === 'shuffle') {
    gm.shuffle();
    return done(t(locale, 'music.shuffled'));
  }
  if (action === 'loop') {
    gm.setLoop(nextLoop(gm.queue.loop));
    return done(t(locale, 'music.loopSet', { mode: t(locale, `music.loop.${gm.queue.loop}` as TranslationKey) }));
  }
  if (action.startsWith('loop:')) {
    const mode = action.slice(5) as LoopMode;
    if (LOOP_MODES.includes(mode)) gm.setLoop(mode);
    return done(t(locale, 'music.loopSet', { mode: t(locale, `music.loop.${gm.queue.loop}` as TranslationKey) }));
  }
  if (action === 'volup' || action === 'voldown' || action.startsWith('volume:')) {
    const target = action === 'volup' ? gm.volume + 10 : action === 'voldown' ? gm.volume - 10 : Number(action.slice(7));
    if (Number.isFinite(target)) await gm.setVolume(target);
    return done(t(locale, 'music.volumeSet', { volume: String(gm.volume) }));
  }
  if (action.startsWith('effect:')) {
    const id = action.slice(7);
    if (id === 'aus' || id === 'off') {
      await gm.setEffect(null);
      return done(t(locale, 'music.effectOff'));
    }
    if (!isMusicEffect(id)) return notice(t(locale, 'music.nothing'));
    await gm.setEffect(id);
    return done(t(locale, 'music.effectSet', { emoji: MUSIC_EFFECTS[id].emoji, effect: MUSIC_EFFECTS[id][locale] }));
  }
  if (action.startsWith('seek:')) {
    const ms = Number(action.slice(5));
    if (!gm.seekable) return notice(t(locale, 'music.notSeekable'));
    if (!Number.isFinite(ms)) return notice(t(locale, 'music.badTime'));
    await gm.seek(ms);
    return done(t(locale, 'music.seeked', { time: formatClock(ms) }));
  }
  if (action.startsWith('remove:')) {
    const removed = gm.remove(Number(action.slice(7)));
    return removed ? done(t(locale, 'music.removed', { title: removed.title })) : notice(t(locale, 'music.badPosition'));
  }
  if (action.startsWith('jump:')) {
    return (await gm.jump(Number(action.slice(5)))) ? done(t(locale, 'music.jumped', { title: gm.queue.current?.title ?? '' })) : notice(t(locale, 'music.badPosition'));
  }
  if (action === 'autoplay' || action === 'autoplay:on' || action === 'autoplay:off') {
    const on = action === 'autoplay' ? !gm.autoplay : action === 'autoplay:on';
    if (on && !(await youtubeAllowed(bot))) return notice(t(locale, 'music.autoplayNeedsYoutube'));
    gm.autoplay = on;
    gm.changed();
    return done(t(locale, on ? 'music.autoplayOn' : 'music.autoplayOff'));
  }
  return notice(t(locale, 'music.nothing'));
}

// ── Lieblingssongs, Playlists, Liedtexte, Wiederherstellen ─────────────────
async function like(bot: BotContext, member: GuildMember, locale: Locale): Promise<string> {
  const cur = players.get(member.guild.id)?.queue.current;
  if (!cur) return t(locale, 'music.nothing');
  const where = { guildId_ownerId_name: { guildId: member.guild.id, ownerId: member.id, name: LIKED_PLAYLIST } };
  const existing = await bot.prisma.musicPlaylist.findUnique({ where });
  const tracks = (Array.isArray(existing?.tracks) ? existing.tracks : []) as { url?: string }[];
  if (tracks.some((x) => x.url === cur.url)) return t(locale, 'music.likedAlready', { title: cur.title });
  const next = [...tracks, storable(cur)].slice(-PLAYLIST_MAX_TRACKS) as Prisma.InputJsonValue;
  await bot.prisma.musicPlaylist.upsert({ where, create: { guildId: member.guild.id, ownerId: member.id, name: LIKED_PLAYLIST, tracks: next }, update: { tracks: next } });
  return t(locale, 'music.liked', { title: cur.title });
}

async function lyricsPayload(guildId: string, locale: Locale) {
  const gm = players.get(guildId);
  const cur = gm?.queue.current;
  if (!gm || !cur) return { content: t(locale, 'music.nothing'), embeds: [], components: [] };
  const found = await findLyrics(cur.title, cur.author, cur.durationMs).catch(() => null);
  if (!found) return { content: t(locale, 'music.lyricsNone', { title: cur.title.slice(0, 80) }), embeds: [], components: [] };
  const embed = new EmbedBuilder().setColor(0x2fd1b8).setTitle(t(locale, 'music.lyricsTitle', { track: found.track, artist: found.artist }).slice(0, 256));
  if (found.synced.length) {
    // „Synchron“: Ausschnitt um die aktuelle Stelle, aktuelle Zeile fett
    const window = lyricsWindow(found.synced, gm.position(), 3, 8);
    embed.setDescription(window.map((l) => (l.current ? `**▶ ${l.text}**` : l.text)).join('\n').slice(0, 4000));
    embed.setFooter({ text: `⏱ ${formatClock(gm.position())} · lrclib.net` });
  } else {
    embed.setDescription(found.plain.slice(0, 4000)).setFooter({ text: 'lrclib.net' });
  }
  const refresh = new ButtonBuilder().setCustomId('musik:lyr').setEmoji('🔄').setLabel(t(locale, 'music.lyricsRefresh')).setStyle(ButtonStyle.Secondary);
  return { content: '', embeds: [embed], components: found.synced.length ? [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(refresh)] : [] };
}

async function restore(bot: BotContext, member: GuildMember, locale: Locale, panelChannel: SendableChannels | null): Promise<PlayResult> {
  const ready = await prepare(bot, member, locale);
  if ('ok' in ready) return ready;
  const raw = await bot.redis.get(musicLastQueueKey(member.guild.id)).catch(() => null);
  const tracks = raw ? await revalidate(bot, JSON.parse(raw) as unknown, ready.config, member) : [];
  if (!tracks.length) return { ok: false, message: t(locale, 'music.nothingToRestore') };
  const result = await enqueueTracks(ready.gm, member, tracks, ready.config, locale, panelChannel);
  return result.ok ? { ok: true, message: t(locale, 'music.restored', { count: String(Math.min(tracks.length, ready.config.maxQueue)) }) } : result;
}

async function playlistCommand(bot: BotContext, member: GuildMember, sub: string, name: string | null, locale: Locale, panelChannel: SendableChannels | null): Promise<PlayResult> {
  const guildId = member.guild.id;
  if (sub === 'liste') {
    const lists = await bot.prisma.musicPlaylist.findMany({ where: { guildId, ownerId: member.id }, orderBy: { updatedAt: 'desc' }, take: 25 });
    if (!lists.length) return { ok: true, message: t(locale, 'music.plEmpty') };
    return { ok: true, message: t(locale, 'music.plList', { list: lists.map((l) => `• **${l.name}** (${Array.isArray(l.tracks) ? l.tracks.length : 0})`).join('\n') }) };
  }
  const clean = (name ?? '').trim().slice(0, 50);
  if (!clean) return { ok: false, message: t(locale, 'music.plNotFound', { name: '' }) };
  const where = { guildId_ownerId_name: { guildId, ownerId: member.id, name: clean } };
  if (sub === 'speichern') {
    const gm = players.get(guildId);
    const tracks = gm ? [gm.queue.current, ...gm.queue.upcoming].filter((x): x is Track => !!x).slice(0, PLAYLIST_MAX_TRACKS) : [];
    if (!tracks.length) return { ok: false, message: t(locale, 'music.plNothing') };
    const data = tracks.map(storable) as Prisma.InputJsonValue;
    await bot.prisma.musicPlaylist.upsert({ where, create: { guildId, ownerId: member.id, name: clean, tracks: data }, update: { tracks: data } });
    return { ok: true, message: t(locale, 'music.plSaved', { name: clean, count: String(tracks.length) }) };
  }
  const list = await bot.prisma.musicPlaylist.findUnique({ where });
  if (!list) return { ok: false, message: t(locale, 'music.plNotFound', { name: clean }) };
  if (sub === 'loeschen') {
    await bot.prisma.musicPlaylist.delete({ where });
    return { ok: true, message: t(locale, 'music.plDeleted', { name: clean }) };
  }
  // laden
  const ready = await prepare(bot, member, locale);
  if ('ok' in ready) return ready;
  const tracks = await revalidate(bot, list.tracks, ready.config, member);
  if (!tracks.length) return { ok: false, message: t(locale, 'music.youtubeOff') };
  const result = await enqueueTracks(ready.gm, member, tracks, ready.config, locale, panelChannel);
  return result.ok ? { ok: true, message: t(locale, 'music.plLoaded', { name: clean, count: String(Math.min(tracks.length, ready.config.maxQueue)) }) } : result;
}

// ── /musik ──────────────────────────────────────────────────────────────────
const positionOption = (o: import('discord.js').SlashCommandIntegerOption) =>
  o.setName('platz').setNameLocalizations(en('position')).setDescription(d('music.cmd.position').de).setDescriptionLocalizations(d('music.cmd.position').loc).setRequired(true).setMinValue(1).setMaxValue(200);
const plNameOption = (o: import('discord.js').SlashCommandStringOption, auto: boolean) =>
  o.setName('name').setDescription(d('music.cmd.plName').de).setDescriptionLocalizations(d('music.cmd.plName').loc).setRequired(true).setMaxLength(50).setAutocomplete(auto);

const musicCommand: SlashCommand = {
  data: (() => {
    const x = d;
    const simple = (name: string, key: TranslationKey, enName?: string) => (s: import('discord.js').SlashCommandSubcommandBuilder) => {
      s.setName(name).setDescription(x(key).de).setDescriptionLocalizations(x(key).loc);
      if (enName) s.setNameLocalizations(en(enName));
      return s;
    };
    return new SlashCommandBuilder()
      .setName('musik')
      .setNameLocalizations(en('music'))
      .setDescription(x('music.cmd.root').de)
      .setDescriptionLocalizations(x('music.cmd.root').loc)
      .setContexts(InteractionContextType.Guild)
      .addSubcommand((s) =>
        s
          .setName('play')
          .setDescription(x('music.cmd.play').de)
          .setDescriptionLocalizations(x('music.cmd.play').loc)
          .addStringOption((o) => o.setName('suche').setNameLocalizations(en('query')).setDescription(x('music.cmd.query').de).setDescriptionLocalizations(x('music.cmd.query').loc).setRequired(true).setMaxLength(500).setAutocomplete(true)),
      )
      .addSubcommand(simple('skip', 'music.cmd.skip'))
      .addSubcommand(simple('zurueck', 'music.cmd.back', 'back'))
      .addSubcommand(simple('stop', 'music.cmd.stop'))
      .addSubcommand(simple('pause', 'music.cmd.pause'))
      .addSubcommand((s) =>
        s
          .setName('lautstaerke')
          .setNameLocalizations(en('volume'))
          .setDescription(x('music.cmd.volume').de)
          .setDescriptionLocalizations(x('music.cmd.volume').loc)
          .addIntegerOption((o) => o.setName('prozent').setNameLocalizations(en('percent')).setDescription(x('music.cmd.volumeValue').de).setDescriptionLocalizations(x('music.cmd.volumeValue').loc).setRequired(true).setMinValue(1).setMaxValue(100)),
      )
      .addSubcommand((s) =>
        s
          .setName('loop')
          .setDescription(x('music.cmd.loop').de)
          .setDescriptionLocalizations(x('music.cmd.loop').loc)
          .addStringOption((o) =>
            o
              .setName('modus')
              .setNameLocalizations(en('mode'))
              .setDescription(x('music.cmd.loopMode').de)
              .setDescriptionLocalizations(x('music.cmd.loopMode').loc)
              .setRequired(true)
              .addChoices(
                { name: 'aus', name_localizations: en('off'), value: 'off' },
                { name: 'Titel', name_localizations: en('track'), value: 'track' },
                { name: 'Warteschlange', name_localizations: en('queue'), value: 'queue' },
              ),
          ),
      )
      .addSubcommand((s) =>
        s
          .setName('effekt')
          .setNameLocalizations(en('effect'))
          .setDescription(x('music.cmd.effect').de)
          .setDescriptionLocalizations(x('music.cmd.effect').loc)
          .addStringOption((o) =>
            o
              .setName('name')
              .setDescription(x('music.cmd.effectName').de)
              .setDescriptionLocalizations(x('music.cmd.effectName').loc)
              .setRequired(true)
              .addChoices({ name: '✖️ aus', name_localizations: en('✖️ off'), value: 'aus' }, ...MUSIC_EFFECT_IDS.map((id) => ({ name: `${MUSIC_EFFECTS[id].emoji} ${MUSIC_EFFECTS[id].de}`, name_localizations: en(`${MUSIC_EFFECTS[id].emoji} ${MUSIC_EFFECTS[id].en}`), value: id }))),
          ),
      )
      .addSubcommand(simple('shuffle', 'music.cmd.shuffle'))
      .addSubcommand((s) => simple('entfernen', 'music.cmd.remove', 'remove')(s).addIntegerOption(positionOption))
      .addSubcommand((s) => simple('springen', 'music.cmd.jump', 'skipto')(s).addIntegerOption(positionOption))
      .addSubcommand((s) =>
        simple('spulen', 'music.cmd.seek', 'seek')(s).addStringOption((o) =>
          o.setName('zeit').setNameLocalizations(en('time')).setDescription(x('music.cmd.seekTime').de).setDescriptionLocalizations(x('music.cmd.seekTime').loc).setRequired(true).setMaxLength(10),
        ),
      )
      .addSubcommand(simple('warteschlange', 'music.cmd.queue', 'queue'))
      .addSubcommand(simple('panel', 'music.cmd.panel'))
      .addSubcommand(simple('lyrics', 'music.cmd.lyrics'))
      .addSubcommand(simple('like', 'music.cmd.like'))
      .addSubcommand(simple('autoplay', 'music.cmd.autoplay'))
      .addSubcommand(simple('wiederherstellen', 'music.cmd.restore', 'restore'))
      .addSubcommandGroup((g) =>
        g
          .setName('playlist')
          .setDescription(x('music.cmd.playlist').de)
          .setDescriptionLocalizations(x('music.cmd.playlist').loc)
          .addSubcommand((s) => simple('speichern', 'music.cmd.plSave', 'save')(s).addStringOption((o) => plNameOption(o, false)))
          .addSubcommand((s) => simple('laden', 'music.cmd.plLoad', 'load')(s).addStringOption((o) => plNameOption(o, true)))
          .addSubcommand(simple('liste', 'music.cmd.plList', 'list'))
          .addSubcommand((s) => simple('loeschen', 'music.cmd.plDelete', 'delete')(s).addStringOption((o) => plNameOption(o, true))),
      )
      .toJSON();
  })(),
  async autocomplete({ interaction, bot }) {
    if (!interaction.inCachedGuild()) return;
    const focused = interaction.options.getFocused(true);
    const typed = focused.value.trim();
    // Playlist-Namen
    if (interaction.options.getSubcommandGroup(false) === 'playlist') {
      const lists = await bot.prisma.musicPlaylist.findMany({ where: { guildId: interaction.guildId, ownerId: interaction.user.id }, orderBy: { updatedAt: 'desc' }, take: 25 });
      return void (await interaction.respond(lists.filter((l) => !typed || l.name.toLowerCase().includes(typed.toLowerCase())).map((l) => ({ name: l.name, value: l.name }))));
    }
    const config = await musicConfig(bot, interaction.guildId);
    const favs = config.presets
      .map((p, i) => ({ name: `⭐ ${p.name}`.slice(0, 100), value: `fav:${i}` }))
      .filter((c) => !typed || c.name.toLowerCase().includes(typed.toLowerCase()));
    if (/^https?:\/\//i.test(typed)) return void (await interaction.respond(typed.length <= 100 ? [{ name: typed.slice(0, 100), value: typed }] : []));
    if (typed.length < 2) return void (await interaction.respond(favs.slice(0, 25)));
    // YouTube (wenn freigegeben) und Radio parallel – Discord gibt Vorschlägen nur 3 Sekunden
    const [songs, stations] = await Promise.all([
      (await youtubeAllowed(bot)) ? ytSearch(typed, 7, 2200).catch(() => []) : Promise.resolve([]),
      searchStations(typed, fetch, 10).catch(() => []),
    ]);
    const choices = [
      ...favs,
      ...songs.filter((s) => s.url.length <= 100).map((s) => ({ name: `▶️ ${s.title}${s.durationMs ? ` · ${formatClock(s.durationMs)}` : ''}${s.author ? ` · ${s.author}` : ''}`.slice(0, 100), value: s.url })),
      ...stations.map((s) => ({ name: `📻 ${s.name}${s.country ? ` · ${s.country}` : ''}${s.bitrate ? ` · ${s.bitrate} kbit/s` : ''}`.slice(0, 100), value: `radio:${s.uuid}` })),
    ].slice(0, 25);
    await interaction.respond(choices).catch(() => undefined);
  },
  async execute({ interaction, locale, bot }: CommandContext) {
    if (!interaction.inCachedGuild()) return;
    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();
    const member = interaction.member;
    const config = await musicConfig(bot, interaction.guildId);
    const here = interaction.channel?.isSendable() ? interaction.channel : null;
    const reply = (content: string) => interaction.editReply({ content, allowedMentions: { parse: [] } }).catch(() => undefined);

    if (group === 'playlist') {
      await interaction.deferReply({ flags: sub === 'laden' ? undefined : MessageFlags.Ephemeral });
      const result = await playlistCommand(bot, member, sub, interaction.options.getString('name'), locale, here);
      return void (await reply(result.message));
    }
    if (sub === 'play') {
      await interaction.deferReply();
      const result = await play(bot, member, interaction.options.getString('suche', true), locale, here);
      return void (await reply(result.message));
    }
    if (sub === 'wiederherstellen') {
      await interaction.deferReply();
      return void (await reply((await restore(bot, member, locale, here)).message));
    }
    const gm = players.get(interaction.guildId);
    if (sub === 'warteschlange') {
      const s = gm?.state();
      const lines = s?.current
        ? [`▶️ **${s.current.title}**${s.current.durationMs ? ` \`${formatClock(gm!.position())} / ${formatClock(s.current.durationMs)}\`` : ''}`, ...gm!.queue.upcoming.slice(0, 30).map((q, i) => `${i + 1}. ${q.title}${q.durationMs ? ` \`${formatClock(q.durationMs)}\`` : ''}`)]
        : [];
      if (gm && gm.queue.upcoming.length > 30) lines.push(`… +${gm.queue.upcoming.length - 30}`);
      return void (await interaction.reply({ content: (lines.join('\n') || t(locale, 'music.queueEmpty')).slice(0, 2000), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }));
    }
    if (sub === 'panel') {
      if (!gm || !here) return void (await interaction.reply({ content: t(locale, 'music.nothing'), flags: MessageFlags.Ephemeral }));
      await postPanel(here, gm, locale);
      return void (await interaction.reply({ content: '👍', flags: MessageFlags.Ephemeral }));
    }
    if (sub === 'lyrics') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      return void (await interaction.editReply(await lyricsPayload(interaction.guildId, locale)).catch(() => undefined));
    }
    if (sub === 'like') return void (await interaction.reply({ content: await like(bot, member, locale), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }));
    // Überspringen geht ohne DJ-Rechte per Abstimmung (wenn eingeschaltet) – muss aber im Kanal sein
    if (sub === 'skip' && config.voteSkip && gm?.channelId && member.voice.channelId === gm.channelId) {
      return void (await interaction.reply({ content: (await control(bot, interaction.guild, 'skip', locale, member)).text, allowedMentions: { parse: [] } }));
    }
    if (!canControl(member, config, gm?.channelId ?? null)) return void (await interaction.reply({ content: t(locale, 'music.noPermission'), flags: MessageFlags.Ephemeral }));
    let action: string = sub === 'zurueck' ? 'back' : sub;
    if (sub === 'lautstaerke') action = `volume:${interaction.options.getInteger('prozent', true)}`;
    else if (sub === 'loop') action = `loop:${interaction.options.getString('modus', true)}`;
    else if (sub === 'effekt') action = `effect:${interaction.options.getString('name', true)}`;
    else if (sub === 'entfernen') action = `remove:${interaction.options.getInteger('platz', true)}`;
    else if (sub === 'springen') action = `jump:${interaction.options.getInteger('platz', true)}`;
    else if (sub === 'spulen') {
      const ms = parseTime(interaction.options.getString('zeit', true));
      if (ms === null) return void (await interaction.reply({ content: t(locale, 'music.badTime'), flags: MessageFlags.Ephemeral }));
      action = `seek:${ms}`;
    }
    // Befehle, die den Stream neu starten, dauern länger als die 3 Sekunden, die Discord für eine Antwort lässt
    if (SLOW_ACTION.test(action)) {
      await interaction.deferReply();
      const slow = await control(bot, interaction.guild, action, locale, member);
      await interaction.editReply({ content: slow.text, allowedMentions: { parse: [] } });
      return;
    }
    const result = await control(bot, interaction.guild, action, locale, member);
    await interaction.reply({ content: result.text, flags: result.notice ? MessageFlags.Ephemeral : undefined, allowedMentions: { parse: [] } });
  },
};

export const musikModule: BotModule = {
  id: 'musik',
  commands: [musicCommand],
  setup({ bot, on }) {
    startTicker((guildId) => bot.modules.locale(guildId));
    // yt-dlp aktuell halten (YouTube ändert oft etwas) – nur wenn freigegeben, beim Start und täglich
    const updateYtdlp = async () => {
      if (await youtubeAllowed(bot)) bot.logger.info({ result: await ytSelfUpdate() }, 'Musik: yt-dlp geprüft');
    };
    setTimeout(() => void updateYtdlp(), 30_000).unref();
    setInterval(() => void updateYtdlp(), 24 * 3600_000).unref();
    // Allein im Kanal → nach der Wartezeit gehen; Bot aus dem Kanal geworfen → aufräumen
    on(
      'voiceStateUpdate',
      (_old, now) => now.guild.id,
      (old, now) => {
        const gm = players.get(now.guild.id);
        if (!gm) return;
        if (now.id === bot.client.user?.id && old.channelId && !now.channelId) {
          gm.destroy();
          players.delete(now.guild.id);
          return;
        }
        if (now.id === bot.client.user?.id && now.channelId) gm.channelId = now.channelId;
        gm.checkAlone();
      },
    );
  },
  async onComponent({ interaction, action, args, locale, bot }) {
    const config = await musicConfig(bot, interaction.guildId);
    const gm = players.get(interaction.guildId);
    if (action === 'lyr' && interaction.isButton()) return void (await interaction.update(await lyricsPayload(interaction.guildId, locale)).catch(() => undefined));
    if (action === 'btn' && interaction.isButton() && args[0] === 'like') return void (await interaction.reply({ content: await like(bot, interaction.member, locale), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }));
    if (action === 'btn' && interaction.isButton() && args[0] === 'lyrics') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      return void (await interaction.editReply(await lyricsPayload(interaction.guildId, locale)).catch(() => undefined));
    }
    const isVoteSkip = action === 'btn' && args[0] === 'skip' && config.voteSkip && !!gm?.channelId && interaction.member.voice.channelId === gm.channelId;
    if (!isVoteSkip && !canControl(interaction.member, config, gm?.channelId ?? null)) return void (await interaction.reply({ content: t(locale, 'music.noPermission'), flags: MessageFlags.Ephemeral }));
    let command = '';
    if (action === 'btn' && interaction.isButton()) command = args[0] ?? '';
    else if (action === 'fx' && interaction.isStringSelectMenu()) command = `effect:${interaction.values[0] ?? 'aus'}`;
    else return;
    // Langsame Befehle (Stream-Neustart): sofort bestätigen, Panel danach auffrischen
    const slow = SLOW_ACTION.test(command);
    if (slow) await interaction.deferUpdate().catch(() => undefined);
    const result = await control(bot, interaction.guild, command, locale, interaction.member);
    const fresh = players.get(interaction.guildId);
    // Hinweise (Abstimmungsstand, „kein vorheriger Titel“ …) als kurze Antwort, sonst nur das Panel auffrischen
    if (slow) {
      if (fresh && !result.notice) await interaction.editReply(panelPayload(fresh, locale)).catch(() => undefined);
      else await interaction.followUp({ content: result.text, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => undefined);
    } else if (fresh && !result.notice) await interaction.update(panelPayload(fresh, locale)).catch(() => undefined);
    else await interaction.reply({ content: result.text, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }).catch(() => undefined);
  },
  async onAction(bot, guildId, action) {
    const guild = bot.client.guilds.cache.get(guildId);
    if (!guild) return;
    const locale = await bot.modules.locale(guildId);
    await control(bot, guild, action, locale);
  },
  async onConfigChange(bot, guildId) {
    // Modul ausgeschaltet → Musik stoppen; sonst Einstellungen (24/7, Autoplay …) übernehmen
    ytCache = null;
    if (!(await bot.modules.isEnabled(guildId, 'musik'))) {
      players.get(guildId)?.destroy();
      players.delete(guildId);
      return;
    }
    const gm = players.get(guildId);
    if (gm) applyConfig(gm, await musicConfig(bot, guildId));
  },
};
