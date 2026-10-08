import type { FeedState } from '@moin/shared';

/** Ein laufender Stream, egal von welcher Plattform */
export interface LiveStream {
  id: string;
  title: string;
  game: string;
  viewers: number | null;
  startedAt: string;
  thumbnail: string | null;
  displayName: string;
  avatar?: string | null;
}

export interface FeedEntry {
  videoId: string;
  title: string;
  published: string;
  author: string;
  thumbnail: string | null;
}

/** Was mit der Live-Meldung passieren soll */
export function decideLive(state: FeedState, stream: LiveStream | null): 'start' | 'end' | 'restart' | 'none' {
  if (stream && !state.live) return 'start';
  if (!stream && state.live) return 'end';
  if (stream && state.live && state.live.streamId !== stream.id) return 'restart';
  return 'none';
}

const decode = (s: string) =>
  s
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');

/** YouTube-RSS (Atom) → Einträge, neueste zuerst wie im Feed */
export function parseYoutubeFeed(xml: string): FeedEntry[] {
  const entries: FeedEntry[] = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const body = m[1] ?? '';
    const videoId = body.match(/<yt:videoId>([\w-]{6,20})<\/yt:videoId>/)?.[1];
    if (!videoId) continue;
    entries.push({
      videoId,
      title: decode(body.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''),
      published: body.match(/<published>([^<]+)<\/published>/)?.[1] ?? '',
      author: decode(body.match(/<author>\s*<name>([\s\S]*?)<\/name>/)?.[1] ?? ''),
      thumbnail: body.match(/<media:thumbnail url="([^"]+)"/)?.[1] ?? null,
    });
  }
  return entries;
}

/** Name des Kanals aus dem Feed-Kopf */
export function youtubeFeedTitle(xml: string): string {
  const head = xml.split('<entry>')[0] ?? '';
  return decode(head.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');
}

/**
 * Neue Videos seit dem letzten Lauf, älteste zuerst. Beim ersten Lauf wird nur gemerkt (keine Flut
 * alter Videos), danach zählen nur Videos der letzten 3 Tage (falls der Feed alte Videos nachschiebt).
 */
export function selectNewVideos(state: FeedState, entries: FeedEntry[], now: Date): FeedEntry[] {
  if (!state.initialized) return [];
  const seen = new Set(state.seen);
  const cutoff = now.getTime() - 3 * 86_400_000;
  return entries
    .filter((e) => !seen.has(e.videoId))
    .filter((e) => {
      const t = Date.parse(e.published);
      return Number.isNaN(t) || t >= cutoff;
    })
    .reverse();
}

export function rememberSeen(seen: string[], ids: string[]): string[] {
  return [...ids, ...seen.filter((s) => !ids.includes(s))].slice(0, 60);
}

/** Was eine YouTube-Video-Seite über den Live-Status verrät */
export function parseWatchPage(html: string): { liveNow: boolean; upcoming: boolean } {
  return {
    liveNow: /"isLiveNow":\s*true/.test(html),
    upcoming: /"isUpcoming":\s*true/.test(html) || /"upcomingEventData"/.test(html),
  };
}

export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

/** Twitch-Vorschaubild in fester Größe, mit Zeitstempel gegen Discords Bild-Cache */
export function twitchThumbnail(template: string, now = Date.now()): string {
  return `${template.replace('{width}', '1280').replace('{height}', '720')}?t=${Math.floor(now / 60_000)}`;
}
