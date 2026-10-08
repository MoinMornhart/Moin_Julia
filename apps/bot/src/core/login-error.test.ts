import { describe, expect, it } from 'vitest';
import { classifyLoginError } from './login-error.js';

describe('Anmeldefehler einordnen', () => {
  it('erkennt fehlende Intents auch ohne Code (Meldung aus @discordjs/ws, wie bei Philip)', () => {
    expect(classifyLoginError(new Error('Used disallowed intents'))).toBe('intents-missing');
    expect(classifyLoginError(Object.assign(new Error('x'), { code: 'DisallowedIntents' }))).toBe('intents-missing');
    expect(classifyLoginError({ code: 4014 })).toBe('intents-missing');
  });

  it('erkennt einen ungültigen Token', () => {
    expect(classifyLoginError(Object.assign(new Error('An invalid token was provided.'), { code: 'TokenInvalid' }))).toBe('token-invalid');
    expect(classifyLoginError(new Error('Authentication failed'))).toBe('token-invalid');
  });

  it('alles andere ist ein allgemeiner Fehler', () => {
    expect(classifyLoginError(new Error('getaddrinfo ENOTFOUND discord.com'))).toBe('error');
    expect(classifyLoginError(undefined)).toBe('error');
  });
});
