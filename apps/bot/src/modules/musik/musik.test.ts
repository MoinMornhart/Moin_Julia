import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';
import { canControl } from './index.js';
import { MusicQueue, type Track } from './queue.js';
import { ffmpegArgs, getStation, openStream, playlistUrl, searchStations, spawnFfmpeg, vetUrl } from './source.js';

const track = (n: number): Track => ({ title: `T${n}`, url: `https://x.de/${n}.mp3`, kind: 'file', requestedBy: 'u' });

describe('Warteschlange', () => {
  it('stellt an, spielt nacheinander, meldet „voll“', () => {
    const q = new MusicQueue();
    expect(q.add(track(1), 3)).toBe(1);
    expect(q.next()?.title).toBe('T1');
    expect(q.add(track(2), 3)).toBe(2);
    expect(q.add(track(3), 3)).toBe(3);
    expect(q.add(track(4), 3)).toBe('full');
    expect(q.next()?.title).toBe('T2');
    expect(q.next()?.title).toBe('T3');
    expect(q.next()).toBeNull();
  });

  it('Titel wiederholen: next bleibt, skip geht weiter', () => {
    const q = new MusicQueue();
    q.add(track(1), 10);
    q.add(track(2), 10);
    q.next();
    q.loop = 'track';
    expect(q.next()?.title).toBe('T1');
    expect(q.skip()?.title).toBe('T2');
  });

  it('Warteschlange wiederholen: Titel kommen hinten wieder dran', () => {
    const q = new MusicQueue();
    q.add(track(1), 10);
    q.add(track(2), 10);
    q.loop = 'queue';
    q.next();
    expect([q.next()?.title, q.next()?.title, q.next()?.title]).toEqual(['T2', 'T1', 'T2']);
  });
});

