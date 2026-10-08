import { describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../../core/types.js';
import { ModuleRegistry } from '../../core/registry.js';
import { botModules } from '../index.js';
import { moderationCommands } from './commands.js';
import { ModerationError, moderate } from './actions.js';

describe('Slash-Befehle', () => {
  it('erfüllen Discords Regeln und haben englische Beschreibungen', () => {
    for (const command of moderationCommands) {
      const c = command.data;
      expect(c.name).toMatch(/^[a-z_]{1,32}$/);
      expect(c.description.length).toBeLessThanOrEqual(100);
      expect(c.description_localizations?.['en-US']).toBeTruthy();
      expect(c.default_member_permissions).toBeTruthy();
      for (const option of c.options ?? []) {
        expect(option.name).toMatch(/^[a-z_]{1,32}$/);
        expect(option.description.length).toBeLessThanOrEqual(100);
      }
    }
    expect(moderationCommands.map((c) => c.data.name)).toEqual(['warn', 'timeout', 'untimeout', 'kick', 'ban', 'unban', 'warns', 'case', 'clear']);
  });

  it('alle Module zusammen: keine doppelten Befehle, alle im Katalog', () => {
    const fakeBot = { logger: { debug: vi.fn() } } as unknown as BotContext;
    expect(() => new ModuleRegistry(fakeBot, botModules, 'token', '123')).not.toThrow();
  });
});

// ── Ablauf mit nachgebauter Datenbank und nachgebautem Server ───────────────

function fakeDb() {
  const cases: Record<string, unknown>[] = [];
  let counter = 0;
  const modCase = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: cases.length + 1, active: true, logMessageId: null, createdAt: new Date(), ...data };
      cases.push(row);
      return row;
    },
    count: async ({ where }: { where: { userId: string; type: string; active: boolean } }) =>
      cases.filter((c) => c.userId === where.userId && c.type === where.type && c.active === where.active).length,
    update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
      const row = cases.find((c) => c.id === where.id)!;
      Object.assign(row, data);
      return row;
    },
  };
  const guild = { update: async () => ({ caseCounter: ++counter }) };
  const prisma = { modCase, guild, $transaction: async (fn: (tx: unknown) => unknown) => fn({ modCase, guild }) };
  return { prisma, cases };
}

function fakeServer() {
  const modLog = { isTextBased: () => true, permissionsFor: () => ({ has: () => true }), send: vi.fn(async () => ({ id: 'log1' })) };
  const role = (position: number) => ({ highest: { position } });
  const anna = {
    id: '100000000000000201',
    tag: 'anna',
    send: vi.fn(async () => undefined),
  };
  const annaMember = {
    id: anna.id,
    user: anna,
    roles: role(1),
    timeout: vi.fn(async () => undefined),
    kick: vi.fn(async () => undefined),
    isCommunicationDisabled: () => false,
  };
  const modUser = { id: '100000000000000202', tag: 'max' };
  const modMember = { id: modUser.id, user: modUser, roles: role(50) };
  const me = { id: '100000000000000999', user: { id: '100000000000000999', tag: 'Moin_Julia' }, roles: role(100), permissions: { has: () => true } };
  const guild = {
    id: '100000000000000001',
    name: 'Moin Demo',
    ownerId: '100000000000000777',
    members: {
      me,
      fetch: async (id: string) => (id === anna.id ? annaMember : null),
      ban: vi.fn(async () => undefined),
    },
    channels: { cache: new Map([['100000000000000300', modLog]]) },
  };
  return { guild, anna, annaMember, modMember, modLog };
}

function fakeBot(prisma: unknown, config: unknown): BotContext {
  return {
    prisma,
    modules: { locale: async () => 'de', config: async (_g: string, _m: string, parse: (raw: unknown) => unknown) => parse(config) },
    logger: { warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  } as unknown as BotContext;
}

const config = { modLogChannelId: '100000000000000300' };

describe('Moderations-Ablauf', () => {
  it('Verwarnung: Fall #1, DM, Mod-Log, Zähler', async () => {
    const { prisma, cases } = fakeDb();
    const { guild, anna, annaMember, modMember, modLog } = fakeServer();
    const r = await moderate(fakeBot(prisma, config), {
      guild: guild as never, type: 'WARN', targetUser: anna as never, targetMember: annaMember as never, moderator: modMember as never, reason: 'Spam',
    });
    expect(r.modCase.number).toBe(1);
    expect(r.warnCount).toBe(1);
    expect(r.escalation).toBeNull();
    expect(anna.send).toHaveBeenCalledOnce();
    expect(modLog.send).toHaveBeenCalledOnce();
    expect(cases[0]).toMatchObject({ type: 'WARN', moderatorTag: 'max', reason: 'Spam', logMessageId: 'log1' });
  });

  it('dritte Verwarnung eskaliert automatisch zum Timeout (Standard: 60 Min.)', async () => {
    const { prisma, cases } = fakeDb();
    const { guild, anna, annaMember, modMember } = fakeServer();
    const bot = fakeBot(prisma, config);
    const warn = () =>
      moderate(bot, { guild: guild as never, type: 'WARN', targetUser: anna as never, targetMember: annaMember as never, moderator: modMember as never, reason: 'x' });
    await warn();
    await warn();
    const third = await warn();
    expect(third.warnCount).toBe(3);
    expect(third.escalation?.modCase.number).toBe(4);
    expect(annaMember.timeout).toHaveBeenCalledWith(3_600_000, expect.any(String));
    expect(cases.at(-1)).toMatchObject({ type: 'TIMEOUT', source: 'escalation', moderatorTag: 'Moin_Julia', durationSec: 3600 });
  });

  it('Rangprüfung: Mod mit niedrigerer Rolle darf nicht', async () => {
    const { prisma } = fakeDb();
    const { guild, anna, annaMember } = fakeServer();
    const weakMod = { id: '100000000000000203', user: { id: '100000000000000203', tag: 'neu' }, roles: { highest: { position: 1 } } };
    await expect(
      moderate(fakeBot(prisma, config), { guild: guild as never, type: 'KICK', targetUser: anna as never, targetMember: annaMember as never, moderator: weakMod as never, reason: null }),
    ).rejects.toMatchObject({ key: 'mod.err.hierarchy' });
    expect(annaMember.kick).not.toHaveBeenCalled();
  });

  it('Grund-Pflicht wird durchgesetzt', async () => {
    const { prisma } = fakeDb();
    const { guild, anna, annaMember, modMember } = fakeServer();
    const err = await moderate(fakeBot(prisma, { ...config, requireReason: true }), {
      guild: guild as never, type: 'WARN', targetUser: anna as never, targetMember: annaMember as never, moderator: modMember as never, reason: '  ',
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ModerationError);
    expect((err as ModerationError).key).toBe('mod.err.reasonRequired');
  });

  it('Kick: DM geht vor dem Rauswurf raus', async () => {
    const { prisma } = fakeDb();
    const { guild, anna, annaMember, modMember } = fakeServer();
    const order: string[] = [];
    anna.send.mockImplementation(async () => void order.push('dm'));
    annaMember.kick.mockImplementation(async () => void order.push('kick'));
    await moderate(fakeBot(prisma, config), {
      guild: guild as never, type: 'KICK', targetUser: anna as never, targetMember: annaMember as never, moderator: modMember as never, reason: 'Regel 3',
    });
    expect(order).toEqual(['dm', 'kick']);
  });
});
