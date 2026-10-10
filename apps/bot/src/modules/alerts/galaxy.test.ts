import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptSecret } from '@moin/db';
import { ChannelType, GuildScheduledEventStatus } from 'discord.js';
import type { BotContext } from '../../core/types.js';
import { alertsModule, alertsRound } from './index.js';
import { infoChannelNames, scheduleLines } from './logic.js';
import { forgetTokens } from './platforms.js';

const GUILD = '100000000000000001';
const CHANNEL = '100000000000000022';
const PING = '100000000000000014';

type Chan = { id: string; name: string; type: number; parentId: string | null; isSendable: () => boolean; isTextBased: () => boolean; isThread: () => boolean; setName: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn>; messages: { fetch: ReturnType<typeof vi.fn> }; threads?: { create: ReturnType<typeof vi.fn> } };

/** Server mit echten Kanal-Anlagen, Events und Rollen (nachgebaut) */
function world(feedData: Record<string, unknown>, secrets: Record<string, string> = {}) {
  const row = { id: 'f1', guildId: GUILD, platform: 'twitch', channelKey: 'moin', data: { platform: 'twitch', channelKey: 'moin', displayName: 'Moin', discordChannelId: CHANNEL, ...feedData }, state: {} as unknown, lastError: null as string | null };
  const channels = new Map<string, Chan>();
  const messages = new Map<string, { id: string; payload: unknown; edit: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn>; startThread: ReturnType<typeof vi.fn>; crosspost: ReturnType<typeof vi.fn>; channel?: Chan }>();
  const threads: { name: string; send: ReturnType<typeof vi.fn> }[] = [];
  const makeChannel = (id: string, name: string, type: number, parentId: string | null = null): Chan => {
    const ch: Chan = {
      id,
      name,
      type,
      parentId,
      isSendable: () => type !== ChannelType.GuildCategory && type !== ChannelType.GuildVoice,
      isTextBased: () => type !== ChannelType.GuildCategory,
      isThread: () => false,
      setName: vi.fn(async (n: string) => void (ch.name = n)),
      send: vi.fn(async (payload: unknown) => {
        const msg = {
          id: `m${messages.size + 1}`,
          payload,
          channel: ch,
          edit: vi.fn(async () => msg),
          delete: vi.fn(async () => undefined),
          crosspost: vi.fn(async () => msg),
          startThread: vi.fn(async ({ name }: { name: string }) => {
            const t = { name, send: vi.fn(async () => undefined) };
            threads.push(t);
            return t;
          }),
        };
        messages.set(msg.id, msg);
        return msg;
      }),
      messages: { fetch: vi.fn(async (mid: string) => messages.get(mid) ?? null) },
    };
    channels.set(id, ch);
    return ch;
  };
  makeChannel(CHANNEL, 'live', ChannelType.GuildText);
  let next = 500;
  const events: { id: string; status: number; setStatus: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn>; opts: Record<string, unknown> }[] = [];
  const memberRoles = new Map<string, unknown>();
  const guild = {
    id: GUILD,
    roles: { everyone: { id: GUILD }, cache: new Map([[PING, { id: PING, permissions: { bitfield: 0n, has: () => false }, managed: false, editable: true, position: 1 }]]) },
    channels: {
      cache: channels,
      create: vi.fn(async ({ name, type, parent }: { name: string; type: number; parent?: string }) => makeChannel(`1000000000000${String(next++).padStart(5, "0")}`, name, type, parent ?? null)),
    },
    scheduledEvents: {
      create: vi.fn(async (opts: Record<string, unknown>) => {
        const ev = {
          id: `e${events.length + 1}`,
          status: GuildScheduledEventStatus.Scheduled as number,
          opts,
          setStatus: vi.fn(async (s: number) => void (ev.status = s)),
          delete: vi.fn(async () => undefined),
        };
        events.push(ev);
        return ev;
      }),
      fetch: vi.fn(async (id: string) => events.find((e) => e.id === id) ?? null),
    },
    members: { fetch: vi.fn(async () => null), me: { roles: { highest: { position: 10 } } } },
  };
  const bot = {
    prisma: {
      socialFeed: {
        findMany: vi.fn(async () => [row]),
        findFirst: vi.fn(async () => row),
        findUnique: vi.fn(async () => row),
        updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => (Object.assign(row, data), { count: 1 })),
      },
      appSetting: { findMany: vi.fn(async () => []) },
      guildSecret: { findMany: vi.fn(async () => Object.entries(secrets).map(([key, value]) => ({ guildId: GUILD, key, value: encryptSecret(value) }))) },
    },
    logger: { warn: vi.fn(), debug: vi.fn() },
    client: { guilds: { cache: new Map([[GUILD, guild]]) } },
    modules: { locale: async () => 'de', isEnabled: async () => true },
  } as unknown as BotContext;
  return { bot, row, guild, channels, messages, events, threads, memberRoles };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function twitchApi(live: () => boolean, seen: string[] = []) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    seen.push(`${u} ${String((init?.headers as Record<string, string> | undefined)?.['client-id'] ?? '')}`);
    if (u.includes('/oauth2/token')) return json({ access_token: 'tok', expires_in: 3600 });
    if (u.includes('/streams')) {
      return json({
        data: live()
          ? [{ id: 's1', user_id: '4711', user_login: 'moin', user_name: 'Moin', game_name: 'Minecraft', title: 'Bauen!', viewer_count: 1234, started_at: new Date(Date.now() - 3_600_000).toISOString(), thumbnail_url: 'https://t/{width}x{height}.jpg', type: 'live' }]
          : [],
      });
    }
    if (u.includes('/videos')) return json({ data: [{ url: 'https://www.twitch.tv/videos/999', title: 'Bauen!', duration: '1h0m0s', created_at: new Date().toISOString() }] });
    if (u.includes('/schedule')) return json({ data: { segments: [{ start_time: '2026-10-13T17:00:00Z', title: 'Projekt-Abend', category: { name: 'Minecraft' }, canceled_until: null }] } });
    if (u.includes('/users')) return json({ data: [{ id: '4711', login: 'moin', profile_image_url: 'https://img/moin.png' }] });
    return json({}, 404);
  });
}

