import { describe, expect, it } from 'vitest';
import { changePercent, fillSeries, fillStatTemplate, lastDays, parseStatsConfig, statDay, statNextRenameAt, statRenameAllowed, STAT_RENAME_WINDOW_MS } from './stats.js';

describe('Statistiken', () => {
  it('füllt Kanalnamen-Vorlagen', () => {
    const v = { members: 1284, humans: 1270, bots: 14, boosts: 7, channels: 32, roles: 18, voice: 5 };
    expect(fillStatTemplate('👥 Mitglieder: {members}', v)).toBe('👥 Mitglieder: 1.284');
    expect(fillStatTemplate('{humans} Menschen · {bots} Bots · {voice} im Voice', v)).toBe('1.270 Menschen · 14 Bots · 5 im Voice');
    expect(fillStatTemplate('x'.repeat(120), v)).toHaveLength(100);
  });

  it('Tage in deutscher Zeit und lückenlose Reihen', () => {
    expect(statDay(new Date('2026-10-08T22:30:00Z'))).toBe('2026-10-09');
    const days = lastDays(3, new Date('2026-10-08T12:00:00Z'));
    expect(days).toEqual(['2026-10-06', '2026-10-07', '2026-10-08']);
    expect(lastDays(2, new Date('2026-03-01T12:00:00Z'))).toEqual(['2026-02-28', '2026-03-01']);
    expect(fillSeries(days, [{ day: '2026-10-07', n: 5 }], (r) => r.n)).toEqual([0, 5, 0]);
  });

  it('Veränderung und Standardwerte', () => {
    expect(changePercent(150, 100)).toBe(50);
    expect(changePercent(5, 0)).toBeNull();
    expect(parseStatsConfig({}).retentionDays).toBe(180);
  });
});

describe('Statistik-Kanäle so schnell Discord erlaubt', () => {
  it('zwei Umbenennungen pro 10 Minuten, danach warten', () => {
    const t0 = 1_000_000_000;
    expect(statRenameAllowed([], t0)).toBe(true);
    expect(statRenameAllowed([t0], t0 + 1000)).toBe(true);
    expect(statRenameAllowed([t0, t0 + 1000], t0 + 2000)).toBe(false);
    expect(statNextRenameAt([t0, t0 + 1000], t0 + 2000)).toBe(t0 + STAT_RENAME_WINDOW_MS);
    // nach Ablauf des Fensters der ersten Umbenennung wieder frei
    expect(statRenameAllowed([t0, t0 + 1000], t0 + STAT_RENAME_WINDOW_MS)).toBe(true);
    expect(statNextRenameAt([], t0)).toBe(t0);
  });
});
