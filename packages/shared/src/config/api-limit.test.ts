import { describe, expect, it } from 'vitest';
import { apiLimitMicroUsd, apiLimitPercent, apiLimitReached, eurText, parseApiLimitEur, USD_PER_EUR } from './api-limit.js';

describe('API-Kostenlimit (Wunsch Philip, 15.10.)', () => {
  it('Eingabe: Euro mit Komma oder Punkt, leer/0 = kein Limit', () => {
    expect(parseApiLimitEur('80')).toBe(80);
    expect(parseApiLimitEur('12,5')).toBe(12.5);
    expect(parseApiLimitEur('')).toBe(0);
    expect(parseApiLimitEur('-3')).toBe(0);
    expect(parseApiLimitEur('abc')).toBe(0);
  });
  it('80 € → Grenze in Dollar, erreicht ab genau der Grenze', () => {
    const limit = apiLimitMicroUsd(80);
    expect(limit).toBe(Math.round(80 * USD_PER_EUR * 1_000_000));
    expect(apiLimitReached(limit - 1, 80)).toBe(false);
    expect(apiLimitReached(limit, 80)).toBe(true);
    expect(apiLimitReached(10 ** 12, 0)).toBe(false);
    expect(apiLimitPercent(limit / 2, 80)).toBe(50);
  });
  it('Anzeige in Euro', () => {
    expect(eurText(apiLimitMicroUsd(80))).toBe('80,00 €');
  });
});
