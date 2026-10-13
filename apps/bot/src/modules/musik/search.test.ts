import { describe, expect, it, vi } from 'vitest';
import { radioOnlyQuery, rankResults, scoreResult } from './search.js';
import { findStations } from './source.js';
import { MusicQueue } from './queue.js';

const t = (title: string, minutes: number, author = '') => ({ title, author, durationMs: minutes * 60_000 });

describe('Bessere Musik-Suche', () => {
  it('nimmt das echte Lied statt Live, 1-Stunde-Version oder Reaction', () => {
    const results = [t('Sido - Bilder im Kopf (Live @ Rock am Ring)', 5), t('Bilder im Kopf 1 Hour Loop', 60), t('REACTION: Sido Bilder im Kopf', 12), t('Sido - Bilder im Kopf (Official Video)', 4, 'SidoVEVO')];
    expect(rankResults('sido bilder im kopf', results)[0]!.title).toBe('Sido - Bilder im Kopf (Official Video)');
  });

  it('wer „live“ sucht, bekommt live', () => {
    const results = [t('Song (Official Audio)', 3), t('Song live in Berlin', 6)];
    expect(rankResults('song live', results)[0]!.title).toBe('Song live in Berlin');
  });

  it('Gleichstand behält die Reihenfolge; Bewertung zählt Wörter', () => {
    expect(rankResults('x', [t('a', 3), t('b', 3)]).map((r) => r.title)).toEqual(['a', 'b']);
    expect(scoreResult('abc def', t('abc def', 3))).toBeGreaterThan(scoreResult('abc def', t('abc', 3)));
  });

  it('„radio …“ sucht gezielt Sender', () => {
    expect(radioOnlyQuery('radio 1live')).toBe('1live');
    expect(radioOnlyQuery('Radio: Rock')).toBe('Rock');
    expect(radioOnlyQuery('radiohead creep')).toBeNull();
  });

  it('Radio: findet nichts per Name → sucht nach Genre, ohne Doppelte', async () => {
    const f = vi.fn(async (url: string) => {
      const byTag = url.includes('tag=');
      const list = byTag ? [{ stationuuid: 'aaaaaaaa-1', name: 'Rock Antenne', url_resolved: 'https://x.de/a.mp3' }] : [];
      return { ok: true, json: async () => list } as Response;
    });
    const found = await findStations('Rock', f as never, 5);
    expect(found.map((s) => s.name)).toEqual(['Rock Antenne']);
    expect(f.mock.calls.some(([u]) => String(u).includes('tag=rock'))).toBe(true);
  });
});

describe('Warteschlange bearbeiten', () => {
  const tr = (n: string) => ({ title: n, url: `https://x.de/${n}.mp3`, kind: 'file' as const, requestedBy: '1' });
  it('verschieben und leeren', () => {
    const q = new MusicQueue();
    q.addMany([tr('a'), tr('b'), tr('c'), tr('d')], 50);
    q.next();
    expect(q.upcoming.map((x) => x.title)).toEqual(['b', 'c', 'd']);
    expect(q.move(3, 1)?.title).toBe('d');
    expect(q.upcoming.map((x) => x.title)).toEqual(['d', 'b', 'c']);
    expect(q.move(9, 1)).toBeNull();
    expect(q.clearUpcoming()).toBe(3);
    expect(q.upcoming).toEqual([]);
    expect(q.current?.title).toBe('a');
  });
});
