import { describe, expect, it } from 'vitest';
import { expectedOverwrites, overwriteProblems } from './owner.js';

const ctx = { everyoneId: 'G', ownerId: 'O', selfId: 'ME', roleIds: ['G', 'R1', 'R2'], botIds: ['ME', 'B1'], allowBots: true };

describe('Owner-Bereich', () => {
  it('Soll-Rechte: alle Rollen gesperrt, Owner + Bots erlaubt, Moin_Julia verwaltet', () => {
    const ow = expectedOverwrites(ctx);
    expect(ow.filter((o) => o.deny.includes('ViewChannel')).map((o) => o.id)).toEqual(['G', 'R1', 'R2']);
    expect(ow.filter((o) => o.allow.includes('ViewChannel')).map((o) => o.id)).toEqual(['O', 'B1', 'ME']);
    expect(ow.find((o) => o.id === 'ME')?.allow).toContain('ManageChannels');
    expect(expectedOverwrites({ ...ctx, allowBots: false }).some((o) => o.id === 'B1')).toBe(false);
  });

  it('erkennt Aufweichungen, ignoriert zusätzliche Verbote', () => {
    const expected = expectedOverwrites(ctx);
    expect(overwriteProblems(expected, expected)).toEqual([]);
    const tampered = expected.map((o) => (o.id === 'R1' ? { ...o, deny: [] } : o)).concat([{ id: 'U9', type: 'member' as const, allow: ['ViewChannel'], deny: [] }]);
    expect(overwriteProblems(tampered, expected)).toEqual(['deny-missing:R1', 'foreign-allow:U9']);
    const extra = expected.concat([{ id: 'U8', type: 'member' as const, allow: [], deny: ['ViewChannel'] }]);
    expect(overwriteProblems(extra, expected)).toEqual([]);
  });
});
