import { describe, expect, it } from 'vitest';
import { fuzzyScore, levenshtein, queryVariants, rankByName, wordsMatch } from './fuzzy.js';

describe('Tippfehler-tolerante Suche', () => {
  it('Levenshtein', () => {
    expect(levenshtein('antenne', 'antene')).toBe(1);
    expect(levenshtein('sido', 'sido')).toBe(0);
    expect(levenshtein('', 'abc')).toBe(3);
  });

  it('Wörter mit Tippfehlern passen, kurze Wörter müssen exakt sein', () => {
    expect(wordsMatch('antene', 'antenne')).toBe(true);
    expect(wordsMatch('bayer', 'bayern')).toBe(true);
    expect(wordsMatch('1liev', '1live')).toBe(true);
    expect(wordsMatch('rap', 'pop')).toBe(false);
    expect(wordsMatch('rock', 'radio')).toBe(false);
  });

  it('Score und Sortierung', () => {
    expect(fuzzyScore('antene bayern', 'ANTENNE BAYERN')).toBe(1);
    expect(fuzzyScore('antene bayern', 'Bayern 3')).toBe(0.5);
    const stations = ['Bayern 3', 'ANTENNE BAYERN', 'Radio Paloma'];
    expect(rankByName('antene bayern', stations, (s) => s)).toEqual(['ANTENNE BAYERN', 'Bayern 3']);
  });

  it('Ersatz-Begriffe für die Suche', () => {
    expect(queryVariants('antene bayern')).toEqual(['antenebayern', 'antene', 'ante', 'bayern']);
    expect(queryVariants('1liev')).toEqual(['1lie']);
  });
});
