import { PermissionFlagsBits } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { neutralizeRoles } from './index.js';

const EVERYONE = '100000000000000001';

function overwrite(id: string, type: number, allow: bigint) {
  return { id, type, allow: { has: (p: bigint) => (allow & p) === p } };
}

describe('Eigene Sprachkanäle: Sperren wirkt auch gegen Rollen-Freigaben', () => {
  it('Rollen, die „Verbinden“ erlauben, werden neutral – Personen und @everyone bleiben', async () => {
    const edit = vi.fn(async () => undefined);
    const cache = new Map([
      [EVERYONE, overwrite(EVERYONE, 0, 0n)],
      ['role-member', overwrite('role-member', 0, PermissionFlagsBits.Connect | PermissionFlagsBits.ViewChannel)],
      ['role-other', overwrite('role-other', 0, PermissionFlagsBits.Speak)],
      ['owner', overwrite('owner', 1, PermissionFlagsBits.Connect)],
    ]);
    const changed = await neutralizeRoles({ permissionOverwrites: { cache, edit } } as never, EVERYONE, 'Connect');
    expect(changed).toBe(1);
    expect(edit).toHaveBeenCalledWith('role-member', { Connect: null });
  });
});
