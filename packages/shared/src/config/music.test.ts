import { describe, expect, it } from 'vitest';
import { checkAudioUrl, formatClock, isPrivateAddress, parseMusicConfig, titleFromUrl } from './music.js';

describe('Musik', () => {
  it('erkennt private Adressen (Schutz vor Zugriff aufs Heimnetz)', () => {
    for (const ip of ['10.0.0.5', '127.0.0.1', '192.168.1.20', '172.16.0.1', '172.31.255.255', '169.254.1.1', '100.64.0.1', '::1', 'fd12::1', 'fe80::1', '::ffff:192.168.0.1', '0.0.0.0'])
      expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ['8.8.8.8', '172.32.0.1', '100.128.0.1', '2a00:1450::1', '193.168.1.1']) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it('prüft Links', () => {
    expect(checkAudioUrl('https://stream.example.de/live.mp3')).toMatchObject({ ok: true, host: 'stream.example.de' });
    expect(checkAudioUrl('ftp://x/y.mp3').ok).toBe(false);
    expect(checkAudioUrl('https://user:pass@x.de/a.mp3').ok).toBe(false);
    expect(checkAudioUrl('https://www.youtube.com/watch?v=abc')).toMatchObject({ ok: false, error: expect.stringContaining('YouTube') });
    expect(checkAudioUrl('https://open.spotify.com/track/1').ok).toBe(false);
    expect(checkAudioUrl('kein link').ok).toBe(false);
  });

  it('Titel aus Dateinamen und Zeitanzeige', () => {
    expect(titleFromUrl('https://x.de/musik/Mein%20Lied_live.mp3?token=1')).toBe('Mein Lied live');
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(3_725_000)).toBe('1:02:05');
    expect(parseMusicConfig({}).defaultVolume).toBe(50);
  });
});
