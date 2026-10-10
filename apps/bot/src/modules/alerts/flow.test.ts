import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../../core/types.js';
import { alertsModule, alertsRound } from './index.js';
import { forgetTokens } from './platforms.js';

const GUILD = '100000000000000001';
const CHANNEL = '100000000000000022';
const PING = '100000000000000014';
const LIVE_ROLE = '100000000000000015';
const STREAMER = '100000000000000300';

/** Nachgebauter Server + DB-Zeile, an der der Bot den Zustand mitschreibt */
function world(feedData: Record<string, unknown>, platform = 'twitch') {
  const row = { id: 'f1', guildId: GUILD, platform, channelKey: String(feedData.channelKey), data: { platform, discordChannelId: CHANNEL, ...feedData }, state: {} as unknown, lastError: null as string | null };
  const memberRoles = new Map<string, { id: string }>();
  const member = {
    roles: {
      cache: memberRoles,
      add: vi.fn(async (id: string) => void memberRoles.set(id, { id })),
      remove: vi.fn(async (id: string) => void memberRoles.delete(id)),
    },
  };
  const messages = new Map<string, { id: string; edit: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn>; payload: unknown }>();
  const channel = {
    isSendable: () => true,
    isTextBased: () => true,
    send: vi.fn(async (payload: unknown) => {
      const msg = { id: `m${messages.size + 1}`, payload, edit: vi.fn(async () => msg), delete: vi.fn(async () => undefined) };
      messages.set(msg.id, msg);
      return msg;
    }),
    messages: { fetch: vi.fn(async (id: string) => messages.get(id) ?? null) },
  };
  const guild = {
    id: GUILD,
    roles: { cache: new Map([[LIVE_ROLE, { id: LIVE_ROLE }]]) },
    channels: { cache: new Map([[CHANNEL, channel]]) },
    members: { fetch: vi.fn(async () => member) },
  };
  const bot = {
    prisma: {
      socialFeed: {
        findMany: vi.fn(async () => [row]),
        findFirst: vi.fn(async () => row),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(row, data)),
        findUnique: vi.fn(async () => row),
        updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => (Object.assign(row, data), { count: 1 })),
      },
      appSetting: { findMany: vi.fn(async () => []) },
    },
    logger: { warn: vi.fn() },
    client: { guilds: { cache: new Map([[GUILD, guild]]) } },
    modules: { locale: async () => 'de', isEnabled: async () => true },
  } as unknown as BotContext;
  return { bot, row, channel, messages, memberRoles };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function twitchApi(live: () => boolean, fail = () => false) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes('/oauth2/token')) return json({ access_token: 'tok', expires_in: 3600 });
    if (fail()) return json({ message: 'down' }, 503);
    if (u.includes('/streams')) {
      return json({ data: live() ? [{ id: 's1', user_login: 'moin', user_name: 'Moin', game_name: 'Minecraft', title: 'Bauen!', viewer_count: 12, started_at: new Date(Date.now() - 3_600_000).toISOString(), thumbnail_url: 'https://t/{width}x{height}.jpg', type: 'live' }] : [] });
    }
    if (u.includes('/users')) return json({ data: [{ login: 'moin', profile_image_url: 'https://img/moin.png' }] });
    return json({}, 404);
  });
}

