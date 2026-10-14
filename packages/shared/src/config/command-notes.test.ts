import { describe, expect, it } from 'vitest';
import { COMMAND_CATALOG } from '../commands.catalog.js';
import { commandNote, commandPermissionLabel, JULIA_SENTENCES } from './command-notes.js';

describe('Befehls-Übersicht', () => {
  it('Hinweise: längster passender Name gewinnt', () => {
    expect(commandNote('musik play').needs).toContain('YouTube');
    expect(commandNote('musik skip').bot).toContain('Verbinden');
    expect(commandNote('gibts nicht')).toEqual({});
  });

  it('Rechte lesbar', () => {
    expect(commandPermissionLabel(null)).toBe('alle');
    expect(commandPermissionLabel(String(1n << 28n))).toBe('Rollen verwalten');
    expect(commandPermissionLabel('kaputt')).toBe('besondere Rechte');
  });

  it('Katalog ist erzeugt und vollständig', () => {
    expect(COMMAND_CATALOG.length).toBeGreaterThan(50);
    expect(COMMAND_CATALOG.find((c) => c.name === 'timeout')?.permissions).toBeTruthy();
    expect(JULIA_SENTENCES.length).toBeGreaterThan(5);
  });
});
