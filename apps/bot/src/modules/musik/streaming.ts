/**
 * Spotify- und Apple-Music-Links (Titel, Album, Playlist) → Titelliste „Künstler – Titel“.
 * Ohne API-Schlüssel: Spotify liefert die Liste auf seiner Einbettungsseite (open.spotify.com/embed/…),
 * Apple Music in den Seitendaten (serialized-server-data, sonst JSON-LD). Abgespielt wird dann der
 * passende YouTube-Treffer – gesucht erst kurz vor dem Abspielen (Track.query).
 * Nur feste Hosts → kein SSRF-Risiko.
 */

export interface StreamingTrack {
  title: string;
  artist: string;
  durationMs?: number;
}

export interface StreamingList {
  name: string;
  tracks: StreamingTrack[];
}

const SPOTIFY_PATH = /^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(track|album|playlist|artist)\/([A-Za-z0-9]{10,40})/;

/** Spotify-Link → Adresse der Einbettungsseite (die enthält die Titelliste) */
export function spotifyEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'open.spotify.com') return null;
    const m = u.pathname.match(SPOTIFY_PATH);
    return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
  } catch {
    return null;
  }
}

/** Titelliste aus der Spotify-Einbettungsseite (__NEXT_DATA__) */
export function parseSpotifyEmbed(html: string): StreamingList | null {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m?.[1]) return null;
  try {
    const data = JSON.parse(m[1]) as { props?: { pageProps?: { state?: { data?: { entity?: SpotifyEntity } } } } };
    const e = data.props?.pageProps?.state?.data?.entity;
    if (!e) return null;
    // Einzeltitel: die Seite beschreibt nur diesen Titel
    if (e.type === 'track') {
      const artist = (e.artists ?? []).map((a) => a.name).join(', ') || e.subtitle || '';
      return { name: e.name ?? e.title ?? '', tracks: [{ title: e.name ?? e.title ?? '', artist, durationMs: e.duration }] };
    }
    const tracks = (e.trackList ?? [])
      .filter((t) => t.isPlayable !== false && t.title)
      .map((t) => ({ title: t.title!, artist: t.subtitle ?? '', durationMs: t.duration }));
    return { name: e.name ?? e.title ?? '', tracks };
  } catch {
    return null;
  }
}

interface SpotifyEntity {
  type?: string;
  name?: string;
  title?: string;
  subtitle?: string;
  duration?: number;
  artists?: { name: string }[];
  trackList?: { title?: string; subtitle?: string; duration?: number; isPlayable?: boolean }[];
}

/** Titelliste einer Apple-Music-Seite (Album, Playlist, Titel) */
export function parseAppleMusic(html: string): StreamingList | null {
  // 1. Seitendaten mit Künstler je Titel
  const ssd = html.match(/<script[^>]*id="serialized-server-data"[^>]*>([\s\S]*?)<\/script>/);
  let name = '';
  const ld = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  let ldData: LdData | null = null;
  for (const x of ld) {
    try {
      const j = JSON.parse(x[1] ?? '') as LdData | null;
      if (j && /MusicAlbum|MusicPlaylist|MusicRecording/.test(String(j['@type']))) {
        ldData = j;
        break;
      }
    } catch {
      // nächstes
    }
  }
  name = ldData?.name ?? '';
  if (ssd?.[1]) {
    try {
      const items = findTrackLockups(JSON.parse(ssd[1]));
      if (items.length) {
        return {
          name,
          tracks: items.filter((i) => i.title).map((i) => ({ title: i.title!, artist: i.artistName ?? '', durationMs: typeof i.duration === 'number' ? i.duration : undefined })),
        };
      }
    } catch {
      // weiter mit JSON-LD
    }
  }
  if (!ldData) return null;
  const albumArtist = Array.isArray(ldData.byArtist) ? (ldData.byArtist[0]?.name ?? '') : (ldData.byArtist?.name ?? '');
  if (ldData['@type'] === 'MusicRecording') return { name, tracks: [{ title: name, artist: albumArtist }] };
  const list = ldData.tracks ?? ldData.track ?? [];
  return { name, tracks: list.filter((t) => t.name).map((t) => ({ title: t.name!, artist: albumArtist, durationMs: isoDuration(t.duration) })) };
}

