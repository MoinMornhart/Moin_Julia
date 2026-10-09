import { describe, expect, it } from 'vitest';
import { checkAudioUrl, formatClock, isPrivateAddress, parseMusicConfig, titleFromUrl } from './music.js';

describe('Musik', () => {
  it('erkennt private Adressen (Schutz vor Zugriff aufs Heimnetz)', () => {
    for (const ip of ['10.0.0.5', '127.0.0.1', '192.168.1.20', '172.16.0.1', '172.31.255.255', '169.254.1.1', '100.64.0.1', '::1', 'fd12::1', 'fe80::1', '::ffff:192.168.0.1', '0.0.0.0'])
      expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ['8.8.8.8', '172.32.0.1', '100.128.0.1', '2a00:1450::1', '193.168.1.1']) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it('erkennt auch versteckte private Adressen (IPv6-Schreibweisen aus dem Security-Audit)', () => {
    const hidden = [
      '::ffff:7f00:1', // 127.0.0.1 in Hex, so liefert es new URL()
      '[::ffff:c0a8:101]', // 192.168.1.1 mit Klammern
      '::ffff:0:a00:5', // falsche Form → unbekannt → blockiert
      '0:0:0:0:0:ffff:7f00:0001',
      '::127.0.0.1',
      '64:ff9b::c0a8:0101', // NAT64 → 192.168.1.1
      '2002:c0a8:0101::1', // 6to4 → 192.168.1.1
      '2001:0:4136:e378::1', // Teredo
      'fec0::1',
      'ff02::1',
      '::',
      'fe80::1%eth0',
      '198.18.0.1',
      '999.1.1.1', // kaputt → blockiert
      'kein-ip',
    ];
    for (const ip of hidden) expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ['::ffff:808:808', '64:ff9b::808:808', '2002:0808:0808::1', '2606:4700::1111']) expect(isPrivateAddress(ip), ip).toBe(false);
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

describe('Musik wie Euphony', () => {
  it('Zeitangaben und Fortschrittsbalken', async () => {
    const { parseTime, progressBar } = await import('./music.js');
    expect(parseTime('1:30')).toBe(90_000);
    expect(parseTime('90')).toBe(90_000);
    expect(parseTime('1:02:03')).toBe(3_723_000);
    expect(parseTime('1:75')).toBeNull();
    expect(parseTime('abc')).toBeNull();
    expect(progressBar(0, 100_000, 10)).toBe('🔘▬▬▬▬▬▬▬▬▬');
    expect(progressBar(50_000, 100_000, 10)).toBe('▬▬▬▬▬🔘▬▬▬▬');
    expect(progressBar(200_000, 100_000, 10)).toBe('▬▬▬▬▬▬▬▬▬🔘');
  });

  it('erkennt YouTube/SoundCloud sowie Spotify-/Apple-Links', async () => {
    const { isYtdlpUrl, streamingLinkKind } = await import('./music.js');
    expect(isYtdlpUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
    expect(isYtdlpUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    expect(isYtdlpUrl('https://music.youtube.com/watch?v=x')).toBe(true);
    expect(isYtdlpUrl('https://soundcloud.com/artist/track')).toBe(true);
    expect(isYtdlpUrl('https://evil-youtube.com.example/x')).toBe(false);
    expect(isYtdlpUrl('kein link')).toBe(false);
    expect(streamingLinkKind('https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8')).toBe('spotify');
    expect(streamingLinkKind('https://music.apple.com/de/album/x/1?i=2')).toBe('apple');
    expect(streamingLinkKind('https://example.org')).toBeNull();
  });

  it('synchronisierte Liedtexte: Zeilen und Ausschnitt um die aktuelle Stelle', async () => {
    const { parseSyncedLyrics, lyricsWindow } = await import('./music.js');
    const lines = parseSyncedLyrics('[00:18.90] We’re no strangers to love\n[00:22.61] You know the rules\n[00:26.94] A full commitment\nkein Zeitstempel\n[01:05] Never gonna');
    expect(lines.map((l) => l.ms)).toEqual([18_900, 22_610, 26_940, 65_000]);
    const w = lyricsWindow(lines, 23_000, 1, 1);
    expect(w).toEqual([
      { text: 'We’re no strangers to love', current: false },
      { text: 'You know the rules', current: true },
      { text: 'A full commitment', current: false },
    ]);
    expect(lyricsWindow(lines, 0, 1, 1)[0]).toEqual({ text: 'We’re no strangers to love', current: false });
  });

  it('Effekte haben alle einen Filter und Namen in beiden Sprachen', async () => {
    const { MUSIC_EFFECTS, isMusicEffect } = await import('./music.js');
    for (const [id, fx] of Object.entries(MUSIC_EFFECTS)) expect(fx.filter && fx.de && fx.en && fx.emoji, id).toBeTruthy();
    expect(isMusicEffect('nightcore')).toBe(true);
    expect(isMusicEffect('toString')).toBe(false);
  });
});
