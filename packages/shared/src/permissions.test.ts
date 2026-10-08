import { describe, expect, it } from 'vitest';
import { hasManagePermission, isGuildManager } from './permissions.js';

const G = '1';
const roles = [
  { id: G, permissions: '0' }, // @everyone
  { id: 'admin', permissions: '8' },
  { id: 'verwalter', permissions: String(0x20) },
  { id: 'mitglied', permissions: String(0x400 | 0x800) },
];

describe('Admin-Rechte live prüfen (Security-Audit: Login-Stand kann veraltet sein)', () => {
  it('Administrator oder Server verwalten', () => {
    expect(hasManagePermission('8')).toBe(true);
    expect(hasManagePermission(String(0x20))).toBe(true);
    expect(hasManagePermission('3072')).toBe(false);
  });

  it('nach aktuellen Rollen – Rolle entzogen → kein Admin mehr', () => {
    expect(isGuildManager(G, ['admin'], roles)).toBe(true);
    expect(isGuildManager(G, ['verwalter', 'mitglied'], roles)).toBe(true);
    expect(isGuildManager(G, ['mitglied'], roles)).toBe(false);
    expect(isGuildManager(G, [], roles)).toBe(false);
  });

  it('@everyone zählt mit, fehlende Angaben → unbekannt', () => {
    expect(isGuildManager(G, [], [{ id: G, permissions: '32' }])).toBe(true);
    expect(isGuildManager(G, ['x'], [{ id: G, permissions: '0' }, { id: 'x' }])).toBeNull();
  });
});
