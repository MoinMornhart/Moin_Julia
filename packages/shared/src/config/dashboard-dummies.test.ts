import { describe, expect, it } from 'vitest';
import { MODULES } from '../modules.js';
import { moduleLabel, MODULE_DUMMIES } from './dashboard-dummies.js';

describe('Dashboard „Für Dummies“', () => {
  it('jedes Modul hat einen einfachen Namen und eine einfache Erklärung', () => {
    for (const m of MODULES) {
      expect(MODULE_DUMMIES[m.id], m.id).toBeDefined();
      expect(MODULE_DUMMIES[m.id]!.description.length).toBeGreaterThan(10);
    }
  });
  it('aus = normal, an = einfach', () => {
    const mod = MODULES.find((m) => m.id === 'moderation')!;
    expect(moduleLabel(mod, false).name).toBe('Moderation');
    expect(moduleLabel(mod, true).name).toBe('Schiedsrichter');
  });
});
