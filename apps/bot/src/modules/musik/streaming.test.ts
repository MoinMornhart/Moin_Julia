import { describe, expect, it, vi } from 'vitest';
import { isoDuration, isStreamingCollection, parseAppleMusic, parseSpotifyEmbed, spotifyEmbedUrl, streamingList, trackQuery } from './streaming.js';

/** Nachbau der Spotify-Einbettungsseite (Aufbau wie am 11.10.2026 geprüft) */
const spotifyPage = (entity: unknown) => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { state: { data: { entity } } } } })}</script></html>`;

/** Nachbau einer Apple-Music-Seite: Seitendaten + JSON-LD */
const applePage = (items: unknown[], ld: unknown) =>
  `<html><script type="application/ld+json">${JSON.stringify(ld)}</script><script type="application/json" id="serialized-server-data">${JSON.stringify([{ data: { sections: [{ id: 'x', itemKind: 'trackLockup', items }] } }])}</script></html>`;

describe('Spotify/Apple-Playlists und -Alben', () => {
  it('erkennt Sammlungen – Einzeltitel bleiben Einzeltitel', () => {
    expect(isStreamingCollection('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(true);
    expect(isStreamingCollection('https://open.spotify.com/intl-de/album/1A2GTWGtFfWp7KSQTwWOyo')).toBe(true);
    expect(isStreamingCollection('https://open.spotify.com/track/3zOYmiNOuyDL0ClxJcEJ0T')).toBe(false);
    expect(isStreamingCollection('https://music.apple.com/de/album/abbey-road/1441164426')).toBe(true);
    expect(isStreamingCollection('https://music.apple.com/de/album/abbey-road/1441164426?i=1441164430')).toBe(false);
    expect(isStreamingCollection('https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb')).toBe(true);
    expect(isStreamingCollection('https://example.org/playlist/1')).toBe(false);
    expect(spotifyEmbedUrl('https://open.spotify.com/intl-de/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc')).toBe('https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M');
  });

  it('Spotify: Titelliste aus der Einbettungsseite, nicht abspielbare werden übersprungen', () => {
    const list = parseSpotifyEmbed(
      spotifyPage({
        type: 'playlist',
        name: 'Today’s Top Hits',
        trackList: [
          { title: 'Stop The Wedding!', subtitle: 'Ashe', duration: 198840, isPlayable: true },
          { title: 'Gesperrt', subtitle: 'X', isPlayable: false },
          { title: 'Song 2', subtitle: 'Blur, Damon Albarn', duration: 121000 },
        ],
      }),
    );
    expect(list).toEqual({
      name: 'Today’s Top Hits',
      tracks: [
        { title: 'Stop The Wedding!', artist: 'Ashe', durationMs: 198840 },
        { title: 'Song 2', artist: 'Blur, Damon Albarn', durationMs: 121000 },
      ],
    });
    expect(parseSpotifyEmbed('<html>kaputt</html>')).toBeNull();
  });

  it('Apple Music: Künstler je Titel aus den Seitendaten, sonst aus JSON-LD', () => {
    const page = applePage(
      [
        { title: 'Nicole Kidman', artistName: 'ADÉLA', duration: 181270 },
        { title: 'Come Together', artistName: 'The Beatles', duration: 258947 },
      ],
      { '@type': 'MusicPlaylist', name: 'Today’s Hits', track: [] },
    );
    expect(parseAppleMusic(page)).toEqual({
      name: 'Today’s Hits',
      tracks: [
        { title: 'Nicole Kidman', artist: 'ADÉLA', durationMs: 181270 },
        { title: 'Come Together', artist: 'The Beatles', durationMs: 258947 },
      ],
    });
    const onlyLd = `<script type="application/ld+json">${JSON.stringify({ '@type': 'MusicAlbum', name: 'Abbey Road', byArtist: [{ name: 'The Beatles' }], tracks: [{ name: 'Come Together', duration: 'PT4M18S' }] })}</script>`;
    expect(parseAppleMusic(onlyLd)).toEqual({ name: 'Abbey Road', tracks: [{ title: 'Come Together', artist: 'The Beatles', durationMs: 258_000 }] });
    expect(isoDuration('PT1H2M3S')).toBe(3_723_000);
    expect(trackQuery({ title: 'Come  Together', artist: 'The Beatles' })).toBe('The Beatles Come Together');
    expect(trackQuery({ title: 'Come Together - Remastered 2009', artist: 'The Beatles' })).toBe('The Beatles Come Together');
    expect(trackQuery({ title: 'Let It Be (2021 Remaster)', artist: 'The Beatles' })).toBe('The Beatles Let It Be');
    expect(trackQuery({ title: 'Hey - Ya!', artist: 'OutKast' })).toBe('OutKast Hey - Ya!');
  });

  it('holt nur von Spotify/Apple – andere Hosts nach Weiterleitung werden abgelehnt', async () => {
    const f = vi.fn(async (url: string) => {
      if (url.startsWith('https://open.spotify.com/embed/')) return new Response(spotifyPage({ type: 'album', name: 'A', trackList: [{ title: 'T', subtitle: 'K' }] }));
      // Weiterleitung auf einen fremden Host
      return { ok: true, status: 200, url: 'https://boese.example/', text: async () => 'x' };
    }) as unknown as typeof fetch;
    expect((await streamingList('https://open.spotify.com/album/1A2GTWGtFfWp7KSQTwWOyo', f))?.tracks).toEqual([{ title: 'T', artist: 'K', durationMs: undefined }]);
    expect(await streamingList('https://music.apple.com/de/album/x/1', f)).toBeNull();
  });
});
