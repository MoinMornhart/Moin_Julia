import { describe, expect, it } from 'vitest';
import { cleanSupportReason, parseSupportScopes, SUPPORT_DURATIONS, supportAccessKey, supportActive, supportAllows, supportScopes, supportUntilText } from './support.js';

describe('Support-Zugang', () => {
  it('aktiv bis Ablauf oder für immer', () => {
    const now = Date.UTC(2026, 9, 14, 10, 0);
    expect(supportActive(null, now)).toBe(false);
    expect(supportActive({ by: 'o', byName: 'Owner', since: now, until: now + SUPPORT_DURATIONS['1h'] }, now + 1000)).toBe(true);
    expect(supportActive({ by: 'o', byName: 'Owner', since: now, until: now + SUPPORT_DURATIONS['1h'] }, now + 2 * 3_600_000)).toBe(false);
    expect(supportActive({ by: 'o', byName: 'Owner', since: now, until: null }, now + 365 * 86_400_000)).toBe(true);
    expect(supportUntilText({ by: 'o', byName: 'O', since: now, until: null })).toContain('für immer');
    expect(supportUntilText({ by: 'o', byName: 'O', since: now, until: now + 3_600_000 })).toBe('bis 14.10., 13:00');
    expect(supportAccessKey('1')).toBe('moin:support:1');
  });
});


describe('Betreiber-Zugang (Issue #13)', () => {
  const base = { by: 'o', byName: 'Owner', since: 0 };
  it('ältere Freigaben ohne Umfang = nur lesen', () => {
    expect(supportScopes({ ...base, until: null })).toEqual(['lesen']);
    expect(supportAllows({ ...base, until: null }, 'dashboard')).toBe(false);
  });
  it('Umfang und Ablauf', () => {
    const a = { ...base, until: 1000, scopes: ['lesen', 'dashboard'] as const };
    expect(supportAllows({ ...a, scopes: [...a.scopes] }, 'dashboard', 500)).toBe(true);
    expect(supportAllows({ ...a, scopes: [...a.scopes] }, 'dashboard', 2000)).toBe(false);
    expect(supportActive(null)).toBe(false);
  });
  it('Umfang aus Eingaben', () => {
    expect(parseSupportScopes('lesen+dashboard')).toEqual(['lesen', 'dashboard']);
    expect(parseSupportScopes(['dashboard', 'dashboard', 'admin'])).toEqual(['dashboard']);
    expect(parseSupportScopes('owner')).toBeNull();
  });
  it('Begründung: Pflicht, keine Pings', () => {
    expect(cleanSupportReason('kurz')).toBeNull();
    expect(cleanSupportReason('Ticket-Panel geht nicht, @everyone <@123> bitte')).toBe('Ticket-Panel geht nicht, @​everyone @jemand bitte');
  });
});
