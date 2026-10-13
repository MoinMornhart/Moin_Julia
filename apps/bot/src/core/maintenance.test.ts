import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseMaintenance } from '@moin/shared';
import { isMaintenance, pausedByMaintenance, setMaintenance } from './maintenance.js';
import { applyPresence } from './presence.js';
import { guardedRound } from './self-heal.js';

afterEach(() => setMaintenance({ on: false, message: '', since: 0 }));

describe('Wartungsmodus im Bot', () => {
  it('Einstellung lesen: kaputt oder leer → aus', () => {
    expect(parseMaintenance(null)).toEqual({ on: false, message: '', since: 0 });
    expect(parseMaintenance('kein json')).toEqual({ on: false, message: '', since: 0 });
    expect(parseMaintenance(JSON.stringify({ on: true, message: 'Bis 20 Uhr', since: 5 }))).toEqual({ on: true, message: 'Bis 20 Uhr', since: 5 });
  });

  it('pausiert alles außer den Schutzfunktionen', () => {
    expect(pausedByMaintenance('julia')).toBe(false);
    setMaintenance({ on: true, message: '', since: 1 });
    expect(isMaintenance()).toBe(true);
    for (const id of ['julia', 'musik', 'alerts', 'community', 'level']) expect(pausedByMaintenance(id), id).toBe(true);
    for (const id of ['schutz', 'moderation', 'owner', 'kern']) expect(pausedByMaintenance(id), id).toBe(false);
  });

  it('regelmäßige Runden ruhen in der Wartung', async () => {
    const run = vi.fn(async () => undefined);
    const round = guardedRound({ logger: { warn: vi.fn() }, redis: { lpush: vi.fn(), ltrim: vi.fn() } } as never, 'Test', 60_000, run);
    setMaintenance({ on: true, message: '', since: 1 });
    await round();
    expect(run).not.toHaveBeenCalled();
    setMaintenance({ on: false, message: '', since: 0 });
    await round();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('der Bot erscheint in der Wartung offline', () => {
    const setPresence = vi.fn();
    const client = { user: { setPresence }, guilds: { cache: { size: 3 } } } as never;
    setMaintenance({ on: true, message: '', since: 1 });
    applyPresence(client, { status: 'online', type: 'custom', text: 'Moin' } as never, '1.0.0');
    expect(setPresence).toHaveBeenCalledWith({ status: 'invisible', activities: [] });
  });
});
