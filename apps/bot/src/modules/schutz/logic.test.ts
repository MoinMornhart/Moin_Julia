import { describe, expect, it } from 'vitest';
import { parseSchutzConfig } from '@moin/shared';
import { AUDIT_KIND, accountAgeDays, CaptchaStore, formatAge, isExempt, NukeDetector, RaidDetector, verifyRoleChanges } from './logic.js';

describe('Raid-Erkennung', () => {
  it('löst bei 10 Beitritten in 10 s genau einmal aus', () => {
    const raid = new RaidDetector();
    const hits = Array.from({ length: 12 }, (_, i) => raid.join('g', i * 500, 10, 10_000));
    expect(hits.filter(Boolean)).toHaveLength(1);
    expect(hits.indexOf(true)).toBe(9);
  });
  it('langsame Beitritte lösen nicht aus', () => {
    const raid = new RaidDetector();
    expect(Array.from({ length: 20 }, (_, i) => raid.join('g', i * 2000, 10, 10_000)).some(Boolean)).toBe(false);
  });
  it('während des Raid-Modus kein erneuter Alarm, danach wieder scharf', () => {
    const raid = new RaidDetector();
    raid.start('g', 60_000);
    expect(raid.isActive('g', 30_000)).toBe(true);
    expect(Array.from({ length: 15 }, (_, i) => raid.join('g', 1000 + i, 10, 10_000)).some(Boolean)).toBe(false);
    expect(raid.isActive('g', 60_001)).toBe(false);
    expect(Array.from({ length: 10 }, (_, i) => raid.join('g', 70_000 + i, 10, 10_000)).at(-1)).toBe(true);
  });
  it('Server werden getrennt gezählt', () => {
    const raid = new RaidDetector();
    for (let i = 0; i < 9; i++) raid.join('a', i, 10, 10_000);
    expect(raid.join('b', 10, 10, 10_000)).toBe(false);
  });
});

describe('Anti-Nuke', () => {
  it('3 Kanal-Löschungen derselben Person in 15 s lösen aus', () => {
    const nuke = new NukeDetector();
    expect(nuke.record('g', 'u', 'channelDelete', 0, 3, 15_000)).toBeNull();
    expect(nuke.record('g', 'u', 'channelDelete', 5_000, 3, 15_000)).toBeNull();
    expect(nuke.record('g', 'u', 'channelDelete', 9_000, 3, 15_000)).toBe(3);
  });
  it('verschiedene Personen und Arten zählen getrennt', () => {
    const nuke = new NukeDetector();
    nuke.record('g', 'u1', 'channelDelete', 0, 3, 15_000);
    nuke.record('g', 'u2', 'channelDelete', 1, 3, 15_000);
    expect(nuke.record('g', 'u1', 'roleDelete', 2, 3, 15_000)).toBeNull();
    expect(nuke.record('g', 'u1', 'channelDelete', 3, 3, 15_000)).toBeNull();
  });
  it('Owner, Bot und Whitelist sind ausgenommen', () => {
    const base = { ownerId: 'o', botId: 'b', roleIds: ['r1'], whitelistUserIds: ['w'], whitelistRoleIds: [] as string[] };
    expect(isExempt({ ...base, executorId: 'o' })).toBe(true);
    expect(isExempt({ ...base, executorId: 'b' })).toBe(true);
    expect(isExempt({ ...base, executorId: 'w' })).toBe(true);
    expect(isExempt({ ...base, executorId: 'x' })).toBe(false);
    expect(isExempt({ ...base, executorId: 'x', whitelistRoleIds: ['r1'] })).toBe(true);
  });
  it('Audit-Log-Codes passen zu discord.js', async () => {
    const { AuditLogEvent } = await import('discord.js');
    expect(AUDIT_KIND[AuditLogEvent.ChannelDelete]).toBe('channelDelete');
    expect(AUDIT_KIND[AuditLogEvent.RoleDelete]).toBe('roleDelete');
    expect(AUDIT_KIND[AuditLogEvent.MemberBanAdd]).toBe('ban');
    expect(AUDIT_KIND[AuditLogEvent.MemberKick]).toBe('kick');
    expect(AUDIT_KIND[AuditLogEvent.WebhookCreate]).toBe('webhookCreate');
    // discord.js beim ersten Laden kann auf langsamen Rechnern > 5 s brauchen
  }, 30_000);
});

describe('Account-Alter & Captcha', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  it('Alter in Tagen und lesbar', () => {
    expect(accountAgeDays(new Date('2026-10-05T12:00:00Z'), now)).toBe(3);
    expect(formatAge(new Date('2026-10-05T12:00:00Z'), now, 'de')).toBe('3 Tage');
    expect(formatAge(new Date('2026-10-08T07:00:00Z'), now, 'de')).toBe('5 Std.');
    expect(formatAge(new Date('2026-10-08T11:48:00Z'), now, 'en')).toBe('12 min');
  });
  it('Captcha: richtig, falsch, nur ein Versuch, Ablauf', () => {
    const store = new CaptchaStore();
    const { a, b } = store.create('u', 0, () => 0.5);
    expect(store.check('u', String(a + b), 1000)).toBe('ok');
    store.create('u', 0, () => 0.5);
    expect(store.check('u', '999', 1000)).toBe('wrong');
    expect(store.check('u', String(a + b), 1000)).toBe('expired');
    store.create('u', 0);
    expect(store.check('u', '5', 6 * 60_000)).toBe('expired');
  });
});

describe('Einstellungen', () => {
  it('Standardwerte: alles aus, sinnvolle Schwellen', () => {
    const c = parseSchutzConfig({});
    expect(c.antiRaid).toMatchObject({ enabled: false, joins: 10, seconds: 10, durationMin: 15 });
    expect(c.antiNuke).toMatchObject({ enabled: false, threshold: 3, punishment: 'strip_roles' });
    expect(c.antiNuke.watch.adminGrant).toBe(true);
    expect(c.verification.mode).toBe('button');
  });
});

describe('Verifizierung: Rolle geben und entziehen', () => {
  const MEMBER = '600000000000000001';
  const UNVERIFIED = '600000000000000002';
  const server = [MEMBER, UNVERIFIED];
  it('gibt die Mitglieder-Rolle und entzieht „Unverifiziert“', () => {
    expect(verifyRoleChanges({ roleId: MEMBER, removeRoleIds: [UNVERIFIED] }, [UNVERIFIED], server)).toEqual({ configured: true, add: [MEMBER], remove: [UNVERIFIED] });
  });
  it('nur entziehen geht auch (ohne Mitglieder-Rolle)', () => {
    expect(verifyRoleChanges({ roleId: null, removeRoleIds: [UNVERIFIED] }, [UNVERIFIED], server)).toEqual({ configured: true, add: [], remove: [UNVERIFIED] });
  });
  it('schon erledigt, gelöschte Rollen und nichts eingestellt', () => {
    expect(verifyRoleChanges({ roleId: MEMBER, removeRoleIds: [UNVERIFIED] }, [MEMBER], server)).toEqual({ configured: true, add: [], remove: [] });
    expect(verifyRoleChanges({ roleId: '600000000000000009', removeRoleIds: [] }, [], server).configured).toBe(false);
  });
});
