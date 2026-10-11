import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** Nachgebautes ffmpeg: liefert Ton erst, wenn der Test es sagt */
class FakeFfmpeg extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  stdin = new PassThrough();
  exitCode: number | null = null;
  killed = false;
  constructor(readonly seekMs: number) {
    super();
  }
  sound(): void {
    this.stdout.write(Buffer.alloc(3840 * 10));
  }
  kill(): boolean {
    this.killed = true;
    this.exitCode = 0;
    this.stdout.end();
    this.emit('exit', 0);
    return true;
  }
}

const spawned: FakeFfmpeg[] = [];
let autoSound = true;
vi.mock('./source.js', () => ({
  openStream: vi.fn(async (url: string) => ({ kind: 'url', url })),
  spawnFfmpeg: vi.fn((_input: string, seekMs: number) => {
    const f = new FakeFfmpeg(seekMs);
    spawned.push(f);
    // normaler Start: sofort Ton (im Effekt-Test liefert der Test den Ton selbst)
    if (autoSound) setImmediate(() => f.sound());
    return f;
  }),
}));
vi.mock('./youtube.js', () => ({ ytRelated: vi.fn(), ytStream: vi.fn() }));

const { GuildMusic, NORMALIZE_FILTER, resolveLazy, shouldResume } = await import('./player.js');
const source = await import('./source.js');

function music() {
  const bot = { logger: { warn: vi.fn(), debug: vi.fn() }, redis: { set: vi.fn(async () => 'OK') } };
  const guild = { id: '100000000000000001' };
  return new GuildMusic(bot as never, guild as never, 50, 60_000, vi.fn());
}

const track = { title: 'Lied', url: 'https://example.org/lied.mp3', kind: 'file' as const, requestedBy: '1', durationMs: 180_000 };

afterEach(() => {
  spawned.length = 0;
  autoSound = true;
});

describe('Musik nahtlos', () => {
  it('Lautstärke ändern startet NICHTS neu (kein neues ffmpeg, keine Lücke)', async () => {
    const gm = music();
    await gm.enqueue(track, 50);
    expect(spawned).toHaveLength(1);
    const resource = (gm as unknown as { resource: { volume: { volume: number } } }).resource;
    expect(resource.volume.volume).toBeCloseTo(0.5);
    await gm.setVolume(80);
    await gm.setVolume(20);
    expect(spawned).toHaveLength(1);
    expect(spawned[0]!.killed).toBe(false);
    expect(resource.volume.volume).toBeCloseTo(0.2);
    expect(gm.volume).toBe(20);
    gm.destroy();
  });

  it('Effekt-Wechsel: alter Ton läuft weiter, bis der neue da ist – Start etwas weiter vorn', async () => {
    const gm = music();
    await gm.enqueue(track, 50);
    const first = spawned[0]!;
    autoSound = false;
    const change = gm.setEffect('bassboost');
    // neues ffmpeg läuft schon, das alte spielt noch
    await new Promise((r) => setTimeout(r, 20));
    expect(spawned).toHaveLength(2);
    expect(first.killed).toBe(false);
    spawned[1]!.sound();
    await change;
    // erst jetzt (neuer Ton da) ist das alte beendet
    expect(first.killed).toBe(true);
    expect(spawned[1]!.killed).toBe(false);
    // Startpunkt = aktuelle Stelle + erwartete Ladezeit (Standard 1,5 s)
    expect(spawned[1]!.seekMs).toBeGreaterThanOrEqual(1500);
    gm.destroy();
  });
});

