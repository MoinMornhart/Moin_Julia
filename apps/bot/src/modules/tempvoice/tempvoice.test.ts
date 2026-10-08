import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseTempVoiceConfig, tempVoiceName } from '@moin/shared';
import type { BotContext, ComponentContext } from '../../core/types.js';
import { hubFor, joinDecision, mayControl, ownerRoleChanges, parseLimit } from './logic.js';
import { buildPanel } from './panel.js';
import { tempvoiceModule } from './index.js';

const GUILD = '100000000000000001';
const HUB = '100000000000000500';
const CATEGORY = '100000000000000400';
const OWNER = '100000000000000300';
const OTHER = '100000000000000301';
const OWNER_ROLE = '100000000000000700';

describe('Eigene Sprachkanäle – Logik', () => {
  const config = parseTempVoiceConfig({ hubs: [{ channelId: HUB }] });
  it('erkennt Erstell-Kanäle', () => {
    expect(hubFor(config, HUB)?.nameTemplate).toBe('🔊 {user}s Kanal');
    expect(hubFor(config, '999999999999999999')).toBeUndefined();
  });
  it('wer schon einen Kanal hat, kommt dorthin zurück', () => {
    expect(joinDecision(null)).toEqual({ kind: 'create' });
    expect(joinDecision({ channelId: 'x', exists: true })).toEqual({ kind: 'move', channelId: 'x' });
    expect(joinDecision({ channelId: 'x', exists: false })).toEqual({ kind: 'create' });
  });
  it('nur Besitzer:in steuert; übernehmen nur, wenn sie weg ist', () => {
    expect(mayControl('lock', OWNER, OWNER, true)).toBe('ok');
    expect(mayControl('lock', OWNER, OTHER, true)).toBe('not-owner');
    expect(mayControl('claim', OWNER, OTHER, true)).toBe('owner-here');
    expect(mayControl('claim', OWNER, OTHER, false)).toBe('ok');
  });
  it('Limit 0–99, Name aus Vorlage', () => {
    expect(parseLimit(' 5 ')).toBe(5);
    expect(parseLimit('0')).toBe(0);
    expect(parseLimit('100')).toBeNull();
    expect(parseLimit('abc')).toBeNull();
    expect(tempVoiceName('🔊 {user}s Kanal #{count}', { user: 'Anna', count: 3 })).toBe('🔊 Annas Kanal #3');
    expect(tempVoiceName('x'.repeat(150), { user: 'A', count: 1 })).toHaveLength(100);
  });
  it('Besitzer-Rolle geben und wieder entziehen', () => {
    expect(ownerRoleChanges([OWNER_ROLE], true, [], [OWNER_ROLE])).toEqual({ add: [OWNER_ROLE], remove: [] });
    expect(ownerRoleChanges([OWNER_ROLE], false, [OWNER_ROLE], [OWNER_ROLE])).toEqual({ add: [], remove: [OWNER_ROLE] });
    expect(ownerRoleChanges(['gelöscht'], true, [], [OWNER_ROLE])).toEqual({ add: [], remove: [] });
  });
  it('Bedienfeld: 8 Knöpfe mit Kanal-ID im customId', () => {
    const panel = buildPanel('de', '123', OWNER);
    const ids = panel.components.flatMap((row) => row.toJSON().components.map((c) => ('custom_id' in c ? c.custom_id : '')));
    expect(ids).toEqual(['rename', 'limit', 'lock', 'hide', 'invite', 'kick', 'transfer', 'claim'].map((a) => `tempvoice:${a}:123`));
  });
});

// ── Ablauf mit nachgebautem Server ──────────────────────────────────────────

