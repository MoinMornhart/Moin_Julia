import { describe, expect, it } from 'vitest';
import { coerceSetting, dashboardGuide, dashboardLink, settingFields, settingsToolPrompt, wantsDashboardHelp } from './julia-dashboard.js';
import { actionAllowed, describeAction, extractActions } from './julia-tools.js';

describe('Julia kennt das Dashboard', () => {
  it('erkennt Fragen nach Einstellungen', () => {
    expect(wantsDashboardHelp('Wo stelle ich den Willkommenstext ein?')).toBe(true);
    expect(wantsDashboardHelp('mach die Musik-Lautstärke auf 50')).toBe(true);
    expect(wantsDashboardHelp('schalte Level aus')).toBe(true);
    expect(wantsDashboardHelp('Wie geht es dir?')).toBe(false);
  });

  it('Wegweiser mit Links zum Server', () => {
    expect(dashboardLink('https://dash.example.org/', '123', 'musik')).toBe('https://dash.example.org/g/123/musik');
    expect(dashboardLink(null, '123')).toBeNull();
    const guide = dashboardGuide('https://dash.example.org', '123');
    expect(guide).toContain('https://dash.example.org/g/123/willkommen');
    expect(guide).toContain('https://dash.example.org/g/123/raenge');
  });

  it('einfache Felder und Werte', () => {
    expect(settingFields({ volume: 50, autoplay: true, name: 'x', list: [1], obj: {} })).toEqual([
      { key: 'volume', type: 'number' },
      { key: 'autoplay', type: 'boolean' },
      { key: 'name', type: 'string' },
    ]);
    expect(coerceSetting('boolean', 'an')).toBe(true);
    expect(coerceSetting('boolean', 'aus')).toBe(false);
    expect(coerceSetting('boolean', 'vielleicht')).toBeNull();
    expect(coerceSetting('number', '50%')).toBe(50);
    expect(coerceSetting('number', 'viel')).toBeNull();
    expect(settingsToolPrompt([{ moduleId: 'musik', enabled: true, fields: [{ key: 'defaultVolume', type: 'number' }] }])).toContain('musik (an): defaultVolume=Zahl');
  });

  it('Markierung lesen; nur mit Erlaubnis', () => {
    const { actions } = extractActions('Klar! [[aktion: einstellung | Level | aus]] [[aktion: einstellung | musik | defaultVolume | 50]]');
    expect(actions).toEqual([
      { kind: 'einstellung', moduleId: 'level', field: null, value: 'aus' },
      { kind: 'einstellung', moduleId: 'musik', field: 'defaultVolume', value: '50' },
    ]);
    expect(actionAllowed(actions[0]!, [], [], {})).toBe(false);
    expect(actionAllowed(actions[0]!, [], [], { canConfigure: true })).toBe(true);
    expect(describeAction(actions[0]!)).toContain('ausschalten');
    expect(describeAction(actions[1]!)).toContain('defaultVolume = 50');
  });
});
