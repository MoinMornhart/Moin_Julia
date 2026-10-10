import { z } from 'zod';

/**
 * Social Media / Live-Alerts: ein „Feed“ = ein Twitch-, YouTube- oder Kick-Kanal, der in einen
 * Discord-Kanal meldet. Feeds liegen als eigene Zeilen in der DB (SocialFeed), damit der Bot
 * ihren Zustand (zuletzt gesehene Videos, laufender Stream) mitspeichern kann.
 */

export const PLATFORMS = ['twitch', 'youtube', 'kick'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = { twitch: 'Twitch', youtube: 'YouTube', kick: 'Kick' };
export const PLATFORM_COLORS: Record<Platform, number> = { twitch: 0x9146ff, youtube: 0xff0033, kick: 0x53fc18 };

/** Was nach dem Stream mit der Live-Meldung passiert */
export const END_MODES = ['edit', 'keep', 'delete'] as const;
export const END_MODE_LABELS: Record<(typeof END_MODES)[number], string> = {
  edit: 'in „war live“ umwandeln',
  keep: 'stehen lassen',
  delete: 'löschen',
};

export const ALERT_PLACEHOLDERS = ['{ping}', '{streamer}', '{title}', '{game}', '{url}'] as const;

/**
 * Darstellung wie bei GalaxyBot (Twitch/Kick):
 * - classic: Meldung in einen vorhandenen Kanal
 * - channel: eigener Kanal für den Streamer (wird angelegt, Name zeigt 🔴 live / ⚫ offline)
 * - category: eigene Kategorie mit Stream-Kanal und Info-Kanälen (Titel, Online-Zeit, Zuschauer)
 * - event: Discord-Event, solange der Stream läuft (Meldung zusätzlich, falls ein Kanal gewählt ist)
 */
export const DISPLAY_MODES = ['classic', 'channel', 'category', 'event'] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];
export const DISPLAY_MODE_LABELS: Record<DisplayMode, { label: string; hint: string }> = {
  category: { label: 'Kategorie', hint: 'Eigene Kategorie mit Stream-Kanal und Info-Kanälen (Titel, Online-Zeit, Zuschauer). Empfohlen.' },
  channel: { label: 'Kanal', hint: 'Eigener Kanal für den Streamer – der Name zeigt, ob gerade live.' },
  event: { label: 'Event', hint: 'Ein Discord-Event, solange der Stream läuft.' },
  classic: { label: 'Klassisch', hint: 'Meldung in einen vorhandenen Kanal (in Ankündigungskanälen auch veröffentlicht).' },
};

export const DEFAULT_ALERT_TEXTS = {
  live: '🔴 **{streamer}** ist jetzt live! {url}',
  video: '📺 **{streamer}** hat ein neues Video hochgeladen: {url}',
  short: '📱 Neuer Short von **{streamer}**: {url}',
} as const;

const snowflake = z.union([z.string().regex(/^\d{15,22}$/), z.literal('')]);

export const feedSchema = z.object({
  platform: z.enum(PLATFORMS),
  /** Was die Person eingegeben hat (Name, Link oder ID) – nur zur Anzeige im Editor */
  input: z.string().trim().max(200).default(''),
  /** Aufgelöster Schlüssel: Twitch-/Kick-Login (klein) bzw. YouTube-Kanal-ID (UC…) */
  channelKey: z.string().trim().min(1).max(100),
  displayName: z.string().trim().max(100).default(''),
  discordChannelId: snowflake.default(''),
  pingRoleIds: z.array(z.string().regex(/^\d{15,22}$/)).max(10).default([]),
  liveText: z.string().max(1000).default(DEFAULT_ALERT_TEXTS.live),
  videoText: z.string().max(1000).default(DEFAULT_ALERT_TEXTS.video),
  shortText: z.string().max(1000).default(DEFAULT_ALERT_TEXTS.short),
  /** YouTube: welche Meldungen */
  notifyVideos: z.boolean().default(true),
  notifyShorts: z.boolean().default(true),
  notifyLive: z.boolean().default(true),
  embed: z.boolean().default(true),
  endMode: z.enum(END_MODES).default('edit'),
  /** Live-Rolle: diese Person bekommt die Rolle, solange der Kanal live ist */
  liveRoleId: snowflake.default(''),
  liveMemberId: snowflake.default(''),
  paused: z.boolean().default(false),
  /** Twitch/Kick: Darstellung (siehe DISPLAY_MODES) */
  display: z.enum(DISPLAY_MODES).default('classic'),
  /** Knopf „🔔 Benachrichtigungen“ an der Meldung: Mitglieder holen/entfernen sich die (erste) Ping-Rolle selbst */
  pingButton: z.boolean().default(true),
  /** Twitch: nach dem Stream die Aufzeichnung (VoD) als Thread an die Meldung hängen */
  vodThread: z.boolean().default(false),
  /** Twitch: Streamplan in diesem Kanal anzeigen (leer = aus) */
  scheduleChannelId: snowflake.default(''),
});
export type FeedData = z.infer<typeof feedSchema>;

