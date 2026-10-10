import { writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ChannelType } from 'discord.js';
import { parseLevelConfig } from '@moin/shared';
import type { BotContext } from '../../core/types.js';
import { renderRankCard } from './card.js';
import { awardXp, voiceRound } from './index.js';
import { applyBoost, rollTextXp, textXpAllowed, voiceXpAllowed } from './logic.js';

const GUILD = '100000000000000001';
const USER = '100000000000000300';
const R5 = '100000000000000501';
const R10 = '100000000000000502';
const LEVEL_CH = '100000000000000023';

describe('XP-Regeln', () => {
  const config = parseLevelConfig({ ignoredChannelIds: ['100000000000000900'], ignoredRoleIds: ['100000000000000901'], cooldownSeconds: 60 });
  const now = new Date('2026-10-08T12:00:00Z');

  it('Nachrichten: Abklingzeit, ignorierte Kanäle/Kategorien/Rollen', () => {
    const base = { channelIds: ['100000000000000023'], roleIds: [], lastXpAt: null, now };
    expect(textXpAllowed(config, base)).toBe(true);
    expect(textXpAllowed(config, { ...base, lastXpAt: new Date(now.getTime() - 30_000) })).toBe(false);
    expect(textXpAllowed(config, { ...base, lastXpAt: new Date(now.getTime() - 61_000) })).toBe(true);
    expect(textXpAllowed(config, { ...base, channelIds: ['100000000000000023', '100000000000000900'] })).toBe(false);
    expect(textXpAllowed(config, { ...base, roleIds: ['100000000000000901'] })).toBe(false);
    expect(textXpAllowed({ ...config, textXp: false }, base)).toBe(false);
  });

  it('Sprachkanal: nicht allein, nicht taub, kein AFK-Kanal, keine Bots', () => {
    const base = { channelIds: ['100000000000000026'], roleIds: [], isBot: false, deaf: false, afkChannel: false, humansInChannel: 2 };
    expect(voiceXpAllowed(config, base)).toBe(true);
    expect(voiceXpAllowed(config, { ...base, humansInChannel: 1 })).toBe(false);
    expect(voiceXpAllowed(config, { ...base, deaf: true })).toBe(false);
    expect(voiceXpAllowed(config, { ...base, afkChannel: true })).toBe(false);
    expect(voiceXpAllowed(config, { ...base, isBot: true })).toBe(false);
    expect(voiceXpAllowed({ ...config, voiceNeedsCompany: false }, { ...base, humansInChannel: 1 })).toBe(true);
  });

  it('Zufalls-XP und Bonus', () => {
    expect(rollTextXp({ textXpMin: 15, textXpMax: 25 }, 0, () => 0)).toBe(15);
    expect(rollTextXp({ textXpMin: 15, textXpMax: 25 }, 0, () => 0.999)).toBe(25);
    expect(rollTextXp({ textXpMin: 20, textXpMax: 10 }, 0, () => 0)).toBe(10);
    expect(applyBoost(20, 50)).toBe(30);
    expect(applyBoost(20, -100)).toBe(0);
  });
});

function world(config: Record<string, unknown>, startXp = 0) {
  const row = { id: 'x1', guildId: GUILD, userId: USER, xp: startXp, level: 0, messages: 0, voiceMinutes: 0 };
  const memberRoles = new Map<string, { id: string }>();
  const levelChannel = { isSendable: () => true, send: vi.fn(async () => ({})) };
  const roles = new Map([R5, R10].map((id) => [id, { id, editable: true }]));
  const guild = { id: GUILD, name: 'Moin', roles: { cache: roles }, channels: { cache: new Map<string, unknown>([[LEVEL_CH, levelChannel]]) }, afkChannelId: null as string | null, members: { cache: new Map() } };
  const member = {
    id: USER,
    displayName: 'Anna',
    guild,
    user: { username: 'anna', avatar: null, bot: false },
    voice: { deaf: false },
    send: vi.fn(async () => ({})),
    roles: {
      cache: memberRoles,
      add: vi.fn(async (ids: string[]) => ids.forEach((i) => memberRoles.set(i, { id: i }))),
      remove: vi.fn(async (ids: string[]) => ids.forEach((i) => memberRoles.delete(i))),
    },
  };
  const bot = {
    prisma: {
      memberXp: {
        upsert: vi.fn(async ({ update }: { update: { xp: { increment: number } } }) => {
          row.xp += update.xp.increment;
          return { ...row };
        }),
        update: vi.fn(async ({ data }: { data: { level: number } }) => Object.assign(row, data)),
        updateMany: vi.fn(async ({ where, data }: { where: { level: number }; data: { level: number } }) => (row.level === where.level ? (Object.assign(row, data), { count: 1 }) : { count: 0 })),
      },
    },
    logger: { warn: vi.fn() },
    client: { guilds: { cache: new Map([[GUILD, guild]]) } },
    modules: { config: async (_g: string, _m: string, parse: (raw: unknown) => unknown) => parse(config), locale: async () => 'de', isEnabled: async () => true },
  } as unknown as BotContext;
  return { bot, row, member, memberRoles, levelChannel, guild };
}

