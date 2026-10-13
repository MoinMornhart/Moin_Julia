import { describe, expect, it, vi } from 'vitest';
import { VoiceError } from '@moin/shared';
import type { BotContext } from '../../core/types.js';

const connections = new Map<string, unknown>();
vi.mock('@discordjs/voice', async (orig) => ({ ...(await orig<typeof import('@discordjs/voice')>()), getVoiceConnection: (id: string) => connections.get(id) }));
const { speak } = await import('./voice.js');

const G = '100000000000000001';
const bot = { logger: { warn: vi.fn() } } as unknown as BotContext;
const voice = { enabled: true, provider: 'piper' as const, voice: '', speed: 1 };
const channel = { id: 'vc', guild: { id: G } } as never;

describe('Julia spricht im Sprachkanal', () => {
  it('spricht: Audio erzeugen und abspielen', async () => {
    const deps = { synthesize: vi.fn(async () => Buffer.from('x')), playOnce: vi.fn(async () => 'spoken' as const) };
    expect(await speak(bot, G, channel, voice, 'Moin', deps)).toBe('spoken');
    expect(deps.synthesize).toHaveBeenCalledWith(bot, G, voice, 'Moin');
  });

  it('ohne Sprachkanal / Bot schon im Sprachkanal (Musik) → nicht dazwischen', async () => {
    const deps = { synthesize: vi.fn(), playOnce: vi.fn() };
    expect(await speak(bot, G, null, voice, 'Moin', deps as never)).toBe('noVoice');
    connections.set(G, {});
    expect(await speak(bot, G, channel, voice, 'Moin', deps as never)).toBe('busy');
    connections.delete(G);
    expect(deps.synthesize).not.toHaveBeenCalled();
  });

  it('nicht eingerichtet vs. Fehler werden unterschieden', async () => {
    const notConfigured = { synthesize: vi.fn(async () => Promise.reject(new VoiceError('notConfigured', 'Piper fehlt'))), playOnce: vi.fn() };
    expect(await speak(bot, G, channel, voice, 'Moin', notConfigured as never)).toBe('notConfigured');
    const failed = { synthesize: vi.fn(async () => Promise.reject(new Error('kaputt'))), playOnce: vi.fn() };
    expect(await speak(bot, G, channel, voice, 'Moin', failed as never)).toBe('failed');
  });
});
