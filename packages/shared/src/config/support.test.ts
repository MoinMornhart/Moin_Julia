import { describe, expect, it } from 'vitest';
import { SUPPORT_DURATIONS, supportAccessKey, supportActive, supportUntilText } from './support.js';

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
