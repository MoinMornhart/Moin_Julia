import { describe, expect, it } from 'vitest';
import { mayControl, mergeOverwrites } from './logic.js';

describe('Eigene Sprachkanäle – Bug-Hunting Runde 2', () => {
  it('Übernehmen nur, wer selbst im Kanal ist', () => {
    expect(mayControl('claim', 'owner', 'x', false, false)).toBe('not-in-channel');
    expect(mayControl('claim', 'owner', 'x', false, true)).toBe('ok');
    expect(mayControl('claim', 'owner', 'x', true, true)).toBe('owner-here');
    expect(mayControl('claim', 'owner', 'owner', false, false)).toBe('ok');
  });

  it('doppelte Rechte-Einträge werden zusammengeführt (Kategorie + Sperre für @everyone)', () => {
    const merged = mergeOverwrites([
      { id: 'everyone', allow: 0n, deny: 1024n, type: 0 },
      { id: 'me', allow: 1n, type: 1 },
      { id: 'everyone', deny: 1048576n, type: 0 },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.find((o) => o.id === 'everyone')).toEqual({ id: 'everyone', allow: 0n, deny: 1024n | 1048576n, type: 0 });
  });
});
