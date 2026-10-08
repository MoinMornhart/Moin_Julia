import { describe, expect, it, vi } from 'vitest';
import { ChannelType } from 'discord.js';
import type { BotContext } from '../../core/types.js';
import { buffer, flush, statValues, updateStatChannels, voiceTick } from './index.js';

const GUILD = '100000000000000001';
const STAT = '100000000000000050';

function world(config: Record<string, unknown> = {}) {
  const writes: { table: string; args: { create: Record<string, unknown>; update: Record<string, unknown> } }[] = [];
  const upsert = (table: string) => vi.fn(async (args: { create: Record<string, unknown>; update: Record<string, unknown> }) => void writes.push({ table, args }));
  const statChannel = { id: STAT, name: 'alt', isThread: () => false, type: ChannelType.GuildVoice, setName: vi.fn(async (n: string) => void (statChannel.name = n)) };
  const human = (id: string, channelId: string | null) => ({ channelId, member: { id, user: { bot: false, username: `u${id}` } } });
  const voiceStates = new Map<string, unknown>([
    ['1', human('1', '100000000000000026')],
    ['2', human('2', '100000000000000026')],
    ['3', { channelId: '100000000000000026', member: { id: '3', user: { bot: true, username: 'musik' } } }],
    ['4', human('4', 'AFK')],
  ]);
  const filterable = <V>(m: Map<string, V>) => Object.assign(m, { filter: (fn: (v: V) => boolean) => new Map([...m].filter(([, v]) => fn(v))) });
  const guild = {
    id: GUILD,
    memberCount: 1284,
    premiumSubscriptionCount: 7,
    afkChannelId: 'AFK',
    voiceStates: { cache: filterable(voiceStates) },
    members: { cache: filterable(new Map([['b', { user: { bot: true } }]])) },
    roles: { cache: { size: 19 } },
    channels: { cache: filterable(new Map<string, unknown>([[STAT, statChannel], ['c2', { type: ChannelType.GuildText, isThread: () => false }]])) },
  };
  (guild.channels.cache as unknown as { get: (id: string) => unknown }).get = (id: string) => (id === STAT ? statChannel : undefined);
  const bot = {
    prisma: { guildStatDay: { upsert: upsert('guild') }, channelStatDay: { upsert: upsert('channel') }, memberStatDay: { upsert: upsert('member') } },
    logger: { warn: vi.fn() },
    client: { guilds: { cache: new Map([[GUILD, guild]]) } },
    modules: { config: async (_g: string, _m: string, parse: (raw: unknown) => unknown) => parse(config), isEnabled: async () => true },
  } as unknown as BotContext;
  return { bot, writes, statChannel, guild };
}

describe('Statistiken im Bot', () => {
  it('bündelt Nachrichten und schreibt einmal pro Server/Kanal/Mitglied', async () => {
    buffer.drain();
    const w = world();
    const now = new Date('2026-10-08T12:00:00Z');
    buffer.message(GUILD, 'k1', 'a', 'anna', now);
    buffer.message(GUILD, 'k1', 'a', 'anna', now);
    buffer.message(GUILD, 'k2', 'b', 'ben', now);
    buffer.member(GUILD, 'join', now);
    buffer.member(GUILD, 'leave', now);
    await flush(w.bot);
    const g = w.writes.filter((x) => x.table === 'guild');
    expect(g).toHaveLength(1);
    expect(g[0]!.args.create).toMatchObject({ day: '2026-10-08', messages: 3, joins: 1, leaves: 1, memberCount: 1284 });
    expect(w.writes.filter((x) => x.table === 'channel').map((x) => x.args.create.messages)).toEqual([2, 1]);
    expect(w.writes.filter((x) => x.table === 'member').map((x) => [x.args.create.userId, x.args.create.messages])).toEqual([['a', 2], ['b', 1]]);
    // danach ist der Puffer leer
    w.writes.length = 0;
    await flush(w.bot);
    expect(w.writes).toHaveLength(0);
  });

  it('Sprachminuten: nur Menschen, nicht im AFK-Kanal; Tag entsteht auch ohne Aktivität', async () => {
    buffer.drain();
    const w = world();
    await voiceTick(w.bot, new Date('2026-10-08T12:00:00Z'));
    await flush(w.bot);
    expect(w.writes.find((x) => x.table === 'guild')!.args.create).toMatchObject({ voiceMinutes: 2, joins: 0, memberCount: 1284 });
    expect(w.writes.filter((x) => x.table === 'member').map((x) => x.args.create.userId)).toEqual(['1', '2']);
  });

  it('Statistik-Kanal: Name aus Vorlage, nur bei Änderung umbenennen', async () => {
    const w = world({ statChannels: [{ channelId: STAT, template: '👥 Mitglieder: {members} · 🔊 {voice}' }] });
    expect(statValues(w.guild as never)).toMatchObject({ members: 1284, bots: 1, humans: 1283, boosts: 7, roles: 18, voice: 3 });
    expect(await updateStatChannels(w.bot)).toBe(1);
    expect(w.statChannel.name).toBe('👥 Mitglieder: 1.284 · 🔊 3');
    expect(await updateStatChannels(w.bot)).toBe(0);
  });
});
