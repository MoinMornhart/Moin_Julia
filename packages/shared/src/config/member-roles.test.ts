import { describe, expect, it } from 'vitest';
import { canGrantPermissions, planRoleChange, roleBlockReason } from './member-roles.js';

const G = '1';
const roles = [
  { id: G, name: '@everyone', position: 0, permissions: '0', managed: false },
  { id: 'admin', name: 'Admin', position: 9, permissions: '8', managed: false },
  { id: 'mod', name: 'Moderator', position: 5, permissions: String(1n << 2n), managed: false },
  { id: 'vip', name: 'VIP', position: 3, permissions: '0', managed: false },
  { id: 'boost', name: 'Booster', position: 2, permissions: '0', managed: true },
  { id: 'top', name: 'Ganz oben', position: 20, permissions: '0', managed: false },
];

describe('Mitglieder verwalten: Rollen zuweisen', () => {
  it('Gründe, warum eine Rolle nicht geht', () => {
    expect(roleBlockReason(roles[0]!, G, 10, null)).toMatch(/everyone/);
    expect(roleBlockReason(roles[4]!, G, 10, null)).toMatch(/Discord verwaltet/);
    expect(roleBlockReason(roles[5]!, G, 10, null)).toMatch(/über der Rolle des Bots/);
    expect(roleBlockReason(roles[2]!, G, 10, 4)).toMatch(/über deiner höchsten Rolle/);
    expect(roleBlockReason(roles[3]!, G, 10, 4)).toBeNull();
  });

  it('plant Hinzufügen/Entfernen und warnt bei gefährlichen Rechten', () => {
    const plan = planRoleChange({ guildId: G, current: ['vip', 'boost'], wanted: ['mod', 'boost'], roles, botTop: 10, actorTop: null });
    expect(plan.add).toEqual(['mod']);
    expect(plan.remove).toEqual(['vip']);
    expect(plan.blocked).toEqual([]);
    expect(plan.warnings).toEqual([{ roleId: 'mod', roleName: 'Moderator', perms: [expect.objectContaining({ label: 'Mitglieder bannen' })] }]);
    expect(plan.needsOwner).toBe(false);
  });

  it('Administrator nur für den Owner, gesperrte Rollen werden gemeldet', () => {
    const plan = planRoleChange({ guildId: G, current: [], wanted: ['admin', 'top', 'boost'], roles, botTop: 10, actorTop: 9.5 });
    expect(plan.add).toEqual(['admin']);
    expect(plan.needsOwner).toBe(true);
    expect(plan.blocked.map((b) => b.roleId)).toEqual(['top', 'boost']);
    expect(planRoleChange({ guildId: G, current: [], wanted: ['admin'], roles, botTop: 10, actorTop: null }).needsOwner).toBe(false);
  });
});

describe('canGrantPermissions – Runde 3', () => {
  const MANAGE_ROLES = 1n << 28n;
  const BAN = 1n << 2n;
  it('ohne „Rollen verwalten“ geht nichts', () => expect(canGrantPermissions(BAN, 0n).ok).toBe(false));
  it('nur Rechte, die man selbst hat', () => {
    expect(canGrantPermissions(MANAGE_ROLES, BAN).ok).toBe(false);
    expect(canGrantPermissions(MANAGE_ROLES | BAN, BAN).ok).toBe(true);
  });
  it('Administrator darf alles', () => expect(canGrantPermissions(1n << 3n, BAN | MANAGE_ROLES).ok).toBe(true));
});
