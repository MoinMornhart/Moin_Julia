import { describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../../core/types.js';
import { probationReminderDue } from './logic.js';
import { teamModule } from './index.js';

const GUILD = '100000000000000001';
const USER = '100000000000000300';
const MOD = '100000000000000710';
const APPLICANT_ROLE = '100000000000000711';
const PROBATION = '100000000000000712';
const LOG = '100000000000000028';

describe('Probezeit-Erinnerung', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  const day = 86_400_000;
  it('ab N Tagen vor Ende, danach alle 3 Tage', () => {
    const endAt = new Date(now.getTime() + 2 * day);
    expect(probationReminderDue({ endAt, remindedAt: null, status: 'running' }, 3, now)).toBe(true);
    expect(probationReminderDue({ endAt: new Date(now.getTime() + 10 * day), remindedAt: null, status: 'running' }, 3, now)).toBe(false);
    expect(probationReminderDue({ endAt, remindedAt: new Date(now.getTime() - day), status: 'running' }, 3, now)).toBe(false);
    expect(probationReminderDue({ endAt, remindedAt: new Date(now.getTime() - 4 * day), status: 'running' }, 3, now)).toBe(true);
    expect(probationReminderDue({ endAt, remindedAt: null, status: 'passed' }, 3, now)).toBe(false);
  });
});

function world(probation: boolean) {
  const memberRoles = new Map([[APPLICANT_ROLE, { id: APPLICANT_ROLE }]]);
  const member = {
    roles: {
      cache: memberRoles,
      add: vi.fn(async (ids: string[]) => ids.forEach((i) => memberRoles.set(i, { id: i }))),
      remove: vi.fn(async (ids: string[]) => ids.forEach((i) => memberRoles.delete(i))),
    },
  };
  const log = { isTextBased: () => true, send: vi.fn(async () => ({})) };
  const dm = vi.fn(async () => ({}));
  const guild = {
    id: GUILD,
    name: 'Moin',
    roles: { cache: new Map([MOD, APPLICANT_ROLE, PROBATION].map((id) => [id, { id }])) },
    channels: { cache: new Map([[LOG, log]]) },
    members: { fetch: vi.fn(async () => member) },
  };
  const app = { id: 'a1', guildId: GUILD, positionId: 'p1', positionTitle: 'Moderator', userId: USER, userTag: 'anna', answers: [], decisionReason: 'Zu wenig Erfahrung', createdAt: new Date(), interview: null };
  const bot = {
    prisma: {
      application: { findFirst: vi.fn(async () => app), findUnique: vi.fn(async () => app), update: vi.fn(async () => app) },
      jobPosition: { findUnique: vi.fn(async () => ({ id: 'p1', data: { title: 'Moderator', acceptRoleIds: [MOD], removeRoleIds: [APPLICANT_ROLE], probationDays: probation ? 14 : 0 } })) },
      probation: { findFirst: vi.fn(async () => (probation ? { id: 'pr1', endAt: new Date(Date.now() + 14 * 86_400_000) } : null)) },
      appSetting: { findMany: vi.fn(async () => []) },
    },
    logger: { warn: vi.fn() },
    client: { guilds: { cache: new Map([[GUILD, guild]]) }, users: { fetch: vi.fn(async () => ({ send: dm })) } },
    modules: { config: async (_g: string, _m: string, parse: (raw: unknown) => unknown) => parse({ logChannelId: LOG, probationRoleId: PROBATION }), locale: async () => 'de', isEnabled: async () => true },
  } as unknown as BotContext;
  return { bot, member, memberRoles, log, dm };
}

describe('Bewerbung annehmen/ablehnen (Bot setzt um)', () => {
  it('Annehmen: Team-Rolle + Probe-Rolle geben, Bewerber-Rolle entziehen, DM, Log', async () => {
    const w = world(true);
    await teamModule.onAction!(w.bot, GUILD, 'accept:a1', '100000000000000999');
    expect(w.memberRoles.has(MOD)).toBe(true);
    expect(w.memberRoles.has(PROBATION)).toBe(true);
    expect(w.memberRoles.has(APPLICANT_ROLE)).toBe(false);
    expect((w.dm.mock.calls[0] as unknown as [{ content: string }])[0].content).toContain('angenommen');
    expect(w.log.send).toHaveBeenCalledOnce();
  });
  it('Ablehnen: DM mit Begründung, Log, keine Rollen', async () => {
    const w = world(false);
    await teamModule.onAction!(w.bot, GUILD, 'reject:a1', '100000000000000999');
    expect((w.dm.mock.calls[0] as unknown as [{ content: string }])[0].content).toContain('Zu wenig Erfahrung');
    expect(w.member.roles.add).not.toHaveBeenCalled();
    expect(w.log.send).toHaveBeenCalledOnce();
  });
  it('Gesprächs-Zusage per DM-Knopf wird gespeichert – nur von der Person selbst', async () => {
    const w = world(false);
    const update = vi.fn(async () => undefined);
    await teamModule.onDmComponent!({ interaction: { user: { id: 'fremd' }, message: { content: 'x' }, update } as never, action: 'interview', args: ['a1', 'yes'], bot: w.bot });
    expect(update).not.toHaveBeenCalled();
    await teamModule.onDmComponent!({ interaction: { user: { id: USER }, message: { content: 'x' }, update } as never, action: 'interview', args: ['a1', 'yes'], bot: w.bot });
    expect(update).toHaveBeenCalledOnce();
  });
});