describe('Social Media: Ablauf im Bot', () => {
  beforeEach(() => {
    forgetTokens();
    process.env.TWITCH_CLIENT_ID = 'test-client';
    process.env.TWITCH_CLIENT_SECRET = 'test-secret';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TWITCH_CLIENT_ID;
    delete process.env.TWITCH_CLIENT_SECRET;
  });

  it('Twitch: live → Meldung mit Ping + Live-Rolle; Ende → „war live“ + Rolle weg', async () => {
    let live = true;
    vi.stubGlobal('fetch', twitchApi(() => live));
    const w = world({ channelKey: 'moin', displayName: 'Moin', pingRoleIds: [PING], liveRoleId: LIVE_ROLE, liveMemberId: STREAMER });

    await alertsRound(w.bot);
    expect(w.channel.send).toHaveBeenCalledTimes(1);
    const sent = w.channel.send.mock.calls[0]?.[0] as { content: string; allowedMentions: { roles: string[] }; embeds: { data: { image?: { url: string } } }[] };
    expect(sent.content).toContain(`<@&${PING}>`);
    expect(sent.content).toContain('**Moin** ist jetzt live! https://www.twitch.tv/moin');
    expect(sent.allowedMentions.roles).toEqual([PING]);
    expect(sent.embeds[0]?.data.image?.url).toMatch(/^https:\/\/t\/1280x720\.jpg\?t=/);
    expect(w.memberRoles.has(LIVE_ROLE)).toBe(true);
    expect(w.row.state).toMatchObject({ live: { streamId: 's1', messageId: 'm1' } });

    // nächste Runde, immer noch live → keine zweite Meldung
    await alertsRound(w.bot);
    expect(w.channel.send).toHaveBeenCalledTimes(1);

    live = false;
    await alertsRound(w.bot);
    const msg = w.messages.get('m1');
    expect(msg?.edit).toHaveBeenCalledTimes(1);
    expect((msg?.edit.mock.calls[0]?.[0] as { content: string }).content).toContain('war live');
    expect(w.memberRoles.has(LIVE_ROLE)).toBe(false);
    expect(w.row.state).toMatchObject({ live: null });
  });

  it('Abfrage-Fehler beendet keinen laufenden Stream', async () => {
    let fail = false;
    vi.stubGlobal('fetch', twitchApi(() => true, () => fail));
    const w = world({ channelKey: 'moin', displayName: 'Moin', endMode: 'delete' });
    await alertsRound(w.bot);
    fail = true;
    await alertsRound(w.bot);
    expect(w.messages.get('m1')?.delete).not.toHaveBeenCalled();
    expect(w.row.lastError).toMatch(/HTTP 503/);
    expect(w.row.state).toMatchObject({ live: { streamId: 's1' } });
  });

  it('ohne Twitch-Verbindung: klarer Hinweis statt Absturz', async () => {
    delete process.env.TWITCH_CLIENT_ID;
    const w = world({ channelKey: 'moin' });
    await alertsRound(w.bot);
    expect(w.channel.send).not.toHaveBeenCalled();
    expect(w.row.lastError).toMatch(/nicht verbunden/);
  });

  it('YouTube: erster Lauf merkt nur, danach Short und Video mit eigenem Text', async () => {
    const entries = (ids: string[]) =>
      `<feed><title>Moin TV</title>${ids.map((id) => `<entry><yt:videoId>${id}</yt:videoId><title>Video ${id}</title><author><name>Moin TV</name></author><published>${new Date().toISOString()}</published></entry>`).join('')}</feed>`;
    let feed = entries(['alt00000001']);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        const u = String(url);
        if (u.includes('/feeds/videos.xml')) return new Response(feed);
        if (u.includes('/shorts/short000001')) return new Response('', { status: 200 });
        if (u.includes('/shorts/')) return new Response('', { status: 303 });
        if (u.includes('/watch')) return new Response('<html>"isLiveNow":false</html>');
        return new Response('', { status: 404 });
      }),
    );
    const w = world({ channelKey: 'UCabcdefghijklmnopqrstuv', videoText: 'Neu: {title} {url}', shortText: 'Short: {title}' }, 'youtube');
    await alertsRound(w.bot);
    expect(w.channel.send).not.toHaveBeenCalled();
    expect(w.row.state).toMatchObject({ initialized: true, seen: ['alt00000001'] });
    expect((w.row.data as { displayName: string }).displayName).toBe('Moin TV');

    feed = entries(['video000001', 'short000001', 'alt00000001']);
    await alertsModule.onAction?.(w.bot, GUILD, 'check', 'x');
    const contents = w.channel.send.mock.calls.map((c) => (c[0] as { content: string }).content);
    expect(contents).toEqual(['Short: Video short000001', 'Neu: Video video000001 https://www.youtube.com/watch?v=video000001']);
  });

  it('Test-Meldung pingt niemanden', async () => {
    const w = world({ channelKey: 'moin', displayName: 'Moin', pingRoleIds: [PING], liveText: '@everyone {streamer} live' });
    await alertsModule.onAction?.(w.bot, GUILD, 'test:f1', 'x');
    const sent = w.channel.send.mock.calls[0]?.[0] as { content: string; allowedMentions: { parse: string[]; roles: string[] } };
    expect(sent.content).toContain('Test-Meldung');
    expect(sent.content).not.toContain(`<@&${PING}>`);
    expect(sent.allowedMentions).toEqual({ parse: [], roles: [] });
  });
});
