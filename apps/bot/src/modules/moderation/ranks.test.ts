import { describe, expect, it } from 'vitest';
import { rankCommand, targetPosition } from './ranks.js';

describe('/raenge verschieben (Ränge-Fixer)', () => {
  it('rechnet die Zielposition innerhalb der Grenzen aus', () => {
    expect(targetPosition(3, 'hoch', 1, 9)).toBe(4);
    expect(targetPosition(3, 'hoch', 20, 9)).toBe(9);
    expect(targetPosition(3, 'runter', 1, 9)).toBe(2);
    expect(targetPosition(3, 'runter', 10, 9)).toBe(1);
    expect(targetPosition(3, 'oben', 1, 9)).toBe(9);
    expect(targetPosition(3, 'unten', 1, 9)).toBe(1);
  });

  it('Befehl: nur mit „Rollen verwalten“, deutsch und englisch', () => {
    const data = rankCommand.data as { name: string; default_member_permissions: string; name_localizations: Record<string, string> };
    expect(data.name).toBe('raenge');
    expect(data.name_localizations['en-US']).toBe('ranks');
    expect(data.default_member_permissions).toBe(String(1n << 28n));
  });
});
