import { describe, expect, it } from 'vitest';
import { actionAllowed, actionsPrompt, channelSlug, describeAction, extractActions, MAX_TIMEOUT_MINUTES, toolsFor } from './julia-tools.js';
import { parseJuliaConfig } from './julia.js';

const MAX = '100000000000000301';

describe('Julia-Werkzeuge', () => {
  it('Standard: aus; ohne Discord-Recht kein Werkzeug', () => {
    const c = parseJuliaConfig({});
    expect(c.tools).toEqual({ enabled: false, allowed: ['dm', 'timeout', 'kanal', 'rolle'] });
    expect(toolsFor(c.tools, () => true)).toEqual([]);
    const on = { enabled: true, allowed: ['dm', 'timeout', 'kanal'] as const };
    expect(toolsFor({ ...on, allowed: [...on.allowed] }, (p) => p === 'ManageChannels')).toEqual(['kanal']);
    expect(toolsFor({ enabled: true, allowed: ['timeout'] }, () => true)).toEqual(['timeout']);
  });

  it('Markierungen werden erkannt und aus dem Text entfernt', () => {
    const r = extractActions(`Mach ich!\n[[aktion: timeout | <@${MAX}> | 10 | spammt]]\n[[aktion: dm | ${MAX} | Bitte ruhiger @everyone]]\n[[aktion: kanal | Neue Runde! | text]]`);
    expect(r.text).toBe('Mach ich!');
    expect(r.actions).toEqual([
      { kind: 'timeout', userId: MAX, minutes: 10, reason: 'spammt' },
      { kind: 'dm', userId: MAX, text: 'Bitte ruhiger @​everyone' },
      { kind: 'kanal', name: 'neue-runde', voice: false },
    ]);
  });

  it('Unsinn wird verworfen, Grenzen eingehalten', () => {
    expect(extractActions('[[aktion: timeout | keine-id | 10]] [[aktion: dm | 123 | x]] [[aktion: bann | 1]]').actions).toEqual([]);
    expect(extractActions(`[[aktion: timeout | ${MAX} | 999999]]`).actions[0]).toMatchObject({ minutes: MAX_TIMEOUT_MINUTES });
    expect(extractActions(`[[aktion: kanal | 🎮 Zocken | sprache]]`).actions[0]).toEqual({ kind: 'kanal', name: '🎮 Zocken', voice: true });
    expect(extractActions('[[aktion: kanal | x]] '.repeat(5)).actions).toHaveLength(3);
    expect(channelSlug('  Ärger & Co.  ')).toBe('ärger-co');
  });

  it('nur erlaubte Werkzeuge und nur erwähnte Personen', () => {
    const t = { kind: 'timeout', userId: MAX, minutes: 5, reason: '' } as const;
    expect(actionAllowed(t, ['timeout'], [MAX])).toBe(true);
    expect(actionAllowed(t, ['timeout'], [])).toBe(false);
    expect(actionAllowed(t, ['dm'], [MAX])).toBe(false);
    expect(actionAllowed({ kind: 'kanal', name: 'x', voice: false }, ['kanal'], [])).toBe(true);
  });

  it('Prompt nur mit Werkzeugen; Beschreibung lesbar', () => {
    expect(actionsPrompt([], [])).toBe('');
    const p = actionsPrompt(['timeout'], [{ id: MAX, name: 'Max' }]);
    expect(p).toContain('[[aktion: timeout | <ID> | Minuten | Grund]]');
    expect(p).toContain(`Max = ${MAX}`);
    expect(p).not.toContain('aktion: dm');
    expect(describeAction({ kind: 'timeout', userId: MAX, minutes: 120, reason: 'Spam' })).toBe(`⏳ Timeout für <@${MAX}>: 2 Stunde(n) – Grund: Spam`);
  });
});

describe('Julia-Werkzeug „Rolle anlegen“', () => {
  it('liest Name, Rechte-Paket und Farbe', () => {
    const { actions } = extractActions('Mach ich! [[aktion: rolle | 🛡️ Team | mod | #2FD1B8]] [[aktion: rolle | Owner | Besitzer]] [[aktion: rolle | @VIP]]');
    expect(actions).toEqual([
      { kind: 'rolle', name: '🛡️ Team', rights: 'mod', color: 0x2fd1b8 },
      { kind: 'rolle', name: 'Owner', rights: 'admin', color: null },
      { kind: 'rolle', name: 'VIP', rights: 'keine', color: null },
    ]);
  });
  it('Administrator nur vorschlagen, wenn die Person darf', () => {
    const admin = { kind: 'rolle' as const, name: 'Owner', rights: 'admin' as const, color: null };
    expect(actionAllowed(admin, ['rolle'], [])).toBe(false);
    expect(actionAllowed(admin, ['rolle'], [], { canAdmin: true })).toBe(true);
    expect(actionAllowed({ ...admin, rights: 'mod' }, ['rolle'], [])).toBe(true);
    expect(actionsPrompt(['rolle'], [], false)).toContain('nur auf Bitte des Server-Owners');
    expect(actionsPrompt(['rolle'], [], true)).toContain('admin = Administrator');
    expect(describeAction(admin)).toContain('Administrator');
  });
});
