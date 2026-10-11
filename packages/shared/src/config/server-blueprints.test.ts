import { describe, expect, it } from 'vitest';
import { PERM } from './permissions-check.js';
import { blueprintModuleConfigs, blueprintOverwrites, getBlueprint, mergeConfig, MOD_PERMISSIONS, SERVER_BLUEPRINTS } from './server-blueprints.js';
import { MODULE_CONFIG_SCHEMAS } from './template.js';

const G = '100000000000000001';

describe('Server-Profile (Baupläne)', () => {
  it('eindeutige Schlüssel, Team-Rolle ohne gefährliche Verwaltungsrechte', () => {
    for (const b of SERVER_BLUEPRINTS) {
      const keys = [...b.roles.map((r) => r.key), ...b.categories.flatMap((c) => [`cat:${c.key}`, ...c.channels.map((ch) => ch.key)])];
      expect(new Set(keys).size, b.id).toBe(keys.length);
      expect(b.roles.some((r) => r.kind === 'mod'), b.id).toBe(true);
    }
    expect(MOD_PERMISSIONS & PERM.Administrator).toBe(0n);
    expect(MOD_PERMISSIONS & PERM.ManageRoles).toBe(0n);
    expect(MOD_PERMISSIONS & PERM.ManageGuild).toBe(0n);
  });

  it('Modul-Einstellungen sind gültig, sobald alle IDs da sind', () => {
    for (const b of SERVER_BLUEPRINTS) {
      const ids: Record<string, string> = {};
      let n = 200;
      for (const r of b.roles) ids[r.key] = `100000000000000${n++}`;
      for (const c of b.categories) {
        ids[`cat:${c.key}`] = `100000000000000${n++}`;
        for (const ch of c.channels) ids[ch.key] = `100000000000000${n++}`;
      }
      const configs = blueprintModuleConfigs(b, ids);
      expect(Object.keys(configs).length, b.id).toBe(Object.keys(b.modules).length);
      for (const [moduleId, config] of Object.entries(configs)) {
        const schema = MODULE_CONFIG_SCHEMAS[moduleId];
        expect(schema, moduleId).toBeTruthy();
        expect(schema!.safeParse(config).success, `${b.id}/${moduleId}`).toBe(true);
      }
    }
  });

  it('fehlt ein Kanal, wird das Modul ausgelassen', () => {
    const b = getBlueprint('streamer')!;
    expect(Object.keys(blueprintModuleConfigs(b, {}))).toEqual([]);
  });

  it('Rechte: Team-Bereich unsichtbar für alle, Nur-lesen nur fürs Team beschreibbar', () => {
    const team = blueprintOverwrites('team', G, ['111111111111111111'], '999999999999999999');
    expect(team[0]).toEqual({ id: G, type: 0, allow: '0', deny: PERM.ViewChannel.toString() });
    expect(BigInt(team[1]!.allow) & PERM.ViewChannel).toBe(PERM.ViewChannel);
    expect(team.at(-1)).toMatchObject({ id: '999999999999999999', type: 1 });
    const ro = blueprintOverwrites('readonly', G, ['111111111111111111'], null);
    expect(BigInt(ro[0]!.deny) & PERM.SendMessages).toBe(PERM.SendMessages);
    expect(BigInt(ro[1]!.allow) & PERM.SendMessages).toBe(PERM.SendMessages);
    expect(blueprintOverwrites('all', G, [], null)).toEqual([]);
  });

  it('Zusammenführen behält vorhandene Einstellungen', () => {
    expect(mergeConfig({ welcome: { enabled: false, template: { content: 'x' } }, leave: { enabled: true } }, { welcome: { enabled: true, channelId: '1' } })).toEqual({
      welcome: { enabled: true, template: { content: 'x' }, channelId: '1' },
      leave: { enabled: true },
    });
    expect(mergeConfig(null, { a: [1] })).toEqual({ a: [1] });
  });
});
