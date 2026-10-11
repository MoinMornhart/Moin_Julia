import { describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../../core/types.js';
import { kernModule } from './index.js';

const OWNER = '100000000000000500';

/** Nachgebaute Instanz-Einstellungen (AppSetting-Tabelle) */
function world(initial: Record<string, string> = {}) {
  const rows = new Map<string, { key: string; value: string; secret: boolean }>(Object.entries({ instanceOwnerId: OWNER, dashboardUrl: 'https://dash.example.org/', ...initial }).map(([key, value]) => [key, { key, value, secret: false }]));
  const appSetting = {
    findMany: vi.fn(async () => [...rows.values()]),
    upsert: vi.fn(async ({ where, create }: { where: { key: string }; create: { key: string; value: string; secret: boolean } }) => void rows.set(where.key, create)),
    deleteMany: vi.fn(async ({ where }: { where: { key: string } }) => void rows.delete(where.key)),
  };
  const bot = { prisma: { appSetting, $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)) } } as unknown as BotContext;
  return { bot, rows };
}

async function run(bot: BotContext, userId: string, aktion: string) {
  const reply = vi.fn(async () => undefined);
  const interaction = { user: { id: userId }, guildId: '100000000000000001', options: { getString: () => aktion }, reply };
  await kernModule.commands![0]!.execute({ interaction: interaction as never, locale: 'de', bot });
  return (reply.mock.calls[0] as unknown as [{ content: string }])[0].content;
}

describe('/moin zugang (Generalschlüssel)', () => {
  it('ist immer aktiv – unabhängig von Modul-Schaltern', () => {
    expect(kernModule.alwaysOn).toBe(true);
  });

  it('nur der Instanz-Admin – alle anderen werden abgelehnt', async () => {
    const w = world();
    expect(await run(w.bot, '100000000000000999', 'an')).toContain('nur der Instanz-Admin');
    expect(w.rows.has('masterAccess')).toBe(false);
  });

  it('an → gespeichert + Link zum Dashboard dieses Servers; aus → wieder weg', async () => {
    const w = world();
    const on = await run(w.bot, OWNER, 'an');
    expect(on).toContain('Generalschlüssel ist an');
    expect(on).toContain('https://dash.example.org/g/100000000000000001');
    expect(w.rows.get('masterAccess')?.value).toBe('true');
    expect(await run(w.bot, OWNER, 'link')).toContain('ist an');
    expect(await run(w.bot, OWNER, 'aus')).toContain('ist aus');
    expect(w.rows.has('masterAccess')).toBe(false);
    expect(await run(w.bot, OWNER, 'link')).toContain('Einschalten: /moin zugang an');
  });
});

describe('Start des Bots', () => {
  it('Kern-Modul steht nicht im Katalog, darf aber registriert werden (sonst stürzt der Bot beim Start ab)', async () => {
    const { ModuleRegistry } = await import('../../core/registry.js');
    const { botModules } = await import('../index.js');
    expect(() => new ModuleRegistry({} as never, botModules, 'token', '1')).not.toThrow();
  });
});
