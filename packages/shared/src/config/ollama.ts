import { z } from 'zod';

/**
 * Eigene Ollama-Endpunkte über die Standard-REST-API (`POST /api/chat`, `GET /api/tags`, `GET /api/version`).
 * Mehrere Server möglich: lokal im Heimnetz, hinter einem Reverse-Proxy (mit Pfad) oder Ollama Cloud
 * (`https://ollama.com` mit API-Schlüssel als `Authorization: Bearer …`).
 * Bot und Dashboard nutzen dieselbe Logik – so verhalten sich Test im Dashboard und Antwort in Discord gleich.
 */

/** Denk-Modus: auto = Modell entscheidet (nichts senden), aus/an, oder Stufe (z. B. gpt-oss: low/medium/high) */
export const OLLAMA_THINK = ['auto', 'aus', 'an', 'low', 'medium', 'high'] as const;
export type OllamaThink = (typeof OLLAMA_THINK)[number];
export const OLLAMA_THINK_LABELS: Record<OllamaThink, string> = {
  auto: 'Modell entscheidet',
  aus: 'Aus (schneller)',
  an: 'An',
  low: 'Wenig (low)',
  medium: 'Mittel (medium)',
  high: 'Gründlich (high)',
};

export const ollamaEndpointSchema = z.object({
  id: z.string().regex(/^[a-z][\w-]{1,30}$/),
  name: z.string().trim().min(1).max(40),
  /** Basis-Adresse, z. B. http://192.168.1.20:11434, https://ki.example.de/ollama oder https://ollama.com */
  url: z
    .string()
    .trim()
    .max(300)
    .regex(/^https?:\/\/[^\s/@?#]+(?::\d{1,5})?(?:\/[^\s?#]*)?$/, 'Bitte eine Adresse wie http://192.168.1.20:11434'),
  model: z
    .string()
    .trim()
    .regex(/^[\w.:/-]{1,120}$/, 'Modellname wie llama3.2 oder qwen3:8b'),
  /** Optional (Ollama Cloud, geschützter Proxy) – liegt verschlüsselt in der Datenbank */
  apiKey: z.string().trim().max(500).default(''),
  /** Wie lange das Modell nach einer Antwort im Speicher bleibt: „30m“, „2h“, Sekunden, „-1“ = immer */
  keepAlive: z
    .string()
    .trim()
    .regex(/^(-1|0|\d{1,6}[smh]?)$/, 'z. B. 30m, 2h, 600 oder -1')
    .default('30m'),
  /** Kontextgröße in Tokens (0 = Standard des Modells) */
  numCtx: z.number().int().min(0).max(262_144).default(0),
  think: z.enum(OLLAMA_THINK).default('auto'),
});
export type OllamaEndpoint = z.infer<typeof ollamaEndpointSchema>;

/** Was im Browser landen darf: alles außer dem Schlüssel */
export type PublicOllamaEndpoint = Omit<OllamaEndpoint, 'apiKey'> & { hasKey: boolean };
export const publicOllamaEndpoint = ({ apiKey, ...rest }: OllamaEndpoint): PublicOllamaEndpoint => ({ ...rest, hasKey: !!apiKey });

/** Basis-Adresse ohne „/“ am Ende und ohne angehängtes „/api“ */
export function ollamaBaseUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');
}

/**
 * Gespeicherte Endpunkte lesen. Ältere Installationen haben nur `ollamaUrl` + `ollamaModel` –
 * daraus wird automatisch der Endpunkt „Standard“.
 */
export function parseOllamaEndpoints(json: string | null | undefined, legacy?: { url: string | null; model: string | null }): OllamaEndpoint[] {
  let raw: unknown = [];
  try {
    raw = json ? JSON.parse(json) : [];
  } catch {
    raw = [];
  }
  const list = Array.isArray(raw) ? raw.map((e) => ollamaEndpointSchema.safeParse(e)).flatMap((r) => (r.success ? [r.data] : [])) : [];
  if (list.length || !legacy?.url || !legacy.model) return list;
  const fromLegacy = ollamaEndpointSchema.safeParse({ id: 'standard', name: 'Standard', url: legacy.url, model: legacy.model });
  return fromLegacy.success ? [fromLegacy.data] : [];
}

/** Welcher Endpunkt + welches Modell gilt? (Server-Auswahl → sonst der erste; Modus kann das Modell überschreiben) */
export function resolveOllama(endpoints: OllamaEndpoint[], endpointId: string, modeModel?: string): { endpoint: OllamaEndpoint; model: string } | null {
  const endpoint = endpoints.find((e) => e.id === endpointId) ?? endpoints[0];
  if (!endpoint) return null;
  return { endpoint, model: modeModel?.trim() || endpoint.model };
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Anfrage für `POST /api/chat` (ohne Streaming) */
export function ollamaChatBody(endpoint: OllamaEndpoint, model: string, messages: OllamaMessage[], withThink = true): Record<string, unknown> {
  const body: Record<string, unknown> = { model, messages, stream: false };
  // „30m“ als Text, reine Zahl (Sekunden) als Zahl – so wie die API es erwartet
  body.keep_alive = /^-?\d+$/.test(endpoint.keepAlive) ? Number(endpoint.keepAlive) : endpoint.keepAlive;
  const options: Record<string, number> = { num_predict: 800 };
  if (endpoint.numCtx > 0) options.num_ctx = endpoint.numCtx;
  body.options = options;
  if (withThink && endpoint.think !== 'auto') body.think = endpoint.think === 'aus' ? false : endpoint.think === 'an' ? true : endpoint.think;
  return body;
}

export function ollamaHeaders(endpoint: Pick<OllamaEndpoint, 'apiKey'>): Record<string, string> {
  return { 'content-type': 'application/json', ...(endpoint.apiKey ? { authorization: `Bearer ${endpoint.apiKey}` } : {}) };
}

/** Nur die Antwort – „Nachdenken“ (eigenes Feld oder <think>…</think>, auch abgeschnitten) kommt nie in den Chat */
export function cleanOllamaText(content: string): string {
  return content
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/, '')
    .trim();
}

/** Minimal-Typ für fetch (das Paket läuft in Bot und Dashboard, ohne DOM-Typen) */
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: unknown; cache?: 'no-store' },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

