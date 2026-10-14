import { describe, expect, it } from 'vitest';
import { MODULES } from '../modules.js';
import { moduleLabel, MODULE_DUMMIES } from './dashboard-dummies.js';

describe('Dashboard „Für Dummies“', () => {
  it('jedes Modul hat einen einfachen Namen und eine einfache Erklärung', () => {
    for (const m of MODULES) {
      expect(MODULE_DUMMIES[m.id], m.id).toBeDefined();
      expect(MODULE_DUMMIES[m.id]!.description.length).toBeGreaterThan(10);
    }
  });
  it('aus = normal, an = einfach', () => {
    const mod = MODULES.find((m) => m.id === 'moderation')!;
    expect(moduleLabel(mod, false).name).toBe('Moderation');
    expect(moduleLabel(mod, true).name).toBe('Schiedsrichter');
  });
});

describe('Fachwörter in den Bereichen', () => {
  it('ersetzt ganze Wörter, zusammengesetzte zuerst', async () => {
    const { simplifyText } = await import('./dashboard-dummies.js');
    expect(simplifyText('Log-Kanal für Verwarnungen und Timeouts')).toBe('Tagebuch-Raum für Gelbe Karten und Auszeiten');
    expect(simplifyText('Rollen, die Admins vergeben dürfen')).toBe('Namensplaketten, die Chefs vergeben dürfen');
    expect(simplifyText('Sprachkanal und Kanäle')).toBe('Sprech-Raum und Räume');
    // Teile anderer Wörter bleiben
    expect(simplifyText('Kanalisation, Administration, Rollenspiel')).toBe('Kanalisation, Administration, Rollenspiel');
  });
});

describe('Für 1 IQ und weniger', () => {
  it('ganze Überschriften werden Baby-Sprache', async () => {
    const { simplifyText } = await import('./dashboard-dummies.js');
    expect(simplifyText('Mitgliederzahl')).toBe('👥 So viele Leute sind da');
    expect(simplifyText(' Nachrichten pro Tag ')).toBe(' 💬 So viel wurde geschrieben ');
    expect(simplifyText('Sprachminuten pro Tag')).toBe('🎤 So lange wurde gequatscht');
    expect(simplifyText('-1 % zum Zeitraum davor')).toBe('📉 1 % weniger als vorher');
    expect(simplifyText('+2 % zum Zeitraum davor')).toBe('📈 2 % mehr als vorher');
    expect(simplifyText('+113 im Zeitraum')).toBe('+113 in der Zeit');
    expect(simplifyText('👥 Mitgliederzahl')).toBe('👥 So viele Leute sind da');
    expect(simplifyText('🎙️ Sprachminuten pro Tag')).toBe('🎤 So lange wurde gequatscht');
  });
  it('zweimal umschreiben ändert nichts mehr (sonst würde die Seite endlos wachsen)', async () => {
    const { simplifyText, PHRASE_DUMMIES, TERM_DUMMIES } = await import('./dashboard-dummies.js');
    const samples = [...Object.keys(PHRASE_DUMMIES), ...TERM_DUMMIES.map(([from]) => `Der ${from} hier`), '144 rein · 30 raus', '-1 % zum Zeitraum davor'];
    for (const s of samples) {
      const once = simplifyText(s);
      expect(simplifyText(once), s).toBe(once);
    }
  });
});
