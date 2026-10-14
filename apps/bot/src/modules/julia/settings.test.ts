import { PermissionFlagsBits } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../../core/types.js';
import { applySetting, canConfigure, isSensitiveSetting } from './settings.js';

const G = '100000000000000001';

function fakeBot(rows: Record<string, { enabled: boolean; config: unknown }> = {}) {
  const publish = vi.fn(async () => 1);
  const bot = {
    prisma: {
      guildModule: {
        findUnique: vi.fn(async ({ where }: { where: { guildId_moduleId: { moduleId: string } } }) => rows[where.guildId_moduleId.moduleId] ?? null),
        upsert: vi.fn(async ({ where, create, update }: { where: { guildId_moduleId: { moduleId: string } }; create: { enabled: boolean; config: unknown }; update: { enabled?: boolean; config?: unknown } }) => {
          const id = where.guildId_moduleId.moduleId;
          rows[id] = rows[id] ? { ...rows[id], ...update } as { enabled: boolean; config: unknown } : { enabled: create.enabled, config: create.config };
          return rows[id];
        }),
      },
    },
    redis: { publish },
    modules: { invalidate: vi.fn() },
  } as unknown as BotContext;
  return { bot, rows, publish };
}
const guild = { id: G } as never;

describe('Julia ändert Einstellungen', () => {
  it('wer darf: Owner, Administrator, Instanz-Admin', () => {
    const member = (id: string, admin: boolean) => ({ id, permissions: { has: (p: bigint) => admin && p === PermissionFlagsBits.Administrator } });
    expect(canConfigure({ ownerId: 'o' }, member('o', false), null)).toBe(true);
    expect(canConfigure({ ownerId: 'o' }, member('a', true), null)).toBe(true);
    expect(canConfigure({ ownerId: 'o' }, member('p', false), 'p')).toBe(true);
    expect(canConfigure({ ownerId: 'o' }, member('x', false), 'p')).toBe(false);
    expect(isSensitiveSetting({ kind: 'einstellung', moduleId: 'schutz', field: null, value: 'aus' })).toBe(true);
    expect(isSensitiveSetting({ kind: 'einstellung', moduleId: 'level', field: null, value: 'aus' })).toBe(false);
  });

  it('Modul aus und Feld ändern, mit Prüfung', async () => {
    const { bot, rows, publish } = fakeBot({ level: { enabled: true, config: {} } });
    const off = await applySetting(bot, guild, { kind: 'einstellung', moduleId: 'level', field: null, value: 'aus' }, 'u');
    expect(off.ok && off.undoId).toBeTruthy();
    expect(rows.level!.enabled).toBe(false);
    expect(publish).toHaveBeenCalled();
    const vol = await applySetting(bot, guild, { kind: 'einstellung', moduleId: 'musik', field: 'defaultvolume', value: '40' }, 'u');
    expect(vol.ok).toBe(true);
    expect((rows.musik!.config as { defaultVolume: number }).defaultVolume).toBe(40);
    const bad = await applySetting(bot, guild, { kind: 'einstellung', moduleId: 'musik', field: 'defaultVolume', value: '5000' }, 'u');
    expect(bad.ok).toBe(false);
    expect((await applySetting(bot, guild, { kind: 'einstellung', moduleId: 'gibtsnicht', field: null, value: 'an' }, 'u')).ok).toBe(false);
    expect((await applySetting(bot, guild, { kind: 'einstellung', moduleId: 'owner', field: null, value: 'aus' }, 'u')).ok).toBe(false);
  });
});
