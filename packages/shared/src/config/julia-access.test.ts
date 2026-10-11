import { describe, expect, it } from 'vitest';
import { COMPAT_PROVIDERS, isCompatProvider } from './ai-providers.js';
import { juliaUserAllowed, matchKeywordRules, ruleWords } from './julia-access.js';
import { parseJuliaConfig } from './julia.js';

const A = '100000000000000301';
const B = '100000000000000302';
const ROLE = '100000000000000700';

describe('Wer darf Julia nutzen?', () => {
  const base = { blockedUserIds: [] as string[], blockedRoleIds: [] as string[], allowUserIds: [] as string[], allowRoleIds: [] as string[] };

  it('ohne Listen: alle', () => {
    expect(juliaUserAllowed(base, A, [])).toBe(true);
  });

  it('Blacklist: Person oder Rolle gesperrt', () => {
    expect(juliaUserAllowed({ ...base, blockedUserIds: [A] }, A, [])).toBe(false);
    expect(juliaUserAllowed({ ...base, blockedRoleIds: [ROLE] }, B, [ROLE])).toBe(false);
    expect(juliaUserAllowed({ ...base, blockedUserIds: [A] }, B, [])).toBe(true);
  });

  it('Whitelist: nur eingetragene Personen/Rollen; Blacklist geht vor', () => {
    const wl = { ...base, allowUserIds: [A], allowRoleIds: [ROLE] };
    expect(juliaUserAllowed(wl, A, [])).toBe(true);
    expect(juliaUserAllowed(wl, B, [ROLE])).toBe(true);
    expect(juliaUserAllowed(wl, B, [])).toBe(false);
    expect(juliaUserAllowed({ ...wl, blockedUserIds: [A] }, A, [])).toBe(false);
  });
});

describe('Stichwort-Regeln', () => {
  const rules = [
    { id: 'r1', words: 'Regeln, Regelwerk', instruction: 'Verweise auf #regeln.', modeId: '' },
    { id: 'r2', words: 'Größe', instruction: 'Sprich über Größe.', modeId: 'm1' },
  ];

  it('ganze Wörter, Groß/klein egal, auch mit Umlauten', () => {
    expect(matchKeywordRules(rules, 'Wo stehen die REGELN?').map((m) => m.word)).toEqual(['Regeln']);
    expect(matchKeywordRules(rules, 'Regelungen sind was anderes')).toEqual([]);
    expect(matchKeywordRules(rules, 'welche größe hat das')).toEqual([{ rule: rules[1], word: 'Größe' }]);
    expect(ruleWords({ words: ' a ,, b ,' })).toEqual(['a', 'b']);
  });

  it('Sonderzeichen in Stichwörtern brechen nichts', () => {
    expect(matchKeywordRules([{ id: 'r3', words: 'c++, (test)', instruction: 'x', modeId: '' }], 'ich lerne c++ heute').map((m) => m.word)).toEqual(['c++']);
  });

  it('Einstellungen: Standard leer, Listen werden geprüft', () => {
    const c = parseJuliaConfig({});
    expect(c).toMatchObject({ blockedUserIds: [], allowUserIds: [], allowRoleIds: [], keywordRules: [] });
    expect(parseJuliaConfig({ blockedUserIds: ['kein-snowflake'] }).blockedUserIds).toEqual([]);
  });
});

describe('Ollama Cloud pro Server', () => {
  it('ist ein eigener Anbieter mit fester Adresse', () => {
    expect(isCompatProvider('ollamacloud')).toBe(true);
    expect(COMPAT_PROVIDERS.ollamacloud.baseUrl).toBe('https://ollama.com/v1');
    expect(parseJuliaConfig({ provider: 'ollamacloud' }).provider).toBe('ollamacloud');
  });
});