export type OllamaErrorKind = 'unreachable' | 'auth' | 'model' | 'other';
export class OllamaError extends Error {
  constructor(
    readonly kind: OllamaErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'OllamaError';
  }
}

export interface OllamaReply {
  text: string;
  usage: { input: number; output: number };
}

/**
 * Chat-Anfrage. Kennt ein Modell den Denk-Modus nicht, wird automatisch ohne ihn wiederholt.
 * `timeout` liefert ein AbortSignal (z. B. () => AbortSignal.timeout(120_000)).
 */
export async function ollamaChat(endpoint: OllamaEndpoint, model: string, messages: OllamaMessage[], fetchFn: FetchLike, timeout: () => unknown): Promise<OllamaReply> {
  const base = ollamaBaseUrl(endpoint.url);
  const send = async (withThink: boolean) => {
    try {
      return await fetchFn(`${base}/api/chat`, { method: 'POST', headers: ollamaHeaders(endpoint), body: JSON.stringify(ollamaChatBody(endpoint, model, messages, withThink)), signal: timeout(), cache: 'no-store' });
    } catch {
      throw new OllamaError('unreachable', `Ollama unter ${base} ist nicht erreichbar.`);
    }
  };
  let res = await send(true);
  if (!res.ok && endpoint.think !== 'auto') {
    const detail = await res.text().catch(() => '');
    if (/think/i.test(detail)) res = await send(false);
    else return failed(res.status, detail, model, base);
  }
  if (!res.ok) return failed(res.status, await res.text().catch(() => ''), model, base);
  let data: { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    // z. B. eine HTML-Seite eines Reverse-Proxys statt Ollama
    throw new OllamaError('other', `Unter ${base} antwortet etwas, aber kein Ollama (keine gültige Antwort).`);
  }
  return { text: cleanOllamaText(data.message?.content ?? ''), usage: { input: data.prompt_eval_count ?? 0, output: data.eval_count ?? 0 } };
}

function failed(status: number, detail: string, model: string, base: string): never {
  const message = (() => {
    try {
      return String((JSON.parse(detail) as { error?: string }).error ?? '');
    } catch {
      return detail.slice(0, 200);
    }
  })();
  if (status === 401 || status === 403) throw new OllamaError('auth', `Ollama unter ${base} lehnt den Zugang ab (HTTP ${status}) – API-Schlüssel prüfen.`);
  // 404 mit Ollama-Fehlertext = Modell fehlt; 404 ohne = falscher Pfad (z. B. Proxy-Adresse ohne /ollama)
  if (status === 404 && /model|not found/i.test(message)) throw new OllamaError('model', `Ollama kennt das Modell „${model}“ nicht – erst mit „ollama pull ${model}“ laden.`);
  if (status === 404) throw new OllamaError('unreachable', `Unter ${base}/api/chat gibt es kein Ollama (HTTP 404) – stimmt die Adresse (bei einem Proxy mit Pfad)?`);
  throw new OllamaError('other', `Ollama antwortet mit HTTP ${status}${message ? `: ${message}` : ''}.`);
}

/** Modelle und Version eines Endpunkts abfragen (für „Modelle laden“ und die Prüfung beim Speichern) */
export async function ollamaModels(endpoint: Pick<OllamaEndpoint, 'url' | 'apiKey'>, fetchFn: FetchLike, timeout: () => unknown): Promise<{ models: string[]; version: string | null }> {
  const base = ollamaBaseUrl(endpoint.url);
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchFn(`${base}/api/tags`, { headers: ollamaHeaders(endpoint), signal: timeout(), cache: 'no-store' });
  } catch {
    throw new OllamaError('unreachable', `Unter ${base} antwortet kein Ollama. Läuft es, und ist es im Netzwerk erreichbar (OLLAMA_HOST=0.0.0.0)?`);
  }
  if (res.status === 401 || res.status === 403) throw new OllamaError('auth', `Ollama unter ${base} lehnt den Zugang ab (HTTP ${res.status}) – API-Schlüssel prüfen.`);
  if (!res.ok) throw new OllamaError('other', `Unter ${base} antwortet etwas, aber kein Ollama (HTTP ${res.status}).`);
  const data = (await res.json().catch(() => ({}))) as { models?: { name?: string; model?: string }[] };
  const models = (data.models ?? []).map((m) => m.name || m.model || '').filter(Boolean);
  let version: string | null = null;
  try {
    const v = await fetchFn(`${base}/api/version`, { headers: ollamaHeaders(endpoint), signal: timeout(), cache: 'no-store' });
    if (v.ok) version = String(((await v.json()) as { version?: string }).version ?? '') || null;
  } catch {
    version = null;
  }
  return { models, version };
}

/** Ist das Modell in der Liste? („llama3.2“ passt auch zu „llama3.2:latest“) */
export function hasOllamaModel(models: string[], model: string): boolean {
  return models.some((m) => m === model || m === `${model}:latest` || m.replace(/:latest$/, '') === model);
}
