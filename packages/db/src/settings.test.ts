import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, isSetupComplete, maskSecret } from './settings.js';

const key = createHash('sha256').update('test').digest();

describe('Verschlüsselung der Geheimnisse', () => {
  it('ver- und entschlüsselt verlustfrei, jedes Mal anders', () => {
    const a = encryptSecret('MTIz.geheimer.token', key);
    const b = encryptSecret('MTIz.geheimer.token', key);
    expect(a).not.toBe(b);
    expect(a.startsWith('v1:')).toBe(true);
    expect(a).not.toContain('geheimer');
    expect(decryptSecret(a, key)).toBe('MTIz.geheimer.token');
  });

  it('erkennt Manipulation und falschen Schlüssel', () => {
    const stored = encryptSecret('wert', key);
    const parts = stored.split(':');
    parts[3] = Buffer.from('anders').toString('base64');
    expect(() => decryptSecret(parts.join(':'), key)).toThrow();
    expect(() => decryptSecret(stored, createHash('sha256').update('falsch').digest())).toThrow();
  });

  it('Einrichtung vollständig nur mit Token, ID und Secret', () => {
    const empty = {
      discordToken: null, discordClientId: null, discordClientSecret: null, dashboardUrl: null, anthropicApiKey: null,
      twitchClientId: null, twitchClientSecret: null, youtubeApiKey: null, instanceOwnerId: null,
    };
    expect(isSetupComplete(empty)).toBe(false);
    expect(isSetupComplete({ ...empty, discordToken: 'a', discordClientId: '1' })).toBe(false);
    expect(isSetupComplete({ ...empty, discordToken: 'a', discordClientId: '1', discordClientSecret: 's' })).toBe(true);
  });

  it('maskiert für die Anzeige', () => {
    expect(maskSecret('abcdefgh1234')).toBe('••••••1234');
    expect(maskSecret(null)).toBeNull();
  });
});