describe('Musik: robust und guter Klang', () => {
  it('Abbruch mitten im Lied → an derselben Stelle wieder ansetzen (höchstens 2-mal)', async () => {
    const gm = music();
    await gm.enqueue(track, 50);
    expect(spawned).toHaveLength(1);
    // so tun, als liefe der Titel seit einer Minute, dann bricht der Datenstrom ab
    (gm as unknown as { startedAt: number }).startedAt = Date.now() - 60_000;
    // Datenstrom bricht ab → der Discord-Player meldet „fertig“ (ohne Sprachverbindung im Test direkt auslösen)
    spawned[0]!.stdout.end();
    (gm as unknown as { player: { emit: (e: string) => void } }).player.emit('idle');
    await new Promise((r) => setTimeout(r, 300));
    expect(spawned).toHaveLength(2);
    expect(spawned[1]!.seekMs).toBeGreaterThanOrEqual(59_000);
    expect(gm.queue.current?.url).toBe(track.url);
    expect(shouldResume({ kind: 'file', durationMs: 180_000 }, 60_000, 2)).toBe(false);
    expect(shouldResume({ kind: 'file', durationMs: 180_000 }, 175_000, 0)).toBe(false);
    expect(shouldResume({ kind: 'radio', durationMs: undefined }, 60_000, 0)).toBe(false);
    gm.destroy();
  });

  it('Selbstheilung: Player steht zweimal hintereinander still → weiter mit dem nächsten Titel', async () => {
    const gm = music();
    await gm.enqueue(track, 50);
    await gm.enqueue({ ...track, title: 'Zwei', url: 'https://example.org/zwei.mp3' }, 50);
    // so tun, als stünde der Discord-Player still (ohne dass „fertig“ gemeldet wurde)
    expect(await gm.checkStall('idle' as never)).toBeNull(); // erster Blick: noch abwarten
    expect(await gm.checkStall('idle' as never)).toContain('weiter mit dem nächsten Titel');
    expect(gm.queue.current?.title).toBe('Zwei');
    gm.destroy();
  });

  it('Lautstärkeausgleich läuft als Filter mit, lässt sich abschalten', async () => {
    const gm = music();
    await gm.enqueue(track, 50);
    const calls = vi.mocked(source.spawnFfmpeg).mock.calls;
    expect(calls.at(-1)![2]).toBe(NORMALIZE_FILTER);
    await gm.setNormalize(false);
    await new Promise((r) => setTimeout(r, 20));
    spawned.at(-1)!.sound();
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.at(-1)![2]).toBeUndefined();
    gm.destroy();
  });

  it('Spotify/Apple-Titel: YouTube-Suche erst bei Bedarf, gleichzeitige Aufrufe suchen nur einmal', async () => {
    const search = vi.fn(async () => [{ title: 'Song', url: 'https://www.youtube.com/watch?v=abc', durationMs: 200_000, author: 'Kanal', thumbnail: 'https://i.ytimg.com/x.jpg' }]);
    const lazy = { title: 'Blur – Song 2', url: '', query: 'Blur Song 2', kind: 'youtube' as const, requestedBy: '1' };
    const [a, b] = await Promise.all([resolveLazy(lazy, search as never), resolveLazy(lazy, search as never)]);
    expect(a && b).toBe(true);
    expect(search).toHaveBeenCalledTimes(1);
    expect(lazy.url).toBe('https://www.youtube.com/watch?v=abc');
    const missing = { title: 'x', url: '', query: 'gibt es nicht', kind: 'youtube' as const, requestedBy: '1' };
    expect(await resolveLazy(missing, (async () => []) as never)).toBe(false);
  });
});

describe('Keiner mehr im Sprachkanal', () => {
  function inChannel(humans: number) {
    const notify = vi.fn();
    const members = new Map(Array.from({ length: humans }, (_, i) => [`u${i}`, { user: { bot: false } }]));
    members.set('bot', { user: { bot: true } });
    const channel = { isVoiceBased: () => true, members: { filter: (fn: (m: { user: { bot: boolean } }) => boolean) => ({ size: [...members.values()].filter(fn).length }) } };
    const bot = { logger: { warn: vi.fn(), debug: vi.fn() }, redis: { set: vi.fn(async () => 'OK') } };
    const guild = { id: '100000000000000001', channels: { cache: new Map([['vc', channel]]) } };
    const gm = new GuildMusic(bot as never, guild as never, 50, 120_000, notify);
    const destroy = vi.spyOn(gm, 'destroy');
    Object.assign(gm, { connection: { destroy: vi.fn() }, channelId: 'vc' });
    gm.aloneAfterMs = 30_000;
    return { gm, notify, destroy, members };
  }

  it('geht nach der eigenen Wartezeit, auch wenn noch Musik laufen würde', () => {
    vi.useFakeTimers();
    const w = inChannel(0);
    w.gm.checkAlone();
    vi.advanceTimersByTime(29_000);
    expect(w.destroy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_500);
    expect(w.notify).toHaveBeenCalledWith('left');
    expect(w.destroy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('kommt jemand zurück, bleibt der Bot; 24/7 bleibt immer', () => {
    vi.useFakeTimers();
    const w = inChannel(0);
    w.gm.checkAlone();
    w.members.set('u9', { user: { bot: false } });
    w.gm.checkAlone();
    vi.advanceTimersByTime(60_000);
    expect(w.destroy).not.toHaveBeenCalled();

    const stay = inChannel(0);
    stay.gm.stay247 = true;
    stay.gm.checkAlone();
    vi.advanceTimersByTime(60_000);
    expect(stay.destroy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('kurz allein, dann wieder jemand da: zweite Prüfung beim Ablauf verhindert das Gehen', () => {
    vi.useFakeTimers();
    const w = inChannel(0);
    w.gm.checkAlone();
    w.members.set('u9', { user: { bot: false } }); // ohne Ereignis zurückgekommen
    vi.advanceTimersByTime(31_000);
    expect(w.destroy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
