import { describe, expect, it, vi } from 'vitest';
import { parseFeedState } from '@moin/shared';
import { decideLive, formatDuration, parseWatchPage, parseYoutubeFeed, rememberSeen, selectNewVideos, twitchThumbnail, youtubeFeedTitle } from './logic.js';
import { forgetTokens, kickStreams, twitchStreams } from './platforms.js';

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>Moin &amp; Julia</title>
 <entry>
  <yt:videoId>new2222222a</yt:videoId>
  <title>Neues Video &quot;zwei&quot;</title>
  <author><name>Moin &amp; Julia</name></author>
  <published>2026-10-08T12:00:00+00:00</published>
  <media:group><media:thumbnail url="https://i.ytimg.com/vi/new2222222a/hqdefault.jpg" width="480" height="360"/></media:group>
 </entry>
 <entry>
  <yt:videoId>new1111111a</yt:videoId>
  <title>Video eins</title>
  <author><name>Moin &amp; Julia</name></author>
  <published>2026-10-08T10:00:00+00:00</published>
 </entry>
 <entry>
  <yt:videoId>old0000000a</yt:videoId>
  <title>Alt</title>
  <author><name>Moin &amp; Julia</name></author>
  <published>2026-01-01T10:00:00+00:00</published>
 </entry>
</feed>`;

const stream = { id: 's1', title: 'Hallo', game: 'Minecraft', viewers: 3, startedAt: '2026-10-08T10:00:00Z', thumbnail: null, displayName: 'Abc' };

describe('Live-Entscheidung', () => {
  it('startet, beendet und erkennt neue Streams', () => {
    const idle = parseFeedState({});
    const live = parseFeedState({ live: { streamId: 's1', startedAt: '2026-10-08T10:00:00Z' } });
    expect(decideLive(idle, stream)).toBe('start');
    expect(decideLive(live, stream)).toBe('none');
    expect(decideLive(live, null)).toBe('end');
    expect(decideLive(live, { ...stream, id: 's2' })).toBe('restart');
    expect(decideLive(idle, null)).toBe('none');
  });
});

describe('YouTube', () => {
  it('liest den RSS-Feed', () => {
    const entries = parseYoutubeFeed(FEED);
    expect(entries.map((e) => e.videoId)).toEqual(['new2222222a', 'new1111111a', 'old0000000a']);
    expect(entries[0]).toMatchObject({ title: 'Neues Video "zwei"', author: 'Moin & Julia', thumbnail: 'https://i.ytimg.com/vi/new2222222a/hqdefault.jpg' });
    expect(youtubeFeedTitle(FEED)).toBe('Moin & Julia');
  });

  it('meldet beim ersten Lauf nichts und danach nur neue, aktuelle Videos – älteste zuerst', () => {
    const entries = parseYoutubeFeed(FEED);
    const now = new Date('2026-10-08T13:00:00Z');
    expect(selectNewVideos(parseFeedState({}), entries, now)).toEqual([]);
    const state = parseFeedState({ initialized: true, seen: [] });
    expect(selectNewVideos(state, entries, now).map((e) => e.videoId)).toEqual(['new1111111a', 'new2222222a']);
    const seen = parseFeedState({ initialized: true, seen: ['new1111111a'] });
    expect(selectNewVideos(seen, entries, now).map((e) => e.videoId)).toEqual(['new2222222a']);
  });

  it('merkt sich höchstens 60 Videos', () => {
    const many = Array.from({ length: 70 }, (_, i) => `v${i}`);
    expect(rememberSeen(many, ['neu'])).toHaveLength(60);
    expect(rememberSeen(['a', 'b'], ['b', 'c'])).toEqual(['b', 'c', 'a']);
  });

  it('erkennt Live und geplante Streams auf der Videoseite', () => {
    expect(parseWatchPage('…"isLiveNow":true…')).toEqual({ liveNow: true, upcoming: false });
    expect(parseWatchPage('…"isUpcoming":true…')).toEqual({ liveNow: false, upcoming: true });
    expect(parseWatchPage('<html>')).toEqual({ liveNow: false, upcoming: false });
  });
});

describe('Hilfen', () => {
  it('formatiert Dauer und Vorschaubild', () => {
    expect(formatDuration(45 * 60_000)).toBe('45 min');
    expect(formatDuration(133 * 60_000)).toBe('2 h 13 min');
    expect(twitchThumbnail('https://x/live_user_abc-{width}x{height}.jpg', 120_000)).toBe('https://x/live_user_abc-1280x720.jpg?t=2');
  });
});

describe('Plattform-Abfragen', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('Twitch: holt Token einmal, bündelt Kanäle, lädt Profilbilder', async () => {
    forgetTokens();
    const calls: string[] = [];
    const f = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      calls.push(u);
      if (u.includes('/oauth2/token')) return json({ access_token: 'tok', expires_in: 3600 });
      if (u.includes('/streams')) return json({ data: [{ id: '9', user_login: 'Abc', user_name: 'Abc', game_name: 'Minecraft', title: 'Hi', viewer_count: 5, started_at: '2026-10-08T10:00:00Z', thumbnail_url: 'x', type: 'live' }] });
      if (u.includes('/users')) return json({ data: [{ login: 'abc', profile_image_url: 'https://img/abc.png' }] });
      return json({}, 404);
    }) as unknown as typeof fetch;
    const result = await twitchStreams(['abc', 'def'], { clientId: 'id', secret: 's' }, f);
    expect(result.get('abc')).toMatchObject({ id: '9', game: 'Minecraft', avatar: 'https://img/abc.png' });
    expect(result.has('def')).toBe(false);
    expect(calls.find((c) => c.includes('/streams'))).toContain('user_login=abc&user_login=def');
    await twitchStreams(['abc'], { clientId: 'id', secret: 's' }, f);
    expect(calls.filter((c) => c.includes('/oauth2/token'))).toHaveLength(1);
  });

  it('Twitch: falsche Zugangsdaten werfen einen verständlichen Fehler', async () => {
    forgetTokens();
    const f = (async () => json({ message: 'invalid client' }, 403)) as unknown as typeof fetch;
    await expect(twitchStreams(['abc'], { clientId: 'x', secret: 'y' }, f)).rejects.toThrow(/Client-ID\/Secret prüfen/);
  });

  it('Kick: nur laufende Streams', async () => {
    forgetTokens();
    const f = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('/oauth/token')) return json({ access_token: 'tok', expires_in: 3600 });
      return json({ data: [
        { slug: 'live-one', stream_title: 'Live!', category: { name: 'IRL' }, stream: { is_live: true, start_time: '2026-10-08T10:00:00Z', viewer_count: 7 } },
        { slug: 'offline', stream: { is_live: false } },
      ] });
    }) as unknown as typeof fetch;
    const result = await kickStreams(['live-one', 'offline'], { clientId: 'id', secret: 's' }, f);
    expect([...result.keys()]).toEqual(['live-one']);
    expect(result.get('live-one')).toMatchObject({ title: 'Live!', game: 'IRL', viewers: 7 });
  });
});