export const MAX_FEEDS_PER_GUILD = 50;

/** Zustand, den der Bot je Feed mitschreibt */
export const feedStateSchema = z.object({
  /** YouTube: zuletzt gesehene Video-IDs (neueste zuerst); leer = erster Lauf, nur merken */
  seen: z.array(z.string()).max(60).default([]),
  initialized: z.boolean().default(false),
  /** Twitch/Kick: so oft hintereinander „offline“ – erst ab 2 gilt der Stream als beendet (kein Flackern) */
  misses: z.number().int().min(0).default(0),
  /** Vom Bot angelegte Kanäle/Events (Darstellung „Kanal“, „Kategorie“, „Event“) und Streamplan */
  managed: z
    .object({
      categoryId: z.string().default(''),
      channelId: z.string().default(''),
      titleChannelId: z.string().default(''),
      uptimeChannelId: z.string().default(''),
      viewersChannelId: z.string().default(''),
      eventId: z.string().default(''),
      broadcasterId: z.string().default(''),
      scheduleMessageId: z.string().default(''),
      scheduleAt: z.number().default(0),
      /** Zeitpunkte der letzten Umbenennungen je Kanal (Discord: 2 pro 10 min) */
      renames: z.record(z.string(), z.array(z.number())).default({}),
    })
    .default({ categoryId: '', channelId: '', titleChannelId: '', uptimeChannelId: '', viewersChannelId: '', eventId: '', broadcasterId: '', scheduleMessageId: '', scheduleAt: 0, renames: {} }),
  live: z
    .object({
      streamId: z.string(),
      startedAt: z.string(),
      title: z.string().default(''),
      game: z.string().default(''),
      messageId: z.string().default(''),
      channelId: z.string().default(''),
      /** Twitch-User-ID (für die Aufzeichnung) */
      userId: z.string().default(''),
      viewers: z.number().nullable().default(null),
    })
    .nullable()
    .default(null),
});
export type FeedState = z.infer<typeof feedStateSchema>;

export function parseFeedState(raw: unknown): FeedState {
  const parsed = feedStateSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : feedStateSchema.parse({});
}

export type ChannelInput =
  | { ok: true; channelKey: string; needsLookup?: 'youtube-handle' | 'youtube-video' }
  | { ok: false; error: string };

/**
 * Macht aus einer Eingabe (Name, Link, @Handle, Kanal-ID) einen eindeutigen Schlüssel.
 * YouTube-@Handles und Video-Links müssen danach noch nachgeschlagen werden (Kanal-ID).
 */
export function normalizeChannelInput(platform: Platform, raw: string): ChannelInput {
  const input = raw.trim();
  if (!input) return { ok: false, error: 'Bitte einen Kanal angeben.' };
  if (platform === 'twitch' || platform === 'kick') {
    const host = platform === 'twitch' ? /(?:www\.|m\.)?twitch\.tv/i : /(?:www\.)?kick\.com/i;
    let name = input;
    const url = /^https?:\/\//i.test(input) ? safeUrl(input) : null;
    if (url) {
      if (!host.test(url.hostname)) return { ok: false, error: `Das ist kein ${PLATFORM_LABELS[platform]}-Link.` };
      name = url.pathname.split('/').filter(Boolean)[0] ?? '';
    } else if (host.test(input)) {
      name = input.replace(host, '').split('/').filter(Boolean)[0] ?? '';
    }
    name = name.replace(/^@/, '').toLowerCase();
    const pattern = platform === 'twitch' ? /^[a-z0-9_]{3,25}$/ : /^[a-z0-9_-]{2,25}$/;
    if (!pattern.test(name)) return { ok: false, error: `„${name || input}“ ist kein gültiger ${PLATFORM_LABELS[platform]}-Name.` };
    return { ok: true, channelKey: name };
  }
  // YouTube
  if (/^UC[\w-]{22}$/.test(input)) return { ok: true, channelKey: input };
  if (/^@[\w.-]{3,30}$/.test(input)) return { ok: true, channelKey: input, needsLookup: 'youtube-handle' };
  const url = safeUrl(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  if (!url || !/(^|\.)youtube\.com$|^youtu\.be$/i.test(url.hostname)) return { ok: false, error: 'Bitte einen YouTube-Link, ein @Handle oder eine Kanal-ID (UC…) angeben.' };
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'channel' && parts[1] && /^UC[\w-]{22}$/.test(parts[1])) return { ok: true, channelKey: parts[1] };
  if (parts[0]?.startsWith('@')) return { ok: true, channelKey: parts[0], needsLookup: 'youtube-handle' };
  if (url.hostname === 'youtu.be' || parts[0] === 'watch' || parts[0] === 'shorts' || parts[0] === 'live') {
    return { ok: true, channelKey: url.toString(), needsLookup: 'youtube-video' };
  }
  if ((parts[0] === 'c' || parts[0] === 'user') && parts[1]) return { ok: true, channelKey: url.toString(), needsLookup: 'youtube-handle' };
  return { ok: false, error: 'Diesen YouTube-Link kenne ich nicht – nimm am besten den Link zum Kanal (youtube.com/@name).' };
}

