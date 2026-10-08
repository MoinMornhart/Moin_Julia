import { PermissionFlagsBits, type Guild } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { isRoleSafe, SELF_SERVICE_FORBIDDEN, safeRoleIds, STAFF_FORBIDDEN } from './role-safety.js';

const role = (id: string, bits: bigint) => ({ id, name: `Rolle ${id}`, permissions: { bitfield: bits } });
const guild = {
  id: 'g',
  roles: {
    cache: new Map([
      ['mitglied', role('mitglied', PermissionFlagsBits.SendMessages | PermissionFlagsBits.ViewChannel)],
      ['admin', role('admin', PermissionFlagsBits.Administrator)],
      ['mod', role('mod', PermissionFlagsBits.KickMembers | PermissionFlagsBits.ModerateMembers)],
      ['rollenchef', role('rollenchef', PermissionFlagsBits.ManageRoles)],
    ]),
  },
} as unknown as Guild;

describe('Keine gefährlichen Rollen automatisch vergeben (Security-Audit)', () => {
  it('Panels, Auto-Rollen, Level …: nur harmlose Rollen', () => {
    const warn = vi.fn();
    expect(safeRoleIds(guild, ['mitglied', 'admin', 'mod', 'rollenchef'], SELF_SERVICE_FORBIDDEN, { warn } as never, 'Test')).toEqual(['mitglied']);
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it('Bewerbungen: Moderations-Rollen ja, Admin und Rollen verwalten nein', () => {
    expect(safeRoleIds(guild, ['mitglied', 'admin', 'mod', 'rollenchef'], STAFF_FORBIDDEN)).toEqual(['mitglied', 'mod']);
  });

  it('unbekannte Rolle → nicht sicher', () => {
    expect(isRoleSafe(undefined, SELF_SERVICE_FORBIDDEN)).toBe(false);
  });
});
