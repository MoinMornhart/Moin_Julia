import { describe, expect, it } from 'vitest';
import { effectiveLimit, limitCheck, wordCount } from './julia-limits.js';
import { buildSystemPrompt, parseJuliaConfig } from './julia.js';
import { addRuler, parseRoyal, parseRoyalCommand, removeRuler, royalNames, royalRuler } from './royal.js';

const OWNER = '100000000000000500';
const MAX = '100000000000000600';

describe('Herrscher – nur der Instanz-Admin bestimmt', () => {
  it('Instanz-Admin ist IMMER König – auch wenn alles andere aus ist', () => {
    const royal = parseRoyal(null);
    expect(royal.ownerTitle).toBe('König');
    expect(royalRuler(royal, OWNER, OWNER)).toEqual({ title: 'König' });
    expect(royalRuler({ ...royal, enabled: false }, OWNER, OWNER)).toEqual({ title: 'König' });
    expect(royalRuler(royal, MAX, OWNER)).toBeNull();
    expect(parseRoyal('kaputt{').ownerTitle).toBe('König');
  });

  it('ernennen, Titel, absetzen; ernannte Herrscher lassen sich gesammelt abschalten', () => {
    let royal = addRuler(parseRoyal(null), { id: MAX, name: 'Max', title: 'Kaiser' });
    expect(royalRuler(royal, MAX, OWNER)).toEqual({ title: 'Kaiser' });
    expect(royalNames({ ...royal, ownerName: 'Philip' })).toEqual([
      { name: 'Philip', title: 'König' },
      { name: 'Max', title: 'Kaiser' },
    ]);
    expect(royalRuler({ ...royal, enabled: false }, MAX, OWNER)).toBeNull();
    royal = removeRuler(royal, MAX);
    expect(royalRuler(royal, MAX, OWNER)).toBeNull();
  });

  it('Sätze an Julia werden ohne KI erkannt', () => {
    expect(parseRoyalCommand('ernenne @Max zum König', true)).toEqual({ action: 'add', title: 'König' });
    expect(parseRoyalCommand('mach @Anna zur Kaiserin!', true)).toEqual({ action: 'add', title: 'Kaiserin' });
    expect(parseRoyalCommand('setz @Max ab', true)).toEqual({ action: 'remove' });
    expect(parseRoyalCommand('nimm @Max die Krone', true)).toEqual({ action: 'remove' });
    expect(parseRoyalCommand('diene nur noch mir', false)).toEqual({ action: 'only', on: true });
    expect(parseRoyalCommand('diene wieder allen', false)).toEqual({ action: 'only', on: false });
    expect(parseRoyalCommand('wie geht es dir?', false)).toBeNull();
    expect(parseRoyalCommand('mach mir einen Witz', false)).toBeNull();
    expect(parseRoyalCommand('ernenne @Max zum König', false)).toBeNull();
  });

  it('Julia: Chef ernst nehmen, loyal verteidigen, Anweisungen nur von Herrschern – ohne Beleidigungen', () => {
    const p = buildSystemPrompt({
      serverName: 'Moin',
      persona: 'x',
      length: 'kurz',
      creativity: 'normal',
      memoryEnabled: false,
      speaker: { name: 'Anna', profile: null },
      flirty: false,
      loyalTo: [{ name: 'Philip', title: 'König' }],
    });
    expect(p.dynamic).toContain('Philip („König“)');
    expect(p.dynamic).toContain('verteidigst du sie');
    expect(p.dynamic).toContain('ohne die andere Person zu beleidigen');
    expect(p.dynamic).toContain('NUR von deinen Herrschern');
    const king = buildSystemPrompt({ serverName: 'Moin', persona: 'x', length: 'kurz', creativity: 'normal', memoryEnabled: false, speaker: { name: 'Philip', profile: null }, flirty: false, ruler: { title: 'König' } });
    expect(king.dynamic).toContain('„König“ und dein Chef');
    expect(king.dynamic).toContain('niemals sexuell');
    expect(king.dynamic).toContain('Grundregeln');
  });
});

describe('Limits pro Person/Rolle', () => {
  const ROLE = '100000000000000700';
  const config = parseJuliaConfig({
    perUserPerHour: 30,
    limitOverrides: [
      { id: MAX, kind: 'user', amount: 200, unit: 'antworten', period: 'stunde' },
      { id: ROLE, kind: 'role', amount: 0 },
    ],
    unlimitedRoleIds: [],
  });

  it('eigene Regel > Rolle > allgemein', () => {
    expect(effectiveLimit(config, MAX, [ROLE])).toMatchObject({ amount: 200, unit: 'antworten', period: 'stunde' });
    expect(effectiveLimit(config, '1', [ROLE]).amount).toBe(0);
    expect(effectiveLimit(config, '1', [])).toMatchObject({ amount: 30, unit: 'antworten', period: 'stunde', cooldownSeconds: 8 });
  });

  it('Antworten und Wörter pro Stunde/Tag, Pause', () => {
    const h = 3_600_000;
    const answers = { amount: 2, unit: 'antworten' as const, period: 'stunde' as const, cooldownSeconds: 10 };
    expect(limitCheck([], 0, answers, h)).toBe('ok');
    expect(limitCheck([{ at: h, words: 1 }], h, answers, h + 5000)).toBe('cooldown');
    expect(limitCheck([{ at: 0, words: 1 }, { at: h / 2, words: 1 }], h / 2, answers, h - 1)).toBe('limit');
    expect(limitCheck([{ at: 0, words: 1 }, { at: h / 2, words: 1 }], h / 2, answers, h + 1)).toBe('ok');
    const words = { amount: 100, unit: 'woerter' as const, period: 'tag' as const, cooldownSeconds: 0 };
    expect(limitCheck([{ at: 0, words: 80 }], 0, words, h, 15)).toBe('ok');
    expect(limitCheck([{ at: 0, words: 80 }], 0, words, h, 30)).toBe('limit');
    // die allererste Frage darf auch allein länger sein
    expect(limitCheck([], 0, words, h, 300)).toBe('ok');
    expect(wordCount('Moin  Julia, wie geht’s? 🙂 !!')).toBe(4);
  });
});
