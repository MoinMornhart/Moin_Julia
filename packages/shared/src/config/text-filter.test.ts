import { describe, expect, it } from 'vitest';
import { countEmojis, countLines, duplicateKey, findFilterWord, normalizeForFilter } from './text-filter.js';

describe('Text-Filter', () => {
  it('vereinheitlicht Schreibweisen', () => {
    expect(normalizeForFilter('i d i o t')).toBe('idiot');
    expect(normalizeForFilter('i.d.i.o.t!')).toBe('idiot');
    expect(normalizeForFilter('Du 1D10T')).toBe('du idiot');
    expect(normalizeForFilter('ja a b')).toBe('ja a b');
  });

  it('findet ganze Wörter, auch verschleiert', () => {
    expect(findFilterWord('du bist ein i-d-i-o-t', ['idiot'])).toBe('idiot');
    expect(findFilterWord('Idiotentest', ['idiot'])).toBeNull();
  });

  it('zählt Emojis, Zeilen, erkennt gleiche Nachrichten', () => {
    expect(countEmojis('hi 😀😀 <:moin:123456789012345678> <a:tanz:123456789012345678>')).toBe(4);
    expect(countLines('a\nb\nc')).toBe(3);
    expect(duplicateKey('Kauft bei mir!!')).toBe(duplicateKey('KAUFT bei mir'));
    expect(duplicateKey('ok')).toBeNull();
  });
});