function fakeWorld(configRaw: unknown) {
  const rows = new Map<string, { channelId: string; guildId: string; ownerId: string; hubId: string }>();
  const prisma = {
    tempVoiceChannel: {
      findFirst: vi.fn(async ({ where }: { where: { ownerId: string } }) => [...rows.values()].find((r) => r.ownerId === where.ownerId) ?? null),
      findUnique: vi.fn(async ({ where }: { where: { channelId: string } }) => rows.get(where.channelId) ?? null),
      findMany: vi.fn(async () => [...rows.values()]),
      count: vi.fn(async ({ where }: { where: { ownerId?: string } }) => [...rows.values()].filter((r) => !where.ownerId || r.ownerId === where.ownerId).length),
      create: vi.fn(async ({ data }: { data: { channelId: string; guildId: string; ownerId: string; hubId: string } }) => rows.set(data.channelId, data)),
      delete: vi.fn(async ({ where }: { where: { channelId: string } }) => rows.delete(where.channelId)),
      update: vi.fn(async ({ where, data }: { where: { channelId: string }; data: { ownerId: string } }) => rows.set(where.channelId, { ...rows.get(where.channelId)!, ...data })),
    },
  };
  const channels = new Map<string, Record<string, unknown>>();
  const everyone = { id: GUILD };
  const roles = new Map([[OWNER_ROLE, { id: OWNER_ROLE }], [GUILD, everyone]]);
  const memberRoles = new Map<string, { id: string }>();
  const ownerMember: Record<string, unknown> = {
    id: OWNER,
    displayName: 'Anna',
    user: { id: OWNER, bot: false, tag: 'anna' },
    roles: { cache: memberRoles, add: vi.fn(async (ids: string[]) => ids.forEach((i) => memberRoles.set(i, { id: i }))), remove: vi.fn(async (ids: string[]) => ids.forEach((i) => memberRoles.delete(i))) },
  };
  function voice(id: string, extra: Record<string, unknown> = {}) {
    const members = new Map<string, unknown>();
    const overwrites = new Map<string, { deny: { has: (p: bigint) => boolean } }>();
    const ch = {
      id,
      type: ChannelType.GuildVoice,
      name: 'x',
      parentId: CATEGORY,
      userLimit: 0,
      members,
      permissionOverwrites: { cache: overwrites, edit: vi.fn(async () => undefined) },
      send: vi.fn(async () => ({})),
      delete: vi.fn(async () => channels.delete(id)),
      ...extra,
    };
    channels.set(id, ch);
    return ch;
  }
  const hub = voice(HUB);
  const guild = {
    id: GUILD,
    channels: {
      cache: channels,
      create: vi.fn(async (opts: Record<string, unknown>) => voice(`10000000000000090${channels.size}`, { name: opts.name, userLimit: opts.userLimit, createdWith: opts })),
    },
    roles: { cache: roles, everyone },
    members: { me: { id: '100000000000000999' }, fetch: vi.fn(async () => ownerMember) },
  };
  ownerMember.guild = guild;
  ownerMember.voice = {
    setChannel: vi.fn(async (target: { id: string } | string) => {
      const id = typeof target === 'string' ? target : target.id;
      (channels.get(id)!.members as Map<string, unknown>).set(OWNER, ownerMember);
    }),
  };
  const bot = {
    prisma,
    logger: { warn: vi.fn(), info: vi.fn() },
    client: { guilds: { cache: new Map([[GUILD, guild]]) } },
    modules: { config: async (_g: string, _m: string, parse: (raw: unknown) => unknown) => parse(configRaw), locale: async () => 'de' },
  } as unknown as BotContext;
  const state = (channelId: string | null) => ({ guild, channelId, member: ownerMember });
  return { bot, guild, hub, rows, channels, ownerMember, memberRoles, state };
}

