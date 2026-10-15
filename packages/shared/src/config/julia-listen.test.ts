import { describe, expect, it, vi } from 'vitest';
import { afterWakeWord, pcmDurationMs, pcmToWav16kMono, SttError, transcribeSpeech } from './julia-listen.js';

describe('Mit Julia im Call reden', () => {
  it('reagiert nur auf Sätze, die mit „Julia“ beginnen', () => {
    expect(afterWakeWord('Julia, wie wird das Wetter morgen?')).toBe('wie wird das Wetter morgen?');
    expect(afterWakeWord('Hey Julia was ist 2 plus 2')).toBe('was ist 2 plus 2');
    expect(afterWakeWord('Julie erzähl einen Witz')).toBe('erzähl einen Witz');
    expect(afterWakeWord('und dann hat Julia gesagt, dass')).toBeNull();
    expect(afterWakeWord('Was machst du heute?')).toBeNull();
    expect(afterWakeWord('Julia')).toBeNull();
  });

  it('48 kHz Stereo → 16 kHz Mono WAV', () => {
    const frames = 4800; // 0,1 s
    const pcm = new Uint8Array(frames * 4);
    const v = new DataView(pcm.buffer);
    for (let i = 0; i < frames; i++) {
      v.setInt16(i * 4, 1000, true);
      v.setInt16(i * 4 + 2, 3000, true);
    }
    expect(pcmDurationMs(pcm.length)).toBe(100);
    const wav = pcmToWav16kMono(pcm);
    const w = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
    expect(w.getUint32(24, true)).toBe(16000);
    expect(w.getUint16(22, true)).toBe(1);
    expect(wav.length).toBe(44 + 1600 * 2);
    expect(w.getInt16(44, true)).toBe(2000); // Mittel aus beiden Kanälen
  });

  it('Spracherkennung lokal oder OpenAI', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ text: ' Julia hallo ' }) }));
    expect(await transcribeSpeech({ wav: new Uint8Array(10), provider: 'lokal', sttUrl: 'http://stt:8000/' }, f)).toBe('Julia hallo');
    const [url, init] = f.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: Uint8Array }];
    expect(url).toBe('http://stt:8000/v1/audio/transcriptions');
    expect(init.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
    await expect(transcribeSpeech({ wav: new Uint8Array(10), provider: 'openai' }, f)).rejects.toBeInstanceOf(SttError);
    const down = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    await expect(transcribeSpeech({ wav: new Uint8Array(10), provider: 'lokal' }, down)).rejects.toMatchObject({ kind: 'notConfigured', message: expect.stringContaining('COMPOSE_PROFILES') });
  });
});

describe('Weckwort – Runde 3', () => {
  it('reagiert nicht auf ähnliche Namen', () => {
    expect(afterWakeWord('Julian, komm mal her')).toBeNull();
    expect(afterWakeWord('Julias Katze ist süß')).toBeNull();
  });
  it('überspringt „ähm“/„äh“ vor dem Weckwort', () => {
    expect(afterWakeWord('Ähm Julia, wie spät ist es?')).toBe('wie spät ist es?');
    expect(afterWakeWord('äh julia was geht')).toBe('was geht');
  });
});

describe('Issue #10: „Julia“ … Pause … Frage, Spracherkennung prüfen', () => {
  it('nur das Weckwort erkannt', async () => {
    const { isOnlyWakeWord } = await import('./julia-listen.js');
    expect(isOnlyWakeWord('Julia?')).toBe(true);
    expect(isOnlyWakeWord('Hey Julia.')).toBe(true);
    expect(isOnlyWakeWord('Julia, wie spät ist es?')).toBe(false);
    expect(isOnlyWakeWord('Wie spät ist es?')).toBe(false);
  });
  it('sttProblem: lokal per /health (GET ohne body), OpenAI braucht Schlüssel', async () => {
    const { sttProblem } = await import('./julia-listen.js');
    const calls: { url: string; init: { method: string; body?: unknown } }[] = [];
    const ok = vi.fn(async (url: string, init: { method: string; body?: unknown }) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({}) };
    });
    expect(await sttProblem({ provider: 'lokal', sttUrl: 'http://stt:8000/' }, ok)).toBeNull();
    expect(calls[0]).toMatchObject({ url: 'http://stt:8000/health', init: { method: 'GET' } });
    expect(calls[0]!.init.body).toBeUndefined();
    const down = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    expect(await sttProblem({ provider: 'lokal' }, down)).toContain('COMPOSE_PROFILES');
    expect(await sttProblem({ provider: 'openai' }, ok)).toContain('OpenAI-Schlüssel');
    expect(await sttProblem({ provider: 'openai', openaiKey: 'sk' }, ok)).toBeNull();
  });
});
