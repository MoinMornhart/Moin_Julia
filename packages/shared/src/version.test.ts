import { describe, expect, it } from 'vitest';
import { isNewerVersion } from './version.js';

describe('Versionsvergleich für den Update-Hinweis', () => {
  it('vergleicht Zahlen, nicht Text', () => {
    expect(isNewerVersion('0.8.10', '0.8.9')).toBe(true);
    expect(isNewerVersion('0.9.0', '0.8.12')).toBe(true);
    expect(isNewerVersion('1.0', '0.99.99')).toBe(true);
  });
  it('gleich oder älter ist kein Update', () => {
    expect(isNewerVersion('0.8.3', '0.8.3')).toBe(false);
    expect(isNewerVersion('0.8.2', '0.8.3')).toBe(false);
    expect(isNewerVersion('v0.8.3', '0.8.3')).toBe(false);
  });
  it('unbekannte Formate lösen keinen Fehlalarm aus', () => {
    expect(isNewerVersion('dev', '0.8.3')).toBe(false);
    expect(isNewerVersion('<html>', '0.8.3')).toBe(false);
  });
});