describe('Eigene Sprachkanäle – Ablauf', () => {
  let handler: (before: unknown, after: unknown) => Promise<void>;
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(config: unknown) {
    const world = fakeWorld(config);
    tempvoiceModule.setup!({
      bot: world.bot,
      on: ((_event: string, _guildOf: unknown, h: typeof handler) => {
        handler = h;
      }) as never,
    });
    return world;
  }

  it('Beitritt zum Erstell-Kanal → eigener Kanal, verschoben, Bedienfeld, Besitzer-Rolle', async () => {
    const w = setup({ hubs: [{ channelId: HUB, startLocked: true, userLimit: 4 }], ownerRoleIds: [OWNER_ROLE] });
    await handler(w.state(null), w.state(HUB));
    expect(w.rows.size).toBe(1);
    const [row] = [...w.rows.values()];
    const created = w.channels.get(row!.channelId) as { name: string; userLimit: number; send: ReturnType<typeof vi.fn>; members: Map<string, unknown>; createdWith: { parent: string; permissionOverwrites: { id: string; deny?: bigint[] }[] } };
    expect(created.name).toBe('🔊 Annas Kanal');
    expect(created.userLimit).toBe(4);
    expect(created.createdWith.parent).toBe(CATEGORY);
    expect(created.createdWith.permissionOverwrites.find((o) => o.id === GUILD)?.deny).toContain(PermissionFlagsBits.Connect);
    expect(created.members.has(OWNER)).toBe(true);
    expect(created.send).toHaveBeenCalledOnce();
    expect(w.memberRoles.has(OWNER_ROLE)).toBe(true);
  });

  it('leer → nach der Wartezeit gelöscht, Besitzer-Rolle wieder entzogen', async () => {
    const w = setup({ hubs: [{ channelId: HUB }], ownerRoleIds: [OWNER_ROLE], deleteAfterSec: 10 });
    await handler(w.state(null), w.state(HUB));
    const [row] = [...w.rows.values()];
    const created = w.channels.get(row!.channelId) as { members: Map<string, unknown>; delete: ReturnType<typeof vi.fn> };
    created.members.clear();
    await handler(w.state(row!.channelId), w.state(null));
    expect(created.delete).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(created.delete).toHaveBeenCalledOnce();
    expect(w.rows.size).toBe(0);
    expect(w.memberRoles.has(OWNER_ROLE)).toBe(false);
  });

  it('kommt jemand vor Ablauf zurück, bleibt der Kanal', async () => {
    const w = setup({ hubs: [{ channelId: HUB }], deleteAfterSec: 10 });
    await handler(w.state(null), w.state(HUB));
    const [row] = [...w.rows.values()];
    const created = w.channels.get(row!.channelId) as { members: Map<string, unknown>; delete: ReturnType<typeof vi.fn> };
    created.members.clear();
    await handler(w.state(row!.channelId), w.state(null));
    await handler(w.state(null), w.state(row!.channelId));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(created.delete).not.toHaveBeenCalled();
  });

  it('wer schon einen Kanal hat, bekommt keinen zweiten', async () => {
    const w = setup({ hubs: [{ channelId: HUB }] });
    await handler(w.state(null), w.state(HUB));
    await handler(w.state(null), w.state(HUB));
    expect(w.guild.channels.create).toHaveBeenCalledOnce();
    expect(w.rows.size).toBe(1);
  });

  it('Bedienfeld: Fremde dürfen nicht steuern, Besitzer:in sperrt', async () => {
    const w = setup({ hubs: [{ channelId: HUB }] });
    await handler(w.state(null), w.state(HUB));
    const [row] = [...w.rows.values()];
    const reply = vi.fn(async () => undefined);
    const ctx = (userId: string, action: string) =>
      ({ interaction: { guild: w.guild, guildId: GUILD, user: { id: userId }, reply, replied: false, deferred: false, isButton: () => true }, action, args: [row!.channelId], locale: 'de', bot: w.bot }) as unknown as ComponentContext;
    await tempvoiceModule.onComponent!(ctx(OTHER, 'lock'));
    expect((reply.mock.calls[0] as unknown as [{ content: string }])[0].content).toContain('Das darf nur');
    await tempvoiceModule.onComponent!(ctx(OWNER, 'lock'));
    const created = w.channels.get(row!.channelId) as { permissionOverwrites: { edit: ReturnType<typeof vi.fn> } };
    expect(created.permissionOverwrites.edit).toHaveBeenCalledWith(GUILD, { Connect: false });
    expect((reply.mock.calls[1] as unknown as [{ content: string }])[0].content).toContain('Gesperrt');
  });
});
