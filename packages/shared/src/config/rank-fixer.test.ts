import { describe, expect, it } from 'vitest';
import { orderToPositions, orderWarnings, rankGroup, suggestOrder } from './rank-fixer.js';

const roles = [
  { id: 'vip', name: '💎 VIP', position: 9, permissions: '0', managed: false, hoist: true },
  { id: 'gamer', name: 'Gamer', position: 8, permissions: '0', managed: false },
  { id: 'mod', name: '🔨 Mod', position: 7, permissions: String(1n << 2n), managed: false },
  { id: 'bot', name: 'Musikbot', position: 6, permissions: '0', managed: true },
  { id: 'admin', name: 'Admin', position: 5, permissions: '8', managed: false },
];

describe('Ränge-Fixer', () => {
  it('ordnet Gruppen zu', () => {
    expect(roles.map(rankGroup)).toEqual(['special', 'member', 'team', 'bot', 'admin']);
  });

  it('Vorschlag: Admins → Team → Bots → Besondere → Mitglieder', () => {
    expect(suggestOrder(roles).map((r) => r.id)).toEqual(['admin', 'mod', 'bot', 'vip', 'gamer']);
  });

  it('rechnet Positionen in den belegten Plätzen aus (nur Änderungen)', () => {
    expect(orderToPositions(roles, ['admin', 'mod', 'bot', 'vip', 'gamer'])).toEqual([
      { id: 'admin', position: 9 },
      { id: 'mod', position: 8 },
      { id: 'bot', position: 7 },
      { id: 'vip', position: 6 },
      { id: 'gamer', position: 5 },
    ]);
    expect(orderToPositions(roles, ['vip', 'gamer', 'mod', 'bot', 'admin'])).toEqual([]);
    expect(orderToPositions(roles, ['vip', 'gamer'])).toBeNull();
    expect(orderToPositions(roles, ['vip', 'vip', 'mod', 'bot', 'admin'])).toBeNull();
  });

  it('warnt, wenn Team-Rollen unter normalen stehen', () => {
    const w = orderWarnings(roles);
    expect(w.some((x) => x.includes('„🔨 Mod“'))).toBe(true);
    expect(w.some((x) => x.includes('„Admin“'))).toBe(true);
    expect(orderWarnings(suggestOrder(roles))).toEqual([]);
  });
});
