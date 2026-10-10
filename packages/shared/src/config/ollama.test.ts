import { describe, expect, it } from 'vitest';
import {
  cleanOllamaText,
  hasOllamaModel,
  ollamaBaseUrl,
  ollamaChat,
  ollamaChatBody,
  OllamaError,
  ollamaModels,
  parseOllamaEndpoints,
  publicOllamaEndpoint,
  resolveOllama,
  type FetchLike,
  type OllamaEndpoint,
} from './ollama.js';

const ep = (patch: Partial<OllamaEndpoint> = {}): OllamaEndpoint => ({ id: 'olocal', name: 'Lokal', url: 'http://192.168.1.20:11434', model: 'llama3.2', apiKey: '', keepAlive: '30m', numCtx: 0, think: 'auto', ...patch });

/** Kleiner Ollama-Nachbau: merkt sich Anfragen, antwortet je nach Pfad */
function fakeOllama(handler: (url: string, body: Record<string, unknown> | null, headers: Record<string, string>) => { status: number; body: unknown }) {
  const calls: { url: string; body: Record<string, unknown> | null; headers: Record<string, string> }[] = [];
  const f: FetchLike = async (url, init) => {
    const body = init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    const headers = init?.headers ?? {};
    calls.push({ url, body, headers });
    const r = handler(url, body, headers);
    const text = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => JSON.parse(text), text: async () => text };
  };
  return { f, calls };
}
const timeout = () => undefined;

