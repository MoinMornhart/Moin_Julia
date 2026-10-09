import { describe, expect, it } from 'vitest';
import { berlinParts, checkCount, daysUntilBirthday, isBirthdayToday, parseCommunityConfig, parseCount, pickWinners, validBirthday, voteCounts } from './community.js';

describe('Geburtstage', () => {
  it('prüft Datumsangaben', () => {
    expect(validBirthday(24, 12)).toBe(true);
    expect(validBirthday(31, 4)).toBe(false);
    expect(validBirthday(29, 2)).toBe(true);
    expect(validBirthday(29, 2, 2001)).toBe(false);
    expect(validBirthday(29, 2, 2000)).toBe(true);
    expect(validBirthday(1, 13)).toBe(false);
    expect(validBirthday(1, 1, 1800)).toBe(false);
  });

  it('erkennt den Geburtstag – 29. Februar am 28. in Nicht-Schaltjahren', () => {
    expect(isBirthdayToday({ day: 8, month: 10 }, { day: 8, month: 10, year: 2026 })).toBe(true);
    expect(isBirthdayToday({ day: 29, month: 2 }, { day: 28, month: 2, year: 2026 })).toBe(true);
    expect(isBirthdayToday({ day: 29, month: 2 }, { day: 28, month: 2, year: 2028 })).toBe(false);
    expect(isBirthdayToday({ day: 29, month: 2 }, { day: 29, month: 2, year: 2028 })).toBe(true);
  });

  it('rechnet Tage bis zum nächsten Geburtstag', () => {
    const today = { day: 8, month: 10, year: 2026 };
    expect(daysUntilBirthday({ day: 8, month: 10 }, today)).toBe(0);
    expect(daysUntilBirthday({ day: 10, month: 10 }, today)).toBe(2);
    expect(daysUntilBirthday({ day: 7, month: 10 }, today)).toBe(364);
  });

  it('nutzt die deutsche Zeitzone', () => {
    // 22:30 UTC am 8.10. ist in Berlin schon der 9.10.
    expect(berlinParts(new Date('2026-10-08T22:30:00Z'))).toMatchObject({ day: 9, month: 10, hour: 0 });
  });
});

describe('Zählen', () => {
  it('liest Zahlen am Anfang', () => {
    expect(parseCount('12')).toBe(12);
    expect(parseCount('12 juhu')).toBe(12);
    expect(parseCount('12a')).toBeNull();
    expect(parseCount('hallo')).toBeNull();
  });
  it('prüft Reihenfolge und Doppelzählen', () => {
    const state = { current: 4, lastUserId: 'a' };
    expect(checkCount(state, 5, 'b', false)).toBe('ok');
    expect(checkCount(state, 6, 'b', false)).toBe('wrong-number');
    expect(checkCount(state, 5, 'a', false)).toBe('double');
    expect(checkCount(state, 5, 'a', true)).toBe('ok');
    expect(checkCount(state, null, 'b', false)).toBe('ignore');
  });
});

describe('Giveaways & Vorschläge', () => {
  it('zieht verschiedene Gewinner', () => {
    const winners = pickWinners(['a', 'b', 'c', 'c', 'd'], 3);
    expect(new Set(winners).size).toBe(3);
    expect(pickWinners(['a'], 3)).toEqual(['a']);
    expect(pickWinners([], 2)).toEqual([]);
  });
  it('zählt Stimmen', () => {
    expect(voteCounts({ a: 1, b: 1, c: -1 })).toEqual({ up: 2, down: 1 });
  });
  it('Standardwerte', () => {
    const c = parseCommunityConfig({});
    expect(c.starboard).toMatchObject({ emoji: '⭐', threshold: 3, enabled: false });
    expect(c.counting.resetOnFail).toBe(true);
  });
});

describe('Vorschlags-Bereiche (wie GalaxyBot)', () => {
  it('Hauptbereich zuerst, weitere danach; alte Einstellungen bleiben gültig', async () => {
    const { parseCommunityConfig, suggestionBoards, findSuggestionBoard } = await import('./community.js');
    const old = parseCommunityConfig({ suggestions: { enabled: true, channelId: '100000000000000020', threads: false, staffRoleIds: [] } });
    expect(suggestionBoards(old.suggestions)).toEqual([expect.objectContaining({ id: 'main', name: 'Vorschläge', channelId: '100000000000000020', threads: false, staffChannelId: '' })]);
    const cfg = parseCommunityConfig({
      suggestions: { enabled: true, channelId: '100000000000000020', boards: [{ id: 'bstream', name: 'Stream-Ideen', channelId: '100000000000000021', staffChannelId: '100000000000000022' }] },
    });
    expect(suggestionBoards(cfg.suggestions).map((b) => b.id)).toEqual(['main', 'bstream']);
    expect(findSuggestionBoard(cfg.suggestions, 'bstream')?.staffChannelId).toBe('100000000000000022');
    expect(findSuggestionBoard(cfg.suggestions, null)?.id).toBe('main');
    expect(findSuggestionBoard(cfg.suggestions, 'bweg')).toBeNull();
    // ohne Hauptkanal: erster weiterer Bereich ist der Standard
    const noMain = parseCommunityConfig({ suggestions: { enabled: true, boards: [{ id: 'bx', name: 'X', channelId: '100000000000000021' }] } });
    expect(findSuggestionBoard(noMain.suggestions, null)?.id).toBe('bx');
  });
});