async function rounds(bot: BotContext, n: number) {
  for (let i = 0; i < n; i++) await alertsRound(bot);
}

describe('Twitch wie GalaxyBot', () => {
  beforeEach(() => {
    forgetTokens();
    process.env.TWITCH_CLIENT_ID = 'instanz-client';
    process.env.TWITCH_CLIENT_SECRET = 'instanz-secret';
    process.env.SECRETS_KEY = 'test-geheimnis';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TWITCH_CLIENT_ID;
    delete process.env.TWITCH_CLIENT_SECRET;
  });

  it('Klassisch: GalaxyBot-Platzhalter, 🔔-Knopf, Ping nicht doppelt, in Ankündigungskanälen veröffentlicht', async () => {
    vi.stubGlobal('fetch', twitchApi(() => true));
    const w = world({ pingRoleIds: [PING], liveText: '%PING% %STREAMER% ist live: %TITLE%' });
    w.channels.get(CHANNEL)!.type = ChannelType.GuildAnnouncement;
    await alertsRound(w.bot);
    const msg = w.messages.get('m1')!;
    const sent = msg.payload as { content: string; components: { components: { data: { custom_id?: string; label?: string } }[] }[]; embeds: { data: { author?: { name: string } } }[] };
    expect(sent.content).toBe(`<@&${PING}> Moin ist live: Bauen!`);
    expect(sent.components[0]!.components.map((c) => c.data.custom_id ?? c.data.label)).toEqual(['Ansehen', `alerts:ping:${PING}`]);
    expect(sent.embeds[0]!.data.author?.name).toBe('Moin ist jetzt live auf Twitch!');
    expect(msg.crosspost).toHaveBeenCalled();
  });

  it('Kategorie: legt Kategorie, Stream-Kanal und Info-Kanäle an; Name zeigt live/offline', async () => {
    let live = true;
    vi.stubGlobal('fetch', twitchApi(() => live));
    const w = world({ display: 'category', discordChannelId: '' });
    await alertsRound(w.bot);
    const created = [...w.channels.values()].filter((c) => c.id !== CHANNEL);
    expect(created.map((c) => c.type)).toEqual([ChannelType.GuildCategory, ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildVoice, ChannelType.GuildVoice]);
    const text = created[1]!;
    expect(text.name).toBe('🔴│moin');
    expect(created.slice(2).map((c) => c.name)).toEqual(['📝 Bauen!', '⏱️ Online: 1 h 00 min', '👀 Zuschauer: 1.234']);
    expect(text.send).toHaveBeenCalledTimes(1);
    live = false;
    await rounds(w.bot, 2);
    expect(text.name).toBe('⚫│moin');
    expect(created[2]!.name).toBe('📝 Offline');
    // nach einem Neustart des Bots: vorhandene Kanäle werden wiederverwendet, keine neuen
    await alertsRound(w.bot);
    expect(w.guild.channels.create).toHaveBeenCalledTimes(5);
  });

  it('Event: Discord-Event startet mit dem Stream und endet mit ihm', async () => {
    let live = true;
    vi.stubGlobal('fetch', twitchApi(() => live));
    const w = world({ display: 'event', discordChannelId: '' });
    await alertsRound(w.bot);
    expect(w.events).toHaveLength(1);
    expect(w.events[0]!.opts).toMatchObject({ name: 'Bauen!', entityMetadata: { location: 'https://www.twitch.tv/moin' } });
    expect(w.events[0]!.status).toBe(GuildScheduledEventStatus.Active);
    expect(w.messages.size).toBe(0); // ohne Kanal keine Nachricht
    live = false;
    await rounds(w.bot, 2);
    expect(w.events[0]!.status).toBe(GuildScheduledEventStatus.Completed);
  });

  it('VoD-Thread nach dem Stream, Streamplan im eigenen Kanal', async () => {
    let live = true;
    vi.stubGlobal('fetch', twitchApi(() => live));
    const PLAN = '100000000000000033';
    const w = world({ vodThread: true, scheduleChannelId: PLAN });
    w.channels.set(PLAN, { ...w.channels.get(CHANNEL)!, id: PLAN });
    await alertsRound(w.bot);
    live = false;
    await rounds(w.bot, 2);
    expect(w.threads).toHaveLength(1);
    expect(w.threads[0]!.name).toMatch(/^🎬 Aufzeichnung .* – Bauen!$/);
    expect(w.threads[0]!.send).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('https://www.twitch.tv/videos/999') }));
    const plan = [...w.messages.values()].find((m) => (m.payload as { embeds?: { data: { title?: string } }[] }).embeds?.[0]?.data.title?.startsWith('📅'));
    expect((plan?.payload as { embeds: { data: { description: string } }[] }).embeds[0]!.data.description).toContain('Projekt-Abend · Minecraft');
  });

  it('Eigene Twitch-Zugangsdaten des Servers gehen vor denen der Instanz', async () => {
    const seen: string[] = [];
    vi.stubGlobal('fetch', twitchApi(() => false, seen));
    const w = world({}, { twitchClientId: 'server-client', twitchClientSecret: 'server-secret' });
    await alertsRound(w.bot);
    expect(seen.some((s) => s.includes('/streams') && s.endsWith('server-client'))).toBe(true);
    expect(seen.some((s) => s.endsWith('instanz-client'))).toBe(false);
  });

  it('🔔-Knopf: Mitglied holt sich die Ping-Rolle und gibt sie wieder ab – fremde Rollen nicht', async () => {
    const w = world({ pingRoleIds: [PING] });
    const roles = new Map<string, unknown>();
    const reply = vi.fn(async () => undefined);
    const interaction = {
      isButton: () => true,
      guild: w.guild,
      member: { roles: { cache: roles, add: vi.fn(async (id: string) => void roles.set(id, {})), remove: vi.fn(async (id: string) => void roles.delete(id)) } },
      reply,
    };
    const press = (role: string) => alertsModule.onComponent!({ interaction: interaction as never, action: 'ping', args: [role], locale: 'de', bot: w.bot });
    await press(PING);
    expect(roles.has(PING)).toBe(true);
    await press(PING);
    expect(roles.has(PING)).toBe(false);
    await press('100000000000000099');
    expect(roles.size).toBe(0);
    expect(reply).toHaveBeenLastCalledWith(expect.objectContaining({ content: expect.stringContaining('geht gerade nicht') }));
  });
});

describe('Anzeigen', () => {
  it('Info-Kanäle und Streamplan', () => {
    expect(infoChannelNames({ title: 'Bauen!', startedAt: new Date(0).toISOString(), viewers: 5 }, 90 * 60_000)).toEqual({ title: '📝 Bauen!', uptime: '⏱️ Online: 1 h 30 min', viewers: '👀 Zuschauer: 5' });
    expect(scheduleLines(null)).toBe('Kein Streamplan eingetragen.');
    expect(scheduleLines([{ start: '2026-10-13T17:00:00Z', title: 'Abend', category: '', canceled: false }])).toBe('**Di., 13.10., 19:00** – Abend');
  });
});
