import { describe, expect, it } from 'vitest';
import { findInsult, normalizeInsultText } from './julia-insults.js';
import { parseJuliaConfig } from './julia.js';

describe('Julia: Beleidigungs-Schutz', () => {
  it('Standard: aus', () => {
    expect(parseJuliaConfig({}).insultGuard).toEqual({ enabled: false, deleteMessage: true, logChannelId: '', extraWords: '' });
  });

  it('erkennt Beleidigungen – auch verschleiert', () => {
    expect(findInsult('Julia du Idiot')).toBe('idiot');
    expect(findInsult('du 1d10t!!')).toBe('idiot');
    expect(findInsult('IDIOOOOT')).toBe('idiot');
    expect(findInsult('halt die Fresse, Bot')).toBe('halt die fresse');
    expect(findInsult('Du bist scheiße')).toBe('du bist scheiße');
    expect(findInsult('you suck julia')).toBe('you suck');
  });

  it('keine Fehlalarme bei Alltagswörtern und Wortteilen', () => {
    expect(findInsult('Das war eine dumme Frage von mir, sorry')).toBeNull();
    expect(findInsult('Der Idiotentest ist schwer')).toBeNull();
    expect(findInsult('Arschbombe ins Wasser!')).toBeNull();
    expect(findInsult('Moin Julia, wie geht es dir?')).toBeNull();
  });

  it('eigene Wörter des Servers', () => {
    expect(findInsult('du Lappen', 'Lappen, Pfeife')).toBe('Lappen');
    expect(findInsult('du Lappen')).toBeNull();
    expect(normalizeInsultText('Sch€iß-B0T!!!')).toBe('sch iss bot');
  });
});