type LdData = {
  '@type'?: string;
  name?: string;
  byArtist?: { name?: string }[] | { name?: string };
  tracks?: { name?: string; duration?: string }[];
  track?: { name?: string; duration?: string }[];
};

function findTrackLockups(root: unknown): { title?: string; artistName?: string; duration?: number }[] {
  let found: { title?: string; artistName?: string; duration?: number }[] = [];
  const walk = (o: unknown, depth: number): void => {
    if (found.length || !o || typeof o !== 'object' || depth > 40) return;
    const obj = o as { itemKind?: string; items?: unknown[] };
    if (obj.itemKind === 'trackLockup' && Array.isArray(obj.items)) {
      found = obj.items as typeof found;
      return;
    }
    for (const v of Object.values(o)) walk(v, depth + 1);
  };
  walk(root, 0);
  return found;
}

/** „PT4M18S“ → Millisekunden */
export function isoDuration(value: string | undefined): number | undefined {
  const m = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return undefined;
  return ((Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)) * 1000;
}

/** Suchbegriff für YouTube */
export function trackQuery(t: StreamingTrack): string {
  // Zusätze wie „ - Remastered 2009“ oder „(2011 Remaster)“ verschlechtern die YouTube-Suche
  const title = t.title.replace(/\s+-\s+[^-]*remaster[^-]*$/i, '').replace(/\s*[([][^)\]]*remaster[^)\]]*[)\]]/gi, '');
  return `${t.artist} ${title}`.replace(/\s+/g, ' ').trim();
}

/** Link holen (nur Spotify/Apple), Weiterleitungen (spotify.link) folgen, dann Titelliste lesen */
export async function streamingList(url: string, f: typeof fetch = fetch): Promise<StreamingList | null> {
  const headers = { 'user-agent': 'Mozilla/5.0 (compatible; MoinJulia/1.0)', 'accept-language': 'de-DE,de;q=0.9,en;q=0.8' };
  let target = url;
  // Kurzlinks (spotify.link) erst auflösen
  if (new URL(url).hostname === 'spotify.link') {
    const res = await f(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(8000) });
    target = res.url || url;
  }
  const host = new URL(target).hostname;
  if (host === 'open.spotify.com') {
    const embed = spotifyEmbedUrl(target);
    if (!embed) return null;
    const res = await f(embed, { headers, signal: AbortSignal.timeout(8000) });
    return res.ok ? parseSpotifyEmbed((await res.text()).slice(0, 3_000_000)) : null;
  }
  if (host === 'music.apple.com') {
    const res = await f(target, { headers, redirect: 'follow', signal: AbortSignal.timeout(10_000) });
    if (!res.ok || new URL(res.url || target).hostname !== 'music.apple.com') return null;
    return parseAppleMusic((await res.text()).slice(0, 5_000_000));
  }
  return null;
}

/**
 * Ganze Sammlung (Album/Playlist/Künstler) statt eines einzelnen Titels? Einzeltitel laufen weiter über
 * den bewährten Weg (ein Suchbegriff aus den Seiten-Metadaten).
 */
export function isStreamingCollection(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.hostname === 'spotify.link') return true; // Kurzlink: erst nach dem Auflösen klar – Liste mit 1 Titel geht auch
    if (u.hostname === 'open.spotify.com') return /\/(album|playlist|artist)\//.test(u.pathname);
    if (u.hostname === 'music.apple.com') return /\/(album|playlist)\//.test(u.pathname) && !u.searchParams.has('i');
  } catch {
    // kein Link
  }
  return false;
}