/** Shared läuft ohne DOM-/Node-Typen; URL gibt es aber in Node und im Browser. */
declare const URL: new (value: string) => { hostname: string; pathname: string; toString(): string };
type ParsedUrl = InstanceType<typeof URL>;

function safeUrl(value: string): ParsedUrl | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** Sucht die Kanal-ID (UC…) im HTML einer YouTube-Seite */
export function extractYoutubeChannelId(html: string): string | null {
  const patterns = [
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/,
    /<meta itemprop="(?:channelId|identifier)" content="(UC[\w-]{22})"/,
    /"externalId":"(UC[\w-]{22})"/,
    /"channelId":"(UC[\w-]{22})"/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function platformUrl(platform: Platform, channelKey: string): string {
  if (platform === 'twitch') return `https://www.twitch.tv/${channelKey}`;
  if (platform === 'kick') return `https://kick.com/${channelKey}`;
  return `https://www.youtube.com/channel/${channelKey}`;
}

/** Platzhalter in Meldungstexten */
/** Fremde Texte (Stream-Titel …) entschärfen: @everyone/@here und <@…>-Erwähnungen pingen nicht */
function defuse(value: string): string {
  return value.replaceAll('@', '@​');
}

/** Steht der Ping im Text selbst ({ping} oder GalaxyBots %PING%)? Dann nicht zusätzlich davor setzen. */
export function alertTextHasPing(text: string): boolean {
  return text.includes('{ping}') || text.includes('%PING%');
}

/** Platzhalter füllen – auch die von GalaxyBot (%PING%, %STREAMER%, %TITLE%), damit übernommene Texte gehen */
export function fillAlertText(text: string, ctx: { streamer: string; title?: string; game?: string; url: string; ping?: string }): string {
  return text
    .replaceAll('%PING%', ctx.ping ?? '')
    .replaceAll('{ping}', ctx.ping ?? '')
    .replaceAll('%STREAMER%', defuse(ctx.streamer))
    .replaceAll('%TITLE%', defuse(ctx.title || '–'))
    .replaceAll('{streamer}', defuse(ctx.streamer))
    .replaceAll('{title}', defuse(ctx.title || '–'))
    .replaceAll('{game}', defuse(ctx.game || '–'))
    .replaceAll('{url}', ctx.url)
    .trim()
    .slice(0, 2000);
}

/** Braucht diese Darstellung einen vorhandenen Ziel-Kanal? (Kanal/Kategorie legt der Bot an, Event optional) */
export function needsTargetChannel(data: Pick<FeedData, 'platform' | 'display'>): boolean {
  return data.platform === 'youtube' || data.display === 'classic';
}

/** Kanalname für die Darstellung „Kanal“/„Kategorie“ (Discord: klein, Bindestriche) */
export function streamChannelName(name: string, live: boolean): string {
  const base = name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'stream';
  return `${live ? '🔴' : '⚫'}│${base}`;
}

/** Konfiguration des Moduls selbst (alles Wichtige steckt in den Feeds) */
export const alertsConfigSchema = z.object({});
export type AlertsConfig = z.infer<typeof alertsConfigSchema>;
export function parseAlertsConfig(raw: unknown): AlertsConfig {
  const parsed = alertsConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}
