import { describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../../core/types.js';
import { kernModule } from './index.js';

/** Redis-Attrappe (nur was die Zugangs-Knöpfe brauchen) */
function fakeRedis(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => void store.set(k, v)),
    del: vi.fn(async (...keys: string[]) => keys.forEach((k) => store.delete(k))),
    exists: vi.fn(async (k: string) => (store.has(k) ? 1 : 0)),
  };
}

const G = '100000000000000001';
const OPERATOR = '100000000000000500';
const request = JSON.stringify({ by: OPERATOR, byName: 'Philip', reason: 'Ticket-Panel prüfen bitte', scopes: ['dashboard'], at: Date.now() });

function clickWorld(clicker: { id: string; owner?: boolean; admin?: boolean }, what: string, redisInit: Record<string, string> = { [`moin:support:request:${G}`]: request }) {
  const redis = fakeRedis(redisInit);
  const dm = vi.fn(async () => undefined);
  const guild = {
    id: G,
    name: 'Testserver',
    ownerId: clicker.owner ? clicker.id : 'someone-else',
    members: { fetch: vi.fn(async () => ({ id: clicker.id, displayName: 'Klicker', user: { username: 'klicker' }, permissions: { has: () => !!clicker.admin } })) },
  };
  const bot = { redis, client: { guilds: { fetch: vi.fn(async () => guild) }, users: { fetch: vi.fn(async () => ({ send: dm })) } }, logger: { warn: vi.fn() } } as unknown as BotContext;
  const update = vi.fn(async () => undefined);
  const reply = vi.fn(async () => undefined);
  const interaction = { user: { id: clicker.id }, message: { content: 'Anfrage' }, update, reply, isButton: () => true };
  return { bot, redis, dm, update, reply, run: () => kernModule.onDmComponent!({ interaction: interaction as never, action: 'acc', args: [G, what], bot }) };
}

describe('Betreiber-Zugang nur mit Zustimmung (Issue #13)', () => {
  it('ist immer aktiv – unabhängig von Modul-Schaltern', () => {
    expect(kernModule.alwaysOn).toBe(true);
  });

  it('den Generalschlüssel /moin zugang gibt es nicht mehr', () => {
    const data = kernModule.commands![0]!.data as { options?: { name: string }[] };
    expect(data.options?.map((o) => o.name)).not.toContain('zugang');
    expect(data.options?.map((o) => o.name)).toContain('support-zugang');
  });

  it('nur Owner/Administratoren dürfen entscheiden', async () => {
    const w = clickWorld({ id: 'member' }, 'grant-immer');
    await w.run();
    expect((w.reply.mock.calls[0] as unknown as [{ content: string }])[0].content).toContain('nur der Server-Owner');
    expect(w.redis.store.has(`moin:support:${G}`)).toBe(false);
  });

  it('Owner gibt frei → Zugang mit Umfang und Begründung, Betreiber bekommt DM', async () => {
    const w = clickWorld({ id: 'owner1', owner: true }, 'grant-immer');
    await w.run();
    const grant = JSON.parse(w.redis.store.get(`moin:support:${G}`)!);
    expect(grant).toMatchObject({ by: 'owner1', until: null, scopes: ['dashboard'], reason: 'Ticket-Panel prüfen bitte' });
    expect(w.redis.store.has(`moin:support:request:${G}`)).toBe(false);
    expect(w.dm).toHaveBeenCalled();
  });

  it('Admin sperrt → kein Zugang, keine Anfrage mehr', async () => {
    const w = clickWorld({ id: 'admin1', admin: true }, 'block', { [`moin:support:request:${G}`]: request, [`moin:support:${G}`]: '{}' });
    await w.run();
    expect(w.redis.store.has(`moin:support:block:${G}`)).toBe(true);
    expect(w.redis.store.has(`moin:support:${G}`)).toBe(false);
    expect(w.redis.store.has(`moin:support:request:${G}`)).toBe(false);
  });
});

describe('Start des Bots', () => {
  it('Kern-Modul steht nicht im Katalog, darf aber registriert werden (sonst stürzt der Bot beim Start ab)', async () => {
    const { ModuleRegistry } = await import('../../core/registry.js');
    const { botModules } = await import('../index.js');
    expect(() => new ModuleRegistry({} as never, botModules, 'token', '1')).not.toThrow();
  });
});
