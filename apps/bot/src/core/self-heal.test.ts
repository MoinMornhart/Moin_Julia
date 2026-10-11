import { describe, expect, it, vi } from 'vitest';
import { SELF_HEAL_KEY } from '@moin/shared';
import { guardedRound, recordHeal } from './self-heal.js';

function fakeBot() {
  const list: string[] = [];
  const redis = {
    lpush: vi.fn(async (_k: string, v: string) => list.unshift(v)),
    ltrim: vi.fn(async (_k: string, a: number, b: number) => void list.splice(b + 1)),
    expire: vi.fn(async () => 1),
  };
  return { bot: { logger: { warn: vi.fn() }, redis } as never, list, redis };
}

describe('Selbstheilung', () => {
  it('hängende Runde wird nach der Höchstdauer abgelöst und gemeldet – vorher kein Doppelstart', async () => {
    const { bot, list } = fakeBot();
    let clock = 0;
    let calls = 0;
    const never = new Promise<void>(() => undefined); // Runde, die nie fertig wird
    const run = guardedRound(bot, 'Social Media', 60_000, () => (++calls === 1 ? never : Promise.resolve()), () => clock);
    void run();
    clock = 30_000;
    await run(); // läuft noch regulär → kein zweiter Start
    expect(calls).toBe(1);
    clock = 61_000;
    await run(); // hängt zu lange → abgelöst
    expect(calls).toBe(2);
    expect(JSON.parse(list[0]!)).toMatchObject({ area: 'Social Media', problem: 'Runde hing seit 61 s', action: 'Sperre gelöst, neu gestartet' });
    clock = 62_000;
    await run(); // die neue Runde war fertig → normal weiter
    expect(calls).toBe(3);
  });

  it('Fehler in einer Runde lösen die Sperre (nächste Runde läuft)', async () => {
    const { bot } = fakeBot();
    let calls = 0;
    const run = guardedRound(bot, 'X', 60_000, async () => {
      calls++;
      throw new Error('kaputt');
    });
    await run();
    await run();
    expect(calls).toBe(2);
  });

  it('Bericht: neueste zuerst, höchstens 50, im festen Redis-Schlüssel', async () => {
    const { bot, list, redis } = fakeBot();
    for (let i = 0; i < 55; i++) await recordHeal(bot, { area: 'A', problem: `p${i}`, action: 'x' }, Date.UTC(2026, 9, 11, 12, 0, i));
    expect(list).toHaveLength(50);
    expect(JSON.parse(list[0]!)).toMatchObject({ problem: 'p54', at: '2026-10-11T12:00:54.000Z' });
    expect(redis.lpush).toHaveBeenCalledWith(SELF_HEAL_KEY, expect.any(String));
  });
});
