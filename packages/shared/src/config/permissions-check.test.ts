import { describe, expect, it } from 'vitest';
import { auditPermissions, dangerousIn, isReadOnly, PERM, READ_ONLY_DENY, readOnlyOverwrite } from './permissions-check.js';

const G = '100000000000000001';
const s = (v: bigint) => v.toString();

describe('Rechte-Check', () => {
  it('erkennt gefährliche Rechte im Bitfeld', () => {
    expect(dangerousIn(s(PERM.Administrator | PERM.SendMessages)).map((p) => p.name)).toEqual(['Administrator']);
    expect(dangerousIn('0')).toEqual([]);
    expect(dangerousIn('kein-wert')).toEqual([]);
  });

  it('@everyone mit gefährlichen Rechten = hoch; Admin-Rolle = mittel; Bot-Rollen zählen nicht', () => {
    const roles = [
      { id: G, name: '@everyone', permissions: s(PERM.ViewChannel | PERM.ManageChannels) },
      { id: '2', name: 'Team', permissions: s(PERM.Administrator) },
      { id: '3', name: 'Moin_Julia', permissions: s(PERM.Administrator), managed: true },
      { id: '4', name: 'Mitglied', permissions: s(PERM.SendMessages) },
    ];
    const f = auditPermissions(G, roles, []);
    expect(f.map((x) => [x.severity, x.where, x.targetId])).toEqual([
      ['hoch', 'everyone', G],
      ['mittel', 'rolle', '2'],
    ]);
    expect(f[0]!.title).toBe('Jedes Mitglied hat „Kanäle verwalten“');
  });

  it('Kanal-Ausnahme für @everyone mit gefährlichem Recht wird gemeldet', () => {
    const channels = [
      { id: 'c1', name: 'feedback', type: 0, overwrites: [{ id: G, type: 0, allow: s(PERM.ManageMessages | PERM.MentionEveryone), deny: '0' }] },
      { id: 'c2', name: 'chat', type: 0, overwrites: [{ id: G, type: 0, allow: s(PERM.SendMessages), deny: '0' }] },
      { id: 'c3', name: 'team', type: 0, overwrites: [{ id: '2', type: 0, allow: s(PERM.ManageMessages), deny: '0' }] },
    ];
    const f = auditPermissions(G, [], channels);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ severity: 'hoch', where: 'kanal', targetId: 'c1', title: '#feedback: jedes Mitglied hat „@everyone erwähnen“, „Nachrichten verwalten“' });
  });

  it('„Nur lesen“ an und aus, andere Bits bleiben erhalten', () => {
    const on = readOnlyOverwrite({ allow: s(PERM.SendMessages | PERM.AddReactions), deny: s(PERM.MentionEveryone) }, true);
    expect(BigInt(on.allow)).toBe(PERM.AddReactions);
    expect(BigInt(on.deny)).toBe(PERM.MentionEveryone | READ_ONLY_DENY);
    expect(isReadOnly(G, { overwrites: [{ id: G, type: 0, ...on }] })).toBe(true);
    const off = readOnlyOverwrite(on, false);
    expect(BigInt(off.deny)).toBe(PERM.MentionEveryone);
    expect(isReadOnly(G, { overwrites: [{ id: G, type: 0, ...off }] })).toBe(false);
    expect(readOnlyOverwrite(undefined, true)).toEqual({ allow: '0', deny: READ_ONLY_DENY.toString() });
  });
});
