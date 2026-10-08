import { describe, expect, it } from 'vitest';
import { extractYoutubeChannelId, feedSchema, fillAlertText, normalizeChannelInput, parseFeedState } from './alerts.js';

describe('normalizeChannelInput', () => {
  it('erkennt Twitch-Namen und Links', () => {
    expect(normalizeChannelInput('twitch', 'MoinMornhart')).toEqual({ ok: true, channelKey: 'moinmornhart' });
    expect(normalizeChannelInput('twitch', 'https://www.twitch.tv/Moin_Julia/videos')).toEqual({ ok: true, channelKey: 'moin_julia' });
    expect(normalizeChannelInput('twitch', 'twitch.tv/abc_def')).toEqual({ ok: true, channelKey: 'abc_def' });
    expect(normalizeChannelInput('twitch', 'https://kick.com/abc').ok).toBe(false);
    expect(normalizeChannelInput('twitch', 'a b').ok).toBe(false);
  });

  it('erkennt Kick-Namen', () => {
    expect(normalizeChannelInput('kick', 'https://kick.com/Some-Streamer')).toEqual({ ok: true, channelKey: 'some-streamer' });
  });

  it('erkennt YouTube-Kanal-IDs, Handles und Video-Links', () => {
    const id = 'UC_x5XG1OV2P6uZZ5FSM9Ttw';
    expect(normalizeChannelInput('youtube', id)).toEqual({ ok: true, channelKey: id });
    expect(normalizeChannelInput('youtube', `https://www.youtube.com/channel/${id}`)).toEqual({ ok: true, channelKey: id });
    expect(normalizeChannelInput('youtube', '@GoogleDevelopers')).toEqual({ ok: true, channelKey: '@GoogleDevelopers', needsLookup: 'youtube-handle' });
    expect(normalizeChannelInput('youtube', 'youtube.com/@GoogleDevelopers/videos')).toMatchObject({ ok: true, needsLookup: 'youtube-handle', channelKey: '@GoogleDevelopers' });
    expect(normalizeChannelInput('youtube', 'https://youtu.be/dQw4w9WgXcQ')).toMatchObject({ ok: true, needsLookup: 'youtube-video' });
    expect(normalizeChannelInput('youtube', 'https://example.com/@x').ok).toBe(false);
  });
});

describe('YouTube-Seiten', () => {
  it('findet die Kanal-ID im HTML', () => {
    expect(extractYoutubeChannelId('<link rel="canonical" href="https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw">')).toBe('UC_x5XG1OV2P6uZZ5FSM9Ttw');
    expect(extractYoutubeChannelId('…"channelId":"UCabcdefghijklmnopqrstuv"…')).toBe('UCabcdefghijklmnopqrstuv');
    expect(extractYoutubeChannelId('<html></html>')).toBeNull();
  });
});

describe('Feeds', () => {
  it('füllt Standardwerte und Platzhalter', () => {
    const feed = feedSchema.parse({ platform: 'twitch', channelKey: 'abc' });
    expect(feed.endMode).toBe('edit');
    expect(fillAlertText(feed.liveText, { streamer: 'Abc', url: 'https://twitch.tv/abc' })).toBe('🔴 **Abc** ist jetzt live! https://twitch.tv/abc');
    expect(fillAlertText('{title} / {game}', { streamer: 'x', url: 'u' })).toBe('– / –');
    // Security-Audit: Stream-Titel dürfen nicht @everyone pingen
    const filled = fillAlertText('{streamer}: {title}', { streamer: '<@&123>', title: '@everyone gratis Nitro', url: 'u' });
    expect(filled).not.toMatch(/@everyone|<@&/);
    expect(filled).toContain('everyone gratis Nitro');
  });

  it('übersteht kaputten Zustand', () => {
    expect(parseFeedState(null)).toEqual({ seen: [], initialized: false, live: null });
    expect(parseFeedState({ seen: 'kaputt' }).seen).toEqual([]);
  });
});
