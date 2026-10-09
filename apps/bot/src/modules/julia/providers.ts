import Anthropic from '@anthropic-ai/sdk';
import type { ClaudeModel } from '@moin/shared';

/**
 * KI-Anbieter für Julia. Beide liefern Text + Verbrauch; Fehler werden als JuliaError mit Art geworfen,
 * damit der Bot passend reagieren kann (z. B. „nicht verbunden“ statt „Fehler“).
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** System-Prompt: „stable“ (Regeln + Modus, gecacht) und „dynamic“ (Profil der Person, pro Anfrage) */
export interface SystemPrompt {
  stable: string;
  dynamic: string;
}

export interface Completion {
  text: string;
  refused: boolean;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

export class JuliaError extends Error {
  constructor(
    public readonly kind: 'auth' | 'rate' | 'unavailable' | 'other',
    message: string,
  ) {
    super(message);
  }
}

/** Minimale Schnittstelle des SDK-Clients – im Test durch eine Attrappe ersetzbar */
export type AnthropicLike = Pick<Anthropic, 'messages'>;

const clients = new Map<string, Anthropic>();
function anthropicClient(apiKey: string): Anthropic {
  let client = clients.get(apiKey);
  if (!client) {
    client = new Anthropic({ apiKey, maxRetries: 1, timeout: 45_000 });
    clients.clear();
    clients.set(apiKey, client);
  }
  return client;
}

export async function claudeComplete(
  opts: { apiKey: string; model: ClaudeModel; system: SystemPrompt; messages: ChatMessage[] },
  client: AnthropicLike = anthropicClient(opts.apiKey),
): Promise<Completion> {
  try {
    const response = await client.messages.create({
      model: opts.model,
      max_tokens: 2048,
      // Feste Regeln + Persona vorne und gecacht – der wechselnde Chatverlauf kommt dahinter
      system: [
        { type: 'text', text: opts.system.stable, cache_control: { type: 'ephemeral' } },
        ...(opts.system.dynamic ? [{ type: 'text' as const, text: opts.system.dynamic }] : []),
      ],
      messages: opts.messages,
      // Sonnet/Opus denken immer mit – für Chat reicht wenig Aufwand (spart Zeit und Geld)
      ...(opts.model === 'claude-haiku-4-5' ? {} : { output_config: { effort: 'low' as const } }),
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    return {
      text,
      refused: response.stop_reason === 'refusal',
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
        cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
      },
    };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) throw new JuliaError('auth', 'Der Anthropic-Schlüssel ist ungültig oder gesperrt.');
    if (error instanceof Anthropic.RateLimitError) throw new JuliaError('rate', 'Anthropic: zu viele Anfragen – kurz warten.');
    if (error instanceof Anthropic.APIConnectionError || error instanceof Anthropic.InternalServerError) throw new JuliaError('unavailable', 'Anthropic ist gerade nicht erreichbar.');
    if (error instanceof Anthropic.APIError) throw new JuliaError('other', `Anthropic-Fehler ${error.status ?? ''}`.trim());
    throw error;
  }
}

/** Ollama (lokal, ohne Schlüssel): POST /api/chat */
export async function ollamaComplete(opts: { url: string; model: string; system: SystemPrompt; messages: ChatMessage[] }, f: typeof fetch = fetch): Promise<Completion> {
  const base = opts.url.replace(/\/+$/, '');
  let res: Response;
  try {
    res = await f(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: opts.model, stream: false, messages: [{ role: 'system', content: `${opts.system.stable}\n\n${opts.system.dynamic}`.trim() }, ...opts.messages], options: { num_predict: 800 } }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new JuliaError('unavailable', `Ollama unter ${base} ist nicht erreichbar.`);
  }
  if (res.status === 404) throw new JuliaError('other', `Ollama kennt das Modell „${opts.model}“ nicht – erst mit „ollama pull ${opts.model}“ laden.`);
  if (!res.ok) throw new JuliaError('unavailable', `Ollama antwortet mit HTTP ${res.status}.`);
  const data = (await res.json()) as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
  // Manche Modelle schreiben ihr „Nachdenken“ in <think>…</think> – das soll nicht im Chat landen
  // …auch wenn die Antwort mitten im Nachdenken abgeschnitten wurde (kein </think>)
  const text = (data.message?.content ?? '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/, '')
    .trim();
  return { text, refused: false, usage: { input: data.prompt_eval_count ?? 0, output: data.eval_count ?? 0, cacheRead: 0, cacheWrite: 0 } };
}
