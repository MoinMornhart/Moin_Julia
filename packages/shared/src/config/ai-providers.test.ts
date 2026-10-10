import { describe, expect, it } from 'vitest';
import { compatBaseUrl, compatChat, CompatError, compatModels, COMPAT_PROVIDER_IDS, COMPAT_PROVIDERS, isCompatProvider, providerSecretKey } from './ai-providers.js';
import { JULIA_PROVIDERS, parseJuliaConfig } from './julia.js';
import type { FetchLike } from './ollama.js';

type Call = { url: string; init?: Parameters<FetchLike>[1] };

function fakeFetch(status: number, body: unknown, calls: Call[] = []): FetchLike {
  return async (url, init) => {
    calls.push({ url, init });
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return { ok: status < 400, status, json: async () => JSON.parse(text) as unknown, text: async () => text };
  };
}
const target = { baseUrl: 'https://api.example.org/v1', apiKey: 'sk-test', model: 'demo-1', label: 'Testanbieter' };
const never = () => undefined;

describe('Weitere KI-Anbieter (OpenAI-kompatibel)', () => {
  it('alle Anbieter sind als Julia-Anbieter wählbar und haben Adresse + Standardmodell', () => {
    for (const id of COMPAT_PROVIDER_IDS) {
      expect(JULIA_PROVIDERS).toContain(id);
      expect(isCompatProvider(id)).toBe(true);
      if (id !== 'custom') {
        expect(COMPAT_PROVIDERS[id].baseUrl).toMatch(/^https:\/\//);
        expect(COMPAT_PROVIDERS[id].defaultModel).not.toBe('');
      }
    }
    expect(isCompatProvider('anthropic')).toBe(false);
    expect(providerSecretKey('gemini')).toBe('geminiApiKey');
    expect(compatBaseUrl('custom', 'https://mein.de/v1/')).toBe('https://mein.de/v1');
    expect(compatBaseUrl('gemini')).toBe('https://generativelanguage.googleapis.com/v1beta/openai');
  });

  it('Chat: richtige Anfrage (System zuerst, Bearer-Schlüssel), Antwort ohne <think>, Tokens', async () => {
    const calls: Call[] = [];
    const reply = await compatChat(
      target,
      [
        { role: 'system', content: 'Regeln' },
        { role: 'user', content: 'Moin' },
      ],
      fakeFetch(200, { choices: [{ message: { content: '<think>hmm</think> Moin zurück!' } }], usage: { prompt_tokens: 12, completion_tokens: 4 } }, calls),
      never,
    );
    expect(reply).toEqual({ text: 'Moin zurück!', usage: { input: 12, output: 4 } });
    expect(calls[0]!.url).toBe('https://api.example.org/v1/chat/completions');
    expect(calls[0]!.init?.headers?.authorization).toBe('Bearer sk-test');
    const body = JSON.parse(calls[0]!.init!.body!) as { model: string; messages: { role: string }[] };
    expect(body.model).toBe('demo-1');
    expect(body.messages[0]!.role).toBe('system');
  });

  it('Fehler werden verständlich: Schlüssel falsch, Limit, Modell unbekannt, nicht erreichbar', async () => {
    const kind = async (f: FetchLike) => compatChat(target, [], f, never).then(() => 'ok', (e: CompatError) => e.kind);
    expect(await kind(fakeFetch(401, { error: { message: 'bad key' } }))).toBe('auth');
    expect(await kind(fakeFetch(429, { error: { message: 'quota' } }))).toBe('rate');
    expect(await kind(fakeFetch(404, { error: { message: 'model not found' } }))).toBe('model');
    expect(await kind(fakeFetch(400, [{ error: { message: 'model is not supported' } }]))).toBe('model');
    expect(
      await kind(async () => {
        throw new Error('ECONNREFUSED');
      }),
    ).toBe('unreachable');
  });

  it('Modell-Liste: sortiert, ohne Doppelte, Gemini-Präfix „models/“ entfernt', async () => {
    const models = await compatModels(target, fakeFetch(200, { data: [{ id: 'models/gemini-2.5-flash' }, { id: 'b' }, { id: 'a' }, { id: 'b' }] }), never);
    expect(models).toEqual(['a', 'b', 'gemini-2.5-flash']);
  });

  it('Konfiguration: Modell und eigene Adresse werden geprüft', () => {
    expect(parseJuliaConfig({ provider: 'gemini', aiModel: 'gemini-2.5-flash' })).toMatchObject({ provider: 'gemini', aiModel: 'gemini-2.5-flash' });
    expect(parseJuliaConfig({ provider: 'openrouter', aiModel: 'meta-llama/llama-3.3-70b-instruct:free' }).aiModel).toBe('meta-llama/llama-3.3-70b-instruct:free');
    // ungültig → ganze Konfiguration fällt auf sichere Standards zurück
    expect(parseJuliaConfig({ provider: 'gemini', customBaseUrl: 'javascript:alert(1)' }).customBaseUrl).toBe('');
  });
});