describe('Aufstieg im Bot', () => {
  it('Level-up: Meldung im festen Kanal, Belohnungsrolle „ersetzen“ entzieht die niedrigere', async () => {
    const w = world({ levelUpMode: 'channel', levelUpChannelId: LEVEL_CH, rewards: [{ level: 1, roleId: R5 }, { level: 2, roleId: R10 }], rewardsReplace: true });
    let r = await awardXp(w.bot, w.member as never, 100, 'text');
    expect(r).toEqual({ level: 1, leveledUp: true });
    expect(w.memberRoles.has(R5)).toBe(true);
    expect(w.levelChannel.send).toHaveBeenCalledWith(expect.objectContaining({ content: `🎉 GG <@${USER}>, du bist jetzt **Level 1**!`, allowedMentions: { users: [USER] } }));

    r = await awardXp(w.bot, w.member as never, 10, 'text');
    expect(r.leveledUp).toBe(false);
    expect(w.levelChannel.send).toHaveBeenCalledTimes(1);

    r = await awardXp(w.bot, w.member as never, 200, 'text');
    expect(r.level).toBe(2);
    expect(w.memberRoles.has(R10)).toBe(true);
    expect(w.memberRoles.has(R5)).toBe(false);
  });

  it('DM-Modus nennt den Namen statt einer Erwähnung', async () => {
    const w = world({ levelUpMode: 'dm' });
    await awardXp(w.bot, w.member as never, 150, 'voice');
    expect(w.member.send).toHaveBeenCalledWith({ content: '🎉 GG Anna, du bist jetzt **Level 1**!' });
  });

  it('Voice-Runde: nur wer Gesellschaft hat bekommt XP', async () => {
    const w = world({ voiceXpPerMinute: 5 });
    const other = { ...w.member, id: '100000000000000301', user: { username: 'ben', avatar: null, bot: false } };
    const botMember = { ...w.member, id: '100000000000000302', user: { username: 'musik', avatar: null, bot: true } };
    const lonely = { type: ChannelType.GuildVoice, id: '100000000000000027', parentId: null, members: new Map([[USER, w.member]]) };
    w.guild.channels.cache.set(lonely.id, lonely);
    expect(await voiceRound(w.bot)).toBe(0);
    const busy = { type: ChannelType.GuildVoice, id: '100000000000000026', parentId: null, members: new Map<string, unknown>([[USER, w.member], [other.id, other], [botMember.id, botMember]]) };
    w.guild.channels.cache.delete(lonely.id);
    w.guild.channels.cache.set(busy.id, busy);
    expect(await voiceRound(w.bot)).toBe(2);
  });
});

describe('Rangkarte', () => {
  it('rendert ein PNG', async () => {
    const png = await renderRankCard({
      style: 'hafen',
      name: 'Kapitänin Julia',
      avatar: null,
      level: 12,
      place: 3,
      current: 640,
      needed: 1_000,
      totalXp: 8_420,
      labels: { level: 'Level 12', place: 'Platz #3', xp: '640 / 1.000 XP' },
    });
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    if (process.env.RANK_CARD_OUT) writeFileSync(process.env.RANK_CARD_OUT, png);
  });
});
