import { describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../../core/types.js';
import { birthdayRound } from './birthdays.js';
import { onCountingMessage } from './counting.js';
import { parsePollOptions, reminderRound } from './extras.js';
import { finishGiveaway } from './giveaways.js';
import { countStars, matchesEmoji } from './starboard.js';

const GUILD = '100000000000000001';
const COUNT_CH = '100000000000000024';
const BDAY_CH = '100000000000000023';
const BDAY_ROLE = '100000000000000777';

function botWith(config: Record<string, unknown>, prisma: Record<string, unknown>, guild: Record<string, unknown> = {}) {
  const g = { id: GUILD, name: 'Moin', channels: { cache: new Map() }, roles: { cache: new Map() }, members: { fetch: vi.fn(async () => null) }, ...guild };
  return {
    bot: {
      prisma,
      logger: { warn: vi.fn() },
      client: { guilds: { cache: new Map([[GUILD, g]]) }, users: { fetch: vi.fn() } },
      modules: { config: async (_g: string, _m: string, parse: (raw: unknown) => unknown) => parse(config), locale: async () => 'de', isEnabled: async () => true },
    } as unknown as BotContext,
    guild: g,
  };
}

describe('Zähl-Kanal', () => {
  function setup(state: { current: number; lastUserId: string | null; record: number }, opts: Record<string, unknown> = {}) {
    const db = { ...state };
    const prisma = {
      countingState: {
        findUnique: vi.fn(async () => ({ ...db })),
        upsert: vi.fn(async ({ update }: { update: Partial<typeof db> }) => Object.assign(db, update)),
      },
    };
    const { bot } = botWith({ counting: { enabled: true, channelId: COUNT_CH, ...opts } }, prisma);
    const msg = (content: string, author = 'a') => ({
      guildId: GUILD,
      channelId: COUNT_CH,
      content,
      author: { id: author },
      react: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
      channel: { send: vi.fn(async () => undefined) },
    });
    return { bot, db, msg };
  }

  it('richtige Zahl → ✅ und neuer Rekord, Hunderter → 💯', async () => {
    const { bot, db, msg } = setup({ current: 98, lastUserId: 'x', record: 98 });
    const m = msg('99');
    await onCountingMessage(bot, m as never);
    expect(db).toMatchObject({ current: 99, lastUserId: 'a', record: 99 });
    expect(m.react).toHaveBeenCalledWith('✅');
    const m2 = msg('100', 'b');
    await onCountingMessage(bot, m2 as never);
    expect(m2.react).toHaveBeenCalledWith('💯');
  });

  it('fast gleichzeitig „5“ und „6“ → beide richtig (Nachrichten werden nacheinander geprüft)', async () => {
    const { bot, db, msg } = setup({ current: 4, lastUserId: 'x', record: 4 });
    const five = msg('5', 'a');
    const six = msg('6', 'b');
    await Promise.all([onCountingMessage(bot, five as never), onCountingMessage(bot, six as never)]);
    expect(five.react).toHaveBeenCalledWith('✅');
    expect(six.react).toHaveBeenCalledWith('✅');
    expect(db.current).toBe(6);
  });

  it('falsche Zahl → ❌, Hinweis, zurück auf 0', async () => {
    const { bot, db, msg } = setup({ current: 10, lastUserId: 'x', record: 12 });
    const m = msg('12');
    await onCountingMessage(bot, m as never);
    expect(m.react).toHaveBeenCalledWith('❌');
    expect(m.channel.send).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('**11**') }));
    expect(db.current).toBe(0);
    expect(db.record).toBe(12);
  });

  it('zweimal hintereinander → abgelehnt; ohne Neustart bleibt der Stand', async () => {
    const { bot, db, msg } = setup({ current: 3, lastUserId: 'a', record: 3 }, { resetOnFail: false });
    const m = msg('4');
    await onCountingMessage(bot, m as never);
    expect(m.channel.send).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('zweimal') }));
    expect(db.current).toBe(3);
  });

  it('Text ohne Zahl wird ignoriert', async () => {
    const { bot, db, msg } = setup({ current: 3, lastUserId: 'a', record: 3 });
    const m = msg('lol');
    await onCountingMessage(bot, m as never);
    expect(m.react).not.toHaveBeenCalled();
    expect(db.current).toBe(3);
  });
});