describe('Ollama-Endpunkte', () => {
  it('liest gespeicherte Endpunkte, übernimmt die alte Einzel-Einstellung, verwirft kaputte Einträge', () => {
    expect(parseOllamaEndpoints(null, { url: 'http://10.0.0.5:11434', model: 'qwen3:8b' })).toEqual([expect.objectContaining({ id: 'standard', name: 'Standard', model: 'qwen3:8b', keepAlive: '30m' })]);
    const json = JSON.stringify([ep(), { id: 'x', name: '', url: 'ftp://x' }, ep({ id: 'ocloud', name: 'Cloud', url: 'https://ollama.com', apiKey: 'geheim' })]);
    expect(parseOllamaEndpoints(json, { url: 'http://alt:11434', model: 'alt' }).map((e) => e.id)).toEqual(['olocal', 'ocloud']);
    expect(parseOllamaEndpoints('kaputt{', null as never)).toEqual([]);
  });

  it('wählt den Endpunkt des Servers (sonst den ersten) und das Modell des Modus', () => {
    const list = [ep(), ep({ id: 'ogpu', name: 'GPU', model: 'qwen3:8b' })];
    expect(resolveOllama(list, 'ogpu')).toMatchObject({ endpoint: { id: 'ogpu' }, model: 'qwen3:8b' });
    expect(resolveOllama(list, 'gibtsnicht')?.endpoint.id).toBe('olocal');
    expect(resolveOllama(list, '', 'mistral')?.model).toBe('mistral');
    expect(resolveOllama([], '')).toBeNull();
  });

  it('der Schlüssel landet nie im Browser', () => {
    const pub = publicOllamaEndpoint(ep({ apiKey: 'sk-geheim' }));
    expect(pub).not.toHaveProperty('apiKey');
    expect(pub.hasKey).toBe(true);
  });

  it('Adresse: Schrägstrich und /api am Ende werden entfernt, Pfad eines Proxys bleibt', () => {
    expect(ollamaBaseUrl('http://x:11434/')).toBe('http://x:11434');
    expect(ollamaBaseUrl('https://ki.example.de/ollama/api')).toBe('https://ki.example.de/ollama');
  });

  it('Anfrage: keep_alive als Text oder Zahl, Kontextgröße nur wenn gesetzt, Denk-Modus nur wenn nicht „auto“', () => {
    expect(ollamaChatBody(ep(), 'llama3.2', [])).toEqual({ model: 'llama3.2', messages: [], stream: false, keep_alive: '30m', options: { num_predict: 800 } });
    const b = ollamaChatBody(ep({ keepAlive: '-1', numCtx: 16384, think: 'aus' }), 'qwen3:8b', []);
    expect(b).toMatchObject({ keep_alive: -1, options: { num_ctx: 16384 }, think: false });
    expect(ollamaChatBody(ep({ think: 'high' }), 'gpt-oss:20b', []).think).toBe('high');
    expect(ollamaChatBody(ep({ think: 'an' }), 'm', [], false)).not.toHaveProperty('think');
  });

  it('Antworttext ohne Nachdenken, auch wenn abgeschnitten', () => {
    expect(cleanOllamaText('<think>hmm</think>Moin!')).toBe('Moin!');
    expect(cleanOllamaText('Moin!<think>noch am Überlegen')).toBe('Moin!');
  });

  it('Chat: API-Schlüssel als Bearer, Verbrauch, Proxy-Pfad', async () => {
    const { f, calls } = fakeOllama(() => ({ status: 200, body: { message: { content: '<think>x</think>Moin aus der Cloud' }, prompt_eval_count: 12, eval_count: 5 } }));
    const reply = await ollamaChat(ep({ url: 'https://ollama.com/', apiKey: 'k123' }), 'gpt-oss:120b', [{ role: 'user', content: 'Hi' }], f, timeout);
    expect(reply).toEqual({ text: 'Moin aus der Cloud', usage: { input: 12, output: 5 } });
    expect(calls[0]!.url).toBe('https://ollama.com/api/chat');
    expect(calls[0]!.headers.authorization).toBe('Bearer k123');
  });

  it('Chat: Modell ohne Denk-Modus → automatisch ohne wiederholen', async () => {
    const { f, calls } = fakeOllama((_u, body) => (body && 'think' in body ? { status: 400, body: { error: '"llama3.2" does not support thinking' } } : { status: 200, body: { message: { content: 'Ok' } } }));
    expect((await ollamaChat(ep({ think: 'an' }), 'llama3.2', [], f, timeout)).text).toBe('Ok');
    expect(calls).toHaveLength(2);
  });

  it('Chat: verständliche Fehler (Schlüssel, Modell fehlt, falscher Pfad, kein Ollama, nicht erreichbar)', async () => {
    const run = async (status: number, body: unknown) => {
      const { f } = fakeOllama(() => ({ status, body }));
      return ollamaChat(ep(), 'llama3.2', [], f, timeout).catch((e: unknown) => e as OllamaError);
    };
    expect(await run(401, { error: 'unauthorized' })).toMatchObject({ kind: 'auth' });
    expect(await run(404, { error: 'model "llama3.2" not found, try pulling it first' })).toMatchObject({ kind: 'model' });
    expect(await run(404, '<html>Not here</html>')).toMatchObject({ kind: 'unreachable', message: expect.stringContaining('Proxy') });
    expect(await run(200, '<html>Login</html>')).toMatchObject({ kind: 'other', message: expect.stringContaining('kein Ollama') });
    const down: FetchLike = async () => {
      throw new Error('ECONNREFUSED');
    };
    expect(await ollamaChat(ep(), 'm', [], down, timeout).catch((e: unknown) => e)).toMatchObject({ kind: 'unreachable' });
  });

  it('Modelle und Version abrufen; „llama3.2“ passt nur zu llama3.2(:latest)', async () => {
    const { f } = fakeOllama((url) => (url.endsWith('/api/tags') ? { status: 200, body: { models: [{ name: 'llama3.2:latest' }, { name: 'qwen3:8b' }] } } : { status: 200, body: { version: '0.12.3' } }));
    expect(await ollamaModels(ep(), f, timeout)).toEqual({ models: ['llama3.2:latest', 'qwen3:8b'], version: '0.12.3' });
    expect(hasOllamaModel(['llama3.2:latest'], 'llama3.2')).toBe(true);
    expect(hasOllamaModel(['llama3.2:1b'], 'llama3.2')).toBe(false);
    expect(hasOllamaModel(['qwen3:8b'], 'qwen3:8b')).toBe(true);
  });
});
