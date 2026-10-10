import Anthropic from '@anthropic-ai/sdk';
import { ollamaChat, OllamaError, type ClaudeModel, type FetchLike, type OllamaEndpoint } from '@moin/shared';

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

/**
 * Ollama über die Standard-REST-API (`/api/chat`) – eigener Endpunkt (lokal, Proxy oder Ollama Cloud).
 * Die eigentliche Anfrage kommt aus @moin/shared, damit Dashboard-Test und Bot gleich arbeiten.
 */
export async function ollamaComplete(
  opts: { endpoint: OllamaEndpoint; model: string; system: SystemPrompt; messages: ChatMessage[] },
  f: typeof fetch = fetch,
): Promise<Completion> {
  try {
    const reply = await ollamaChat(
      opts.endpoint,
      opts.model,
      [{ role: 'system', content: `${opts.system.stable}\n\n${opts.system.dynamic}`.trim() }, ...opts.messages],
      f as unknown as FetchLike,
      () => AbortSignal.timeout(120_000),
    );
    return { text: reply.text, refused: false, usage: { input: reply.usage.input, output: reply.usage.output, cacheRead: 0, cacheWrite: 0 } };
  } catch (error) {
    if (error instanceof OllamaError) throw new JuliaError(error.kind === 'auth' ? 'auth' : error.kind === 'unreachable' ? 'unavailable' : 'other', error.message);
    throw error;
  }
}
