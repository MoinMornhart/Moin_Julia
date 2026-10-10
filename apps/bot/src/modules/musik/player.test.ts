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

const { GuildMusic } = await import('./player.js');

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
