import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HlsBlockedError, openStream } from '../modules/musik/source.js';
import { BlockedAddressError, fetchPublicImage, readCapped, safeGet } from './safe-fetch.js';

/** Echter kleiner Server auf 127.0.0.1 – „gesperrt“ ist in den Tests 127.0.0.2 */
let base = '';
const server = http.createServer((req, res) => {
  const send = (status: number, body: string, headers: Record<string, string> = {}) => {
    res.writeHead(status, headers);
    res.end(body);
  };
  if (req.url === '/audio.mp3') return send(200, 'AUDIODATEN', { 'content-type': 'audio/mpeg' });
  if (req.url === '/weiter') return send(302, '', { location: '/audio.mp3' });
  if (req.url === '/ins-heimnetz') return send(302, '', { location: 'http://127.0.0.2:9/geheim' });
  if (req.url === '/ins-heimnetz-v6') return send(302, '', { location: 'http://[::ffff:7f00:2]:9/geheim' });
  if (req.url === '/liste.pls') return send(200, `[playlist]\nFile1=${base}/audio.mp3\n`, { 'content-type': 'audio/x-scpls' });
  if (req.url === '/boese.pls') return send(200, '[playlist]\nFile1=http://127.0.0.2:9/geheim\n', { 'content-type': 'audio/x-scpls' });
  if (req.url === '/live.m3u8') return send(200, '#EXTM3U\n#EXT-X-VERSION:3\nseg1.ts\n', { 'content-type': 'application/vnd.apple.mpegurl' });
  if (req.url === '/gross') return send(200, 'x'.repeat(5000));
  send(404, 'nein');
});

const blocked = (ip: string) => ip === '127.0.0.2' || ip === '::ffff:7f00:2';
const get: typeof safeGet = (url, opts) => safeGet(url, { ...opts, isBlocked: blocked });

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('Geschütztes Abrufen (SSRF-Schutz)', () => {
  it('folgt Weiterleitungen und liest den Inhalt', async () => {
    const { res, url } = await get(`${base}/weiter`);
    expect(url).toBe(`${base}/audio.mp3`);
    expect((await readCapped(res, 1000))?.toString()).toBe('AUDIODATEN');
  });

  it('blockiert Weiterleitungen ins Heimnetz – auch in IPv6-Schreibweise', async () => {
    await expect(get(`${base}/ins-heimnetz`)).rejects.toBeInstanceOf(BlockedAddressError);
    await expect(get(`${base}/ins-heimnetz-v6`)).rejects.toBeInstanceOf(BlockedAddressError);
  });

  it('prüft die Adresse beim Verbinden (DNS-Namen wie localhost)', async () => {
    const port = new URL(base).port;
    await expect(safeGet(`http://localhost:${port}/audio.mp3`)).rejects.toBeInstanceOf(BlockedAddressError);
    await expect(safeGet(`${base}/audio.mp3`)).rejects.toBeInstanceOf(BlockedAddressError);
    const { res } = await safeGet(`${base}/audio.mp3`, { allowPrivate: true });
    res.destroy();
  });

  it('lehnt andere Protokolle und Zugangsdaten ab, begrenzt die Größe', async () => {
    await expect(get('file:///etc/passwd')).rejects.toThrow('Nur http');
    await expect(get(`http://a:b@127.0.0.1/`)).rejects.toThrow('Zugangsdaten');
    const { res } = await get(`${base}/gross`);
    expect(await readCapped(res, 100)).toBeNull();
  });

  it('Bilder für Willkommenskarten: Heimnetz gesperrt', async () => {
    expect(await fetchPublicImage(`${base}/audio.mp3`)).toBeNull();
  });

  it('Musik: Playlists aufgelöst, Link darin genauso geprüft, HLS nur mit Freigabe', async () => {
    const ok = await openStream(`${base}/liste.pls`, { allowPrivate: false, get });
    expect(ok.kind).toBe('pipe');
    if (ok.kind === 'pipe') expect((await readCapped(ok.res, 1000))?.toString()).toBe('AUDIODATEN');
    await expect(openStream(`${base}/boese.pls`, { allowPrivate: false, get })).rejects.toBeInstanceOf(BlockedAddressError);
    await expect(openStream(`${base}/live.m3u8`, { allowPrivate: false, get })).rejects.toBeInstanceOf(HlsBlockedError);
    expect(await openStream(`${base}/live.m3u8`, { allowPrivate: true, get })).toEqual({ kind: 'url', url: `${base}/live.m3u8` });
  });
});
