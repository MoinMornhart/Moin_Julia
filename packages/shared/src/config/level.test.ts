import { describe, expect, it } from 'vitest';
import { boostPercent, fillLevelText, levelFromXp, parseLevelConfig, rewardRoles, totalXpForLevel, xpForNextLevel } from './level.js';

describe('XP-Kurve', () => {
  it('entspricht der bekannten MEE6-Kurve', () => {
    expect(xpForNextLevel(0)).toBe(100);
    expect(xpForNextLevel(1)).toBe(155);
    expect(totalXpForLevel(5)).toBe(1150);
    expect(totalXpForLevel(10)).toBe(4675);
  });

  it('rechnet Level und Fortschritt aus Gesamt-XP', () => {
    expect(levelFromXp(0)).toEqual({ level: 0, current: 0, needed: 100 });
    expect(levelFromXp(99).level).toBe(0);
    expect(levelFromXp(100)).toEqual({ level: 1, current: 0, needed: 155 });
    expect(levelFromXp(1300)).toEqual({ level: 5, current: 150, needed: 475 });
    expect(levelFromXp(-5).level).toBe(0);
  });
});

describe('Belohnungsrollen', () => {
  const rewards = [
    { level: 5, roleId: '100000000000000501' },
    { level: 10, roleId: '100000000000000502' },
    { level: 20, roleId: '100000000000000503' },
  ];
  it('stapeln: alle erreichten behalten', () => {
    expect(rewardRoles({ rewards, rewardsReplace: false }, 12)).toEqual({ give: ['100000000000000501', '100000000000000502'], take: ['100000000000000503'] });
  });
  it('ersetzen: nur die höchste behalten', () => {
    expect(rewardRoles({ rewards, rewardsReplace: true }, 12)).toEqual({ give: ['100000000000000502'], take: ['100000000000000501', '100000000000000503'] });
    expect(rewardRoles({ rewards, rewardsReplace: true }, 1)).toEqual({ give: [], take: rewards.map((r) => r.roleId) });
  });
});

describe('Sonstiges', () => {
  it('Boost: höchster gewinnt', () => {
    const boosts = [
      { roleId: '100000000000000601', percent: 25 },
      { roleId: '100000000000000602', percent: 50 },
    ];
    expect(boostPercent({ boosts }, ['100000000000000601', '100000000000000602'])).toBe(50);
    expect(boostPercent({ boosts }, [])).toBe(0);
  });
  it('Platzhalter und Standardwerte', () => {
    expect(fillLevelText('{user} ist {name} auf Level {level} ({server})', { user: '<@1>', name: 'Anna', level: 3, server: 'Moin' })).toBe('<@1> ist Anna auf Level 3 (Moin)');
    expect(parseLevelConfig({ textXpMin: 'kaputt' }).textXpMin).toBe(15);
  });
});
