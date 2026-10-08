import type { BotState } from '@moin/shared';

/**
 * Anmeldefehler von Discord einordnen. discord.js liefert je nach Version einen `code`
 * („TokenInvalid“, „DisallowedIntents“) oder nur die Meldung des Gateways
 * („Used disallowed intents“, Close-Code 4014) – beides muss erkannt werden.
 */
export function classifyLoginError(error: unknown): Extract<BotState, 'token-invalid' | 'intents-missing' | 'error'> {
  const { code, message } = (error ?? {}) as { code?: string | number; message?: string };
  const text = String(message ?? '');
  if (code === 'DisallowedIntents' || code === 4014 || /disallowed intents/i.test(text)) return 'intents-missing';
  if (code === 'TokenInvalid' || code === 4004 || /invalid token|authentication failed/i.test(text)) return 'token-invalid';
  return 'error';
}
