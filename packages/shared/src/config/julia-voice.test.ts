import { describe, expect, it, vi } from 'vitest';
import { juliaVoiceSchema, MAX_SPOKEN_CHARS, speakableText, synthesizeSpeech, VoiceError } from './julia-voice.js';
import { parseJuliaConfig } from './julia.js';

const voice = (patch: Record<string, unknown> = {}) => juliaVoiceSchema.parse({ enabled: true, ...patch });
const ok = (bytes = 200) => ({ ok: true, status: 200, arrayBuffer: async () => new Uint8Array(bytes).buffer }) as unknown as Response;

describe('Julia spricht', () => {
  it('Standard: aus, Piper', () => {
    expect(parseJuliaConfig({}).voice).toEqual({ enabled: false, provider: 'piper', voice: '', speed: 1 });
  });

  it('Text fürs Vorlesen: ohne Markdown, Links, Emojis, Erwähnungen; gekürzt am Satzende', () => {
    expect(speakableText('**Moin!** 😀 Schau hier: https://x.de <@123456789012345678> `code`')).toBe('Moin! Schau hier: code');
    const long = `${'Das ist ein Satz. '.repeat(60)}`;
    const t = speakableText(long);
    expect(t.length).toBeLessThanOrEqual(MAX_SPOKEN_CHARS);
    expect(t.endsWith('.')).toBe(true);
  });

  it('Piper: POST / mit Stimme und Tempo, WAV zurück', async () => {
    const f = vi.fn(async () => ok());
    const r = await synthesizeSpeech({ voice: voice({ speed: 2 }), text: 'Hallo', ttsUrl: 'http://pi:5000/' }, f as never);
    expect(r.mime).toBe('audio/wav');
    const [url, init] = f.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe('http://pi:5000/');
    expect(JSON.parse(init.body)).toEqual({ text: 'Hallo', voice: 'de_DE-kerstin-low', length_scale: 0.5 });
  });

  it('Piper: ältere Fassung ohne POST / → weicht auf /synthesize aus', async () => {
    const f = vi.fn(async (url: string) => (url.endsWith('/synthesize') ? ok() : ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) } as unknown as Response)));
    const r = await synthesizeSpeech({ voice: voice(), text: 'Hallo', ttsUrl: 'http://pi:5000' }, f as never);
    expect(r.mime).toBe('audio/wav');
    expect(f.mock.calls.map((c) => c[0])).toEqual(['http://pi:5000/', 'http://pi:5000/synthesize']);
  });

  it('Piper nicht erreichbar → verständlicher Hinweis', async () => {
    const f = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    await expect(synthesizeSpeech({ voice: voice(), text: 'Hallo' }, f as never)).rejects.toMatchObject({ kind: 'notConfigured', message: expect.stringContaining('http://tts:5000') });
  });

  it('OpenAI: braucht Schlüssel, nimmt bekannte Stimme', async () => {
    await expect(synthesizeSpeech({ voice: voice({ provider: 'openai' }), text: 'Hi' }, vi.fn() as never)).rejects.toBeInstanceOf(VoiceError);
    const f = vi.fn(async () => ok());
    await synthesizeSpeech({ voice: voice({ provider: 'openai', voice: 'onyx' }), text: 'Hi', openaiKey: 'sk-test' }, f as never);
    const [url, init] = f.mock.calls[0] as unknown as [string, { body: string; headers: Record<string, string> }];
    expect(url).toBe('https://api.openai.com/v1/audio/speech');
    expect(init.headers.authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init.body)).toMatchObject({ voice: 'onyx', input: 'Hi' });
  });

  it('ElevenLabs: braucht Schlüssel und Voice-ID; 401 → Schlüssel ungültig', async () => {
    await expect(synthesizeSpeech({ voice: voice({ provider: 'elevenlabs' }), text: 'Hi', elevenlabsKey: 'k' }, vi.fn() as never)).rejects.toMatchObject({ message: expect.stringContaining('Voice-ID') });
    const f = vi.fn(async () => ({ ok: false, status: 401 }) as Response);
    await expect(synthesizeSpeech({ voice: voice({ provider: 'elevenlabs', voice: 'abc' }), text: 'Hi', elevenlabsKey: 'k' }, f as never)).rejects.toMatchObject({ kind: 'notConfigured', message: expect.stringContaining('Schlüssel ungültig') });
  });
});
