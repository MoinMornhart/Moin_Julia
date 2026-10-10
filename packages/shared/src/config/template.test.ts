import { describe, expect, it } from 'vitest';
import {
  buildTemplate,
  collectSnowflakes,
  convertGalaxyPlaceholders,
  matchRefs,
  readTemplateFile,
  remapModuleConfig,
  replaceSnowflakes,
} from './template.js';
import { fillVariables } from './message.js';

const MODLOG = '100000000000000028';
const CHAT = '100000000000000023';
const MOD_ROLE = '100000000000000012';
const USER = '100000000000000777';

const source = {
  appVersion: '0.8.0',
  guildName: 'Quelle',
  locale: 'de' as const,
  modules: {
    logging: { enabled: true, config: { defaultChannelId: MODLOG, ignoredChannelIds: [CHAT] } },
    schutz: { enabled: false, config: { alertRoleId: MOD_ROLE, antiNuke: { whitelistUserIds: [USER] } } },
  },
  rolePanels: [{ name: 'Spiele', channelId: CHAT, data: { roles: [{ roleId: MOD_ROLE, label: 'Mod' }] } }],
  channels: [
    { id: MODLOG, name: 'mod-log', type: 0 },
    { id: CHAT, name: 'allgemein', type: 0 },
    { id: '100000000000000099', name: 'unbenutzt', type: 0 },
  ],
  roles: [{ id: MOD_ROLE, name: 'Moderator' }],
  now: new Date('2026-10-08T12:00:00Z'),
};

describe('Vorlagen – IDs', () => {
  it('sammelt alle Snowflakes, auch verschachtelt', () => {
    expect([...collectSnowflakes(source.modules)].sort()).toEqual([CHAT, MOD_ROLE, MODLOG, USER].sort());
  });
  it('ersetzt laut Zuordnung, entfernt weggelassene aus Listen, lässt Unbekanntes stehen', () => {
    const map = new Map<string, string | null>([
      [MODLOG, '200000000000000028'],
      [CHAT, null],
    ]);
    expect(replaceSnowflakes(source.modules.logging.config, map)).toEqual({ defaultChannelId: '200000000000000028', ignoredChannelIds: [] });
    expect(replaceSnowflakes({ a: CHAT, u: USER }, map)).toEqual({ a: '', u: USER });
  });
});

describe('Vorlagen – Export & Import', () => {
  const template = buildTemplate(source);

  it('Export enthält nur benutzte Kanäle/Rollen mit Namen', () => {
    expect(template.refs.channels).toEqual({ [MODLOG]: { name: 'mod-log', type: 0 }, [CHAT]: { name: 'allgemein', type: 0 } });
    expect(template.refs.roles).toEqual({ [MOD_ROLE]: { name: 'Moderator' } });
    expect(template.format).toBe('moin-julia-vorlage');
  });

  it('Rundreise: Datei schreiben und wieder lesen', () => {
    const read = readTemplateFile(JSON.stringify(template));
    expect(read.ok).toBe(true);
  });

  it('erkennt fremde, kaputte und zu neue Dateien', () => {
    expect(readTemplateFile('kein json')).toEqual({ ok: false, error: 'Die Datei ist kein gültiges JSON.' });
    expect(readTemplateFile('{"format":"galaxy"}')).toMatchObject({ ok: false, error: 'Das ist keine Moin_Julia-Vorlage.' });
    expect(readTemplateFile(JSON.stringify({ ...template, version: 99 }))).toMatchObject({ ok: false, error: expect.stringContaining('neueren') });
  });

  it('ordnet per Name zu – Groß/Klein, Leer- und Bindestriche egal', () => {
    const matches = matchRefs(template, {
      channels: [
        { id: '300000000000000001', name: 'Mod Log', type: 0 },
        { id: '300000000000000002', name: 'general', type: 0 },
      ],
      roles: [{ id: '300000000000000010', name: 'moderator' }],
    });
    expect(matches).toEqual([
      { sourceId: MODLOG, kind: 'channel', name: 'mod-log', targetId: '300000000000000001' },
      { sourceId: CHAT, kind: 'channel', name: 'allgemein', targetId: null },
      { sourceId: MOD_ROLE, kind: 'role', name: 'Moderator', targetId: '300000000000000010' },
    ]);
  });

  it('übertragene Modul-Konfiguration wird geprüft und vervollständigt', () => {
    const res = remapModuleConfig('logging', template.modules.logging!.config, new Map([[MODLOG, '300000000000000001'], [CHAT, null]]));
    expect(res.ok).toBe(true);
    const remapped = (res as { config: unknown }).config as {
      defaultChannelId: string;
      categories: { voice: { enabled: boolean } };
    };
    expect(remapped.defaultChannelId).toBe('300000000000000001');
    expect(remapped.categories.voice.enabled).toBe(true);
  });

  it('fehlende Rolle/Kanal entfernt nur den betroffenen Eintrag – Rest bleibt erhalten', () => {
    const ROLE_A = '200000000000000501';
    const ROLE_B = '200000000000000502';
    const LVL_CH = '200000000000000503';
    const config = {
      announce: 'channel',
      levelUpChannelId: LVL_CH,
      levelUpText: 'Eigener Text {user}',
      rewards: [
        { level: 5, roleId: ROLE_A },
        { level: 10, roleId: ROLE_B },
      ],
      boosts: [{ roleId: ROLE_A, percent: 50 }],
    };
    const res = remapModuleConfig('level', config, new Map([[ROLE_A, null], [ROLE_B, '300000000000000502'], [LVL_CH, null]]));
    expect(res.ok).toBe(true);
    const out = (res as { config: Record<string, unknown>; dropped: number });
    expect(out.config.levelUpText).toBe('Eigener Text {user}');
    expect(out.config.levelUpChannelId).toBe('');
    expect(out.config.rewards).toEqual([{ level: 10, roleId: '300000000000000502' }]);
    expect(out.config.boosts).toEqual([]);
    expect(out.dropped).toBe(2);
  });
});

describe('GalaxyBot-Platzhalter', () => {
  it('wandelt bekannte um, meldet unbekannte', () => {
    // laut GalaxyBot-Doku: %TOTALUSERCOUNT% = mit Bots, %USERCOUNT% = ohne Bots, %BOTCOUNT% = Bots
    expect(convertGalaxyPlaceholders('Hey %MENTION%, willkommen auf %SERVERNAME%! Du bist Nr. %TOTALUSERCOUNT% (%USERCOUNT% Menschen, %BOTCOUNT% Bots). %RANDOM%')).toEqual({
      text: 'Hey {user}, willkommen auf {server}! Du bist Nr. {memberCount} ({humanCount} Menschen, {botCount} Bots). %RANDOM%',
      unknown: ['%RANDOM%'],
    });
  });

  it('neue Platzhalter werden in Nachrichten ersetzt', () => {
    const ctx = { userId: '1', userName: 'Anna', userTag: 'anna', userAvatarUrl: null, serverName: 'Moin', serverIconUrl: null, memberCount: 1284, humanCount: 1270, botCount: 14 };
    expect(fillVariables('{memberCount}/{humanCount}/{botCount}', ctx)).toBe('1.284/1.270/14');
    expect(fillVariables('{humanCount}', { ...ctx, humanCount: undefined, botCount: undefined })).toBe('1.284');
  });
});