describe('Geburtstage', () => {
  it('gratuliert einmal zur eingestellten Stunde und gibt die Rolle; am Folgetag weg', async () => {
    const rows = [{ id: 'b1', guildId: GUILD, userId: '100000000000000300', day: 8, month: 10, year: 2000, lastWishedYear: null as number | null, roleGivenAt: null as Date | null }];
    const prisma = {
      birthday: {
        findMany: vi.fn(async ({ where }: { where: { roleGivenAt?: unknown } }) => (where.roleGivenAt ? rows.filter((r) => r.roleGivenAt) : rows.filter((r) => !r.lastWishedYear || r.lastWishedYear < 2026))),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(rows[0]!, data)),
      },
    };
    const roles = new Map<string, unknown>();
    const member = {
      id: '100000000000000300',
      displayName: 'Anna',
      roles: { cache: roles, add: vi.fn(async () => void roles.set(BDAY_ROLE, {})), remove: vi.fn(async () => void roles.delete(BDAY_ROLE)) },
    };
    const channel = { isSendable: () => true, send: vi.fn(async () => undefined) };
    const { bot } = botWith(
      { birthdays: { enabled: true, channelId: BDAY_CH, roleId: BDAY_ROLE, hour: 9, text: '🎂 {user} wird {age}!' } },
      prisma,
      { channels: { cache: new Map([[BDAY_CH, channel]]) }, roles: { cache: new Map([[BDAY_ROLE, { id: BDAY_ROLE, editable: true }]]) }, members: { fetch: vi.fn(async () => member) } },
    );
    // 8:00 Berlin → noch zu früh
    expect(await birthdayRound(bot, new Date('2026-10-08T06:00:00Z'))).toBe(0);
    // 9:30 Berlin → Glückwunsch
    expect(await birthdayRound(bot, new Date('2026-10-08T07:30:00Z'))).toBe(1);
    expect(channel.send).toHaveBeenCalledWith(expect.objectContaining({ content: '🎂 <@100000000000000300> wird 26!' }));
    expect(roles.has(BDAY_ROLE)).toBe(true);
    // später am selben Tag: nicht nochmal
    expect(await birthdayRound(bot, new Date('2026-10-08T15:00:00Z'))).toBe(0);
    // nächster Tag: Rolle weg
    await birthdayRound(bot, new Date('2026-10-09T07:30:00Z'));
    expect(roles.has(BDAY_ROLE)).toBe(false);
  });
});

describe('Giveaways', () => {
  it('beendet nur einmal, zieht Gewinner, reroll schließt alte Gewinner aus', async () => {
    let row = { id: 'g1', guildId: GUILD, channelId: '100000000000000023', messageId: null, prize: 'Nitro', winnerCount: 1, requiredRoleId: null, hostId: 'h', entrants: ['u1', 'u2'], winnerIds: [] as string[], endsAt: new Date(), ended: false, createdAt: new Date() };
    let endedFlips = 0;
    const prisma = {
      giveaway: {
        updateMany: vi.fn(async () => {
          if (row.ended) return { count: 0 };
          row.ended = true;
          endedFlips++;
          return { count: 1 };
        }),
        update: vi.fn(async ({ data }: { data: Partial<typeof row> }) => (row = { ...row, ...data })),
      },
    };
    const channel = { isTextBased: () => true, isSendable: () => true, send: vi.fn(async () => undefined), messages: { fetch: vi.fn(async () => null) } };
    const { bot } = botWith({}, prisma, { channels: { cache: new Map([['100000000000000023', channel]]) } });
    const first = await finishGiveaway(bot, row as never);
    expect(first?.winnerIds).toHaveLength(1);
    expect(await finishGiveaway(bot, { ...row, ended: false } as never)).toBeNull();
    expect(endedFlips).toBe(1);
    const firstWinner = (first!.winnerIds as string[])[0];
    const second = await finishGiveaway(bot, row as never, true);
    expect(second?.winnerIds).toEqual([firstWinner === 'u1' ? 'u2' : 'u1']);
  });
});

describe('Kleinigkeiten', () => {
  it('Umfrage-Antworten', () => {
    expect(parsePollOptions('Pizza; Döner ;Sushi;;Pizza')).toEqual(['Pizza', 'Döner', 'Sushi']);
    expect(parsePollOptions('nur eins')).toBeNull();
    expect(parsePollOptions(Array.from({ length: 11 }, (_, i) => `a${i}`).join(';'))).toBeNull();
  });

  it('Starboard-Emoji und Zählung', () => {
    expect(matchesEmoji('⭐', { name: '⭐', id: null })).toBe(true);
    expect(matchesEmoji('<:moin:123456789012345678>', { name: 'moin', id: '123456789012345678' })).toBe(true);
    expect(matchesEmoji('⭐', { name: '🌟', id: null })).toBe(false);
    expect(countStars(['a', 'b', 'bot', 'author'], 'author', false, new Set(['bot']))).toBe(2);
    expect(countStars(['a', 'author'], 'author', true, new Set())).toBe(2);
  });

  it('Erinnerungen gehen genau einmal raus', async () => {
    const send = vi.fn(async () => undefined);
    let done = false;
    const prisma = {
      reminder: {
        findMany: vi.fn(async () => [{ id: 'r1', userId: 'u', guildId: GUILD, text: 'Pizza holen', createdAt: new Date('2026-10-08T10:00:00Z') }]),
        updateMany: vi.fn(async () => {
          if (done) return { count: 0 };
          done = true;
          return { count: 1 };
        }),
      },
    };
    const { bot } = botWith({}, prisma);
    (bot.client.users.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ send });
    await reminderRound(bot);
    await reminderRound(bot);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Pizza holen') }));
  });
});