describe('Quellen', () => {
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

  it('Radio-Suche und Sender per ID', async () => {
    const f = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('/stations/search')) {
        expect(u).toContain('name=1live');
        return json([
          { stationuuid: 'abc-123-def', name: '1LIVE', url_resolved: 'https://wdr.de/1live.mp3', countrycode: 'DE', codec: 'MP3', bitrate: 128 },
          { stationuuid: 'kaputt', name: 'ohne Link', url: '' },
        ]);
      }
      return json([{ stationuuid: 'abc-123-def', name: '1LIVE', url: 'https://wdr.de/1live.mp3' }]);
    }) as unknown as typeof fetch;
    expect(await searchStations('1live', f)).toEqual([{ uuid: 'abc-123-def', name: '1LIVE', url: 'https://wdr.de/1live.mp3', country: 'DE', codec: 'MP3', bitrate: 128 }]);
    expect(await searchStations('x', f)).toEqual([]);
    expect((await getStation('abc-123-def', f))?.name).toBe('1LIVE');
    expect(await getStation('../../etc', f)).toBeNull();
  });

  it('Links: Heimnetz gesperrt (auch über DNS), freigeschaltet erlaubt, YouTube nie', async () => {
    const resolve = async (host: string) => (host === 'nas.local' ? ['192.168.1.20'] : host === 'trick.example' ? ['8.8.8.8', '10.0.0.1'] : ['93.184.216.34']);
    expect(await vetUrl('https://stream.example.de/live.mp3', false, resolve)).toEqual({ ok: true, url: 'https://stream.example.de/live.mp3' });
    expect(await vetUrl('http://nas.local/musik/a.mp3', false, resolve)).toEqual({ ok: false, reason: 'private' });
    expect(await vetUrl('http://192.168.1.20/a.mp3', false, resolve)).toEqual({ ok: false, reason: 'private' });
    expect(await vetUrl('http://trick.example/a.mp3', false, resolve)).toEqual({ ok: false, reason: 'private' });
    expect((await vetUrl('http://nas.local/musik/a.mp3', true, resolve)).ok).toBe(true);
    expect(await vetUrl('https://youtu.be/abc', true, resolve)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('Playlists (.pls/.m3u): erster Stream-Link', () => {
    expect(playlistUrl('[playlist]\nFile1=https://stream.radio.de/live\nTitle1=Radio')).toBe('https://stream.radio.de/live');
    expect(playlistUrl('#EXTM3U\n#EXTINF:-1,Radio\nhttps://stream2.radio.de/a.mp3\n')).toBe('https://stream2.radio.de/a.mp3');
    expect(playlistUrl('nichts')).toBeNull();
  });

  it('ffmpeg: Daten nur per Pipe, keine fremden Protokolle', () => {
    const args = ffmpegArgs('pipe:0', 50);
    expect(args.slice(args.indexOf('-protocol_whitelist'), args.indexOf('-protocol_whitelist') + 2)).toEqual(['-protocol_whitelist', 'pipe']);
    expect(args).not.toContain('-reconnect');
    expect(ffmpegArgs('https://x.de/live.m3u8', 50)).toContain('http,https,tcp,tls,crypto');
  });

  it('ffmpeg-Argumente: Lautstärke, Sprung, Ogg/Opus', () => {
    const args = ffmpegArgs('https://x.de/a.mp3', 35, 12_500);
    expect(args).toContain('volume=0.35');
    expect(args.slice(args.indexOf('-ss'), args.indexOf('-ss') + 2)).toEqual(['-ss', '12.5']);
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
    expect(args.slice(-5)).toEqual(['-b:a', '128k', '-f', 'ogg', 'pipe:1']);
  });
});

describe('Rechte', () => {
  const member = (opts: { admin?: boolean; roles?: string[]; voice?: string | null }) =>
    ({
      permissions: { has: (p: bigint) => p === PermissionFlagsBits.ManageGuild && !!opts.admin },
      roles: { cache: new Map((opts.roles ?? []).map((r) => [r, {}])) },
      voice: { channelId: opts.voice ?? null },
    }) as never;
  it('DJ-Rollen, sonst wer im selben Kanal ist', () => {
    expect(canControl(member({ admin: true }), { djRoleIds: ['dj'] }, 'v1')).toBe(true);
    expect(canControl(member({ roles: ['dj'] }), { djRoleIds: ['dj'] }, 'v1')).toBe(true);
    expect(canControl(member({ voice: 'v1' }), { djRoleIds: ['dj'] }, 'v1')).toBe(false);
    expect(canControl(member({ voice: 'v1' }), { djRoleIds: [] }, 'v1')).toBe(true);
    expect(canControl(member({ voice: 'v2' }), { djRoleIds: [] }, 'v1')).toBe(false);
    expect(canControl(member({ voice: null }), { djRoleIds: [] }, null)).toBe(true);
  });
});

// Echter Durchlauf mit ffmpeg (nur wenn ffmpeg installiert ist – im Docker-Image ja)
const hasFfmpeg = spawnSync(process.env.FFMPEG_PATH ?? 'ffmpeg', ['-version']).status === 0;
describe.skipIf(!hasFfmpeg)('ffmpeg wirklich', () => {
  it('Node holt eine MP3 (geprüft), ffmpeg bekommt sie per Pipe und liefert gültiges Ogg/Opus für discordjs/voice', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'moin-musik-'));
    const mp3 = path.join(dir, 'ton.mp3');
    spawnSync(process.env.FFMPEG_PATH ?? 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:a', 'libmp3lame', mp3]);
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'audio/mpeg' });
      res.end(readFileSync(mp3));
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as AddressInfo).port;
    try {
      // Heimnetz-Adresse: nur mit Freigabe (ohne → gesperrt)
      await expect(openStream(`http://127.0.0.1:${port}/ton.mp3`, { allowPrivate: false })).rejects.toThrow();
      const opened = await openStream(`http://127.0.0.1:${port}/ton.mp3`, { allowPrivate: true });
      if (opened.kind !== 'pipe') throw new Error('Pipe erwartet');
      const proc = spawnFfmpeg('pipe:0', 50, 300);
      opened.res.pipe(proc.stdin);
      const chunks: Buffer[] = [];
      for await (const chunk of proc.stdout) chunks.push(chunk as Buffer);
      const ogg = Buffer.concat(chunks);
      expect(ogg.subarray(0, 4).toString()).toBe('OggS');
      expect(ogg.includes(Buffer.from('OpusHead'))).toBe(true);
      // Mit discordjs/voice demuxen: es müssen Opus-Pakete herauskommen (2 s ≈ 100 Pakete à 20 ms)
      const { createAudioResource, StreamType } = await import('@discordjs/voice');
      const { Readable } = await import('node:stream');
      const resource = createAudioResource(Readable.from([ogg]), { inputType: StreamType.OggOpus });
      let packets = 0;
      for await (const _packet of resource.playStream) packets++;
      expect(packets).toBeGreaterThan(80);
    } finally {
      server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
