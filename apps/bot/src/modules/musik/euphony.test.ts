import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { MUSIC_EFFECT_IDS, MUSIC_EFFECTS } from '@moin/shared';
import { votesNeeded } from './index.js';
import { cleanTitle, findLyrics } from './lyrics.js';
import { MusicQueue, type Track } from './queue.js';
import { ffmpegArgs } from './source.js';
import { streamingLinkQuery, toTrack, youtubeId } from './youtube.js';

const track = (n: number): Track => ({ title: `T${n}`, url: `https://x.de/${n}.mp3`, kind: 'file', requestedBy: 'u' });

describe('Warteschlange wie Euphony', () => {
  it('zurück, springen, entfernen, mischen', () => {
    const q = new MusicQueue();
    for (let i = 1; i <= 5; i++) q.add(track(i), 50);
    q.skip(); // T1 läuft
    q.skip(); // T2 läuft, T1 im Verlauf
    expect(q.current?.title).toBe('T2');
    expect(q.back()?.title).toBe('T1');
    expect(q.upcoming.map((t) => t.title)).toEqual(['T2', 'T3', 'T4', 'T5']);
    expect(q.jump(3)?.title).toBe('T4'); // T2, T3 übersprungen
    expect(q.upcoming.map((t) => t.title)).toEqual(['T5']);
    expect(q.remove(1)?.title).toBe('T5');
    expect(q.remove(1)).toBeNull();
    expect(q.jump(9)).toBeNull();
    for (let i = 6; i <= 9; i++) q.add(track(i), 50);
    q.shuffle(() => 0); // deterministisch
    expect(q.upcoming.map((t) => t.title).sort()).toEqual(['T6', 'T7', 'T8', 'T9']);
    expect(q.addMany([track(10), track(11), track(12)], 6)).toBe(1); // nur noch 1 Platz frei
  });

  it('Vote-Skip braucht 2/3 der Zuhörer', () => {
    expect(votesNeeded(1)).toBe(1);
    expect(votesNeeded(2)).toBe(2);
    expect(votesNeeded(3)).toBe(2);
    expect(votesNeeded(6)).toBe(4);
    expect(votesNeeded(0)).toBe(1);
  });
});

describe('YouTube & Co. (yt-dlp)', () => {
  it('liest Einträge von yt-dlp und erkennt Video-IDs', () => {
    expect(toTrack({ id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', duration: 214, channel: 'Rick Astley' })).toMatchObject({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      durationMs: 214_000,
      author: 'Rick Astley',
    });
    expect(toTrack({ url: 'http://192.168.1.1/x', title: 'böse' })).toBeNull(); // nur YouTube/SoundCloud
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/shorts/abcdefghijk')).toBe('abcdefghijk');
    expect(youtubeId('https://example.org/watch?v=x')).toBeNull();
  });

  it('Spotify-/Apple-Links → Suchbegriff aus den Seiten-Metadaten', async () => {
    const page = (html: string, url: string) => (async () => Object.defineProperty(new Response(html), 'url', { value: url })) as unknown as typeof fetch;
    const spotify = page('<meta property="og:title" content="Never Gonna Give You Up"/><meta property="og:description" content="Rick Astley · Whenever You Need Somebody · Song · 1987"/>', 'https://open.spotify.com/track/x');
    expect(await streamingLinkQuery('https://open.spotify.com/track/x', spotify)).toBe('Rick Astley Never Gonna Give You Up');
    const apple = page('<meta property="og:title" content="Never Gonna Give You Up von Rick Astley auf Apple&nbsp;Music"/>', 'https://music.apple.com/de/song/1');
    expect(await streamingLinkQuery('https://music.apple.com/de/song/1', apple)).toContain('Never Gonna Give You Up');
    // Weiterleitung auf einen fremden Host → nichts
    expect(await streamingLinkQuery('https://open.spotify.com/track/x', page('<meta property="og:title" content="x"/>', 'https://evil.example/'))).toBeNull();
    expect(await streamingLinkQuery('https://example.org/x', spotify)).toBeNull();
  });
});

describe('Liedtexte (lrclib.net)', () => {
  it('Titel säubern und passendste Version wählen', async () => {
    expect(cleanTitle('Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)')).toBe('Rick Astley - Never Gonna Give You Up');
    expect(cleanTitle('Song [Lyric Video] | Label')).toBe('Song');
    expect(cleanTitle('Get Lucky feat. Pharrell')).toBe('Get Lucky');
    let asked = '';
    const f = (async (url: string) => {
      asked = url;
      return new Response(
        JSON.stringify([
          { trackName: 'Lang', artistName: 'A', duration: 400, plainLyrics: 'falsch' },
          { trackName: 'Richtig', artistName: 'A', duration: 214, syncedLyrics: '[00:01.00] Hallo\n[00:02.00] Welt' },
        ]),
      );
    }) as unknown as typeof fetch;
    const found = await findLyrics('Song (Official Video)', 'Rick Astley - Topic', 213_000, f);
    expect(asked).toContain('q=Rick+Astley+Song');
    expect(found?.track).toBe('Richtig');
    expect(found?.synced).toHaveLength(2);
    expect(found?.plain).toBe('Hallo\nWelt');
  });
});

// Echter Durchlauf: jeder Effekt muss von ffmpeg akzeptiert werden
const hasFfmpeg = spawnSync(process.env.FFMPEG_PATH ?? 'ffmpeg', ['-version']).status === 0;
describe.skipIf(!hasFfmpeg)('Effekte mit echtem ffmpeg', () => {
  it('alle Effekte werden von ffmpeg akzeptiert und liefern Ton', () => {
    for (const id of MUSIC_EFFECT_IDS) {
      const args = ffmpegArgs('pipe:0', 0, MUSIC_EFFECTS[id].filter).map((a) => (a === 'pipe:0' ? 'sine=frequency=440:duration=1' : a));
      const i = args.indexOf('sine=frequency=440:duration=1');
      args.splice(i - 1, 0, '-f', 'lavfi'); // Testton statt Pipe
      const protocol = args.indexOf('-protocol_whitelist');
      args.splice(protocol, 2);
      const out = spawnSync(process.env.FFMPEG_PATH ?? 'ffmpeg', args, { maxBuffer: 10_000_000 });
      expect(out.status, `${id}: ${out.stderr?.toString().slice(0, 200)}`).toBe(0);
      expect(out.stdout.length, id).toBeGreaterThan(50_000);
    }
  }, 60_000);
});
