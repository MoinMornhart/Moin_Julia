import type { FetchLike } from './ollama.js';

/**
 * Weitere KI-Anbieter für Julia. Alle sprechen die OpenAI-kompatible Schnittstelle
 * (POST {baseUrl}/chat/completions, GET {baseUrl}/models) – auch Google Gemini über seinen
 * OpenAI-Zugang. Darum reicht eine Umsetzung für alle.
 * Standard-Modelle sind nur ein Startwert: „Modelle laden“ holt die echte Liste beim Anbieter.
 */
export const COMPAT_PROVIDERS = {
  gemini: { label: 'Google Gemini', icon: '✨', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.5-flash', keyUrl: 'https://aistudio.google.com/apikey', keyHint: 'AIza…' },
  openai: { label: 'OpenAI (ChatGPT)', icon: '🟢', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4.1-mini', keyUrl: 'https://platform.openai.com/api-keys', keyHint: 'sk-…' },
  openrouter: { label: 'OpenRouter', icon: '🔀', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'openrouter/auto', keyUrl: 'https://openrouter.ai/keys', keyHint: 'sk-or-…' },
  groq: { label: 'Groq', icon: '⚡', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile', keyUrl: 'https://console.groq.com/keys', keyHint: 'gsk_…' },
  mistral: { label: 'Mistral', icon: '🌬️', baseUrl: 'https://api.mistral.ai/v1', defaultModel: 'mistral-small-latest', keyUrl: 'https://console.mistral.ai/api-keys', keyHint: '' },
  xai: { label: 'xAI (Grok)', icon: '✖️', baseUrl: 'https://api.x.ai/v1', defaultModel: 'grok-3-mini', keyUrl: 'https://console.x.ai', keyHint: 'xai-…' },
  custom: { label: 'Eigene Adresse (OpenAI-kompatibel)', icon: '🛠️', baseUrl: '', defaultModel: '', keyUrl: '', keyHint: '' },
} as const;
export type CompatProvider = keyof typeof COMPAT_PROVIDERS;
export const COMPAT_PROVIDER_IDS = Object.keys(COMPAT_PROVIDERS) as CompatProvider[];

export function isCompatProvider(id: string): id is CompatProvider {
  return id in COMPAT_PROVIDERS;
}

/** Name des Server-Schlüssels für einen Anbieter (GuildSecret.key) */
export function providerSecretKey(provider: 'anthropic' | CompatProvider): `${'anthropic' | CompatProvider}ApiKey` {
  return `${provider}ApiKey`;
}

/** Basis-Adresse ohne Schrägstrich am Ende; bei „custom“ die eingetragene */
export function compatBaseUrl(provider: CompatProvider, customUrl = ''): string {
  return (provider === 'custom' ? customUrl : COMPAT_PROVIDERS[provider].baseUrl).trim().replace(/\/+$/, '');
}

export class CompatError extends Error {
  constructor(
    public readonly kind: 'auth' | 'rate' | 'model' | 'unreachable' | 'other',
    message: string,
  ) {
    super(message);
  }
}

export interface CompatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function headers(apiKey: string): Record<string, string> {
  return { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}), 'x-title': 'Moin_Julia' };
}

function errorText(detail: string): string {
  try {
    const parsed = JSON.parse(detail) as { error?: { message?: string } | string } | Array<{ error?: { message?: string } }>;
    const err = Array.isArray(parsed) ? parsed[0]?.error : parsed.error;
    return String(typeof err === 'string' ? err : (err?.message ?? '')).slice(0, 200);
  } catch {
    return detail.replace(/<[^>]+>/g, ' ').trim().slice(0, 200);
  }
}

function fail(status: number, detail: string, label: string, model: string): never {
  const msg = errorText(detail);
  if (status === 401 || status === 403) throw new CompatError('auth', `${label} lehnt den Schlüssel ab (HTTP ${status}) – Schlüssel prüfen.`);
  if (status === 429) throw new CompatError('rate', `${label}: Limit erreicht oder kein Guthaben (HTTP 429)${msg ? ` – ${msg}` : ''}.`);
  if (status === 404 || (status === 400 && /model/i.test(msg))) throw new CompatError('model', `${label} kennt das Modell „${model}“ nicht${msg ? ` (${msg})` : ''}.`);
  throw new CompatError('other', `${label} antwortet mit HTTP ${status}${msg ? `: ${msg}` : ''}.`);
}

/** Eine Chat-Antwort holen (Text + Token-Verbrauch) */
export async function compatChat(
  target: { baseUrl: string; apiKey: string; model: string; label: string },
  messages: CompatMessage[],
  fetchFn: FetchLike,
  timeout: () => unknown,
): Promise<{ text: string; usage: { input: number; output: number } }> {
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchFn(`${target.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: headers(target.apiKey),
      body: JSON.stringify({ model: target.model, messages, stream: false }),
      signal: timeout(),
      cache: 'no-store',
    });
  } catch {
    throw new CompatError('unreachable', `${target.label} ist nicht erreichbar.`);
  }
  if (!res.ok) fail(res.status, await res.text().catch(() => ''), target.label, target.model);
  let data: { choices?: { message?: { content?: string | null; refusal?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new CompatError('other', `${target.label} hat keine gültige Antwort geschickt.`);
  }
  const message = data.choices?.[0]?.message;
  const text = (message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  return { text, usage: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 } };
}

/** Verfügbare Modelle – gleichzeitig der Test, ob Schlüssel und Adresse stimmen */
export async function compatModels(target: { baseUrl: string; apiKey: string; label: string }, fetchFn: FetchLike, timeout: () => unknown): Promise<string[]> {
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchFn(`${target.baseUrl}/models`, { method: 'GET', headers: headers(target.apiKey), signal: timeout(), cache: 'no-store' });
  } catch {
    throw new CompatError('unreachable', `${target.label} ist nicht erreichbar.`);
  }
  if (!res.ok) fail(res.status, await res.text().catch(() => ''), target.label, '');
  try {
    const data = (await res.json()) as { data?: { id?: string }[] };
    // Gemini liefert „models/gemini-…“ – für den Chat zählt der Name ohne Präfix
    return [...new Set((data.data ?? []).map((m) => String(m.id ?? '').replace(/^models\//, '')).filter(Boolean))].sort().slice(0, 300);
  } catch {
    throw new CompatError('other', `${target.label} hat keine gültige Modell-Liste geschickt.`);
  }
}
