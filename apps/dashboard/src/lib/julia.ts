import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import {
  buildSystemPrompt,
  costMicroUsd,
  extractMemory,
  hasOllamaModel,
  ollamaChat,
  OllamaError,
  ollamaModels,
  parseOllamaEndpoints,
  resolveOllama,
  type FetchLike,
  type JuliaConfig,
  type OllamaEndpoint,
} from '@moin/shared';
import { appSettings } from './config';
import { isDemoMode } from './env';

/**
 * Julia aus dem Dashboard testen (gleiche Regeln + Persona wie im Bot) und Ollama prüfen.
 * Der Chat selbst läuft im Bot (apps/bot/src/modules/julia).
 */

export interface TestAnswer {
  ok: boolean;
  text: string;
  costMicro: number;
  usage?: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

export async function testJulia(config: JuliaConfig, guildName: string, question: string, userName: string): Promise<TestAnswer> {
  if (isDemoMode()) return { ok: true, text: 'Moin! ⚓ Ich bin Julia – das hier ist eine Demo-Antwort, im echten Betrieb antworte ich mit Claude oder Ollama.', costMicro: 0 };
  const s = await appSettings();
  const prompt = buildSystemPrompt({ serverName: guildName, persona: config.persona, length: 'kurz', creativity: 'normal', memoryEnabled: config.memoryEnabled, speaker: { name: userName, profile: null }, flirty: false });
  const system = `${prompt.stable}\n\n${prompt.dynamic}`;
  const messages = [{ role: 'user' as const, content: `[${userName.replace(/[[\]\n]/g, '')}]: ${question}` }];
  if (config.provider === 'ollama') {
    const target = resolveOllama(parseOllamaEndpoints(s.ollamaEndpoints, { url: s.ollamaUrl, model: s.ollamaModel }), config.ollamaEndpointId);
    if (!target) return { ok: false, text: 'Ollama ist noch nicht verbunden (Reiter „Verbindung“).', costMicro: 0 };
    try {
      const reply = await ollamaChat(target.endpoint, target.model, [{ role: 'system', content: system }, ...messages], fetch as unknown as FetchLike, () => AbortSignal.timeout(120_000));
      return { ok: true, text: extractMemory(reply.text).text, costMicro: 0, usage: { input: reply.usage.input, output: reply.usage.output, cacheRead: 0, cacheWrite: 0 } };
    } catch (error) {
      return { ok: false, text: error instanceof OllamaError ? `${target.endpoint.name}: ${error.message}` : `Ollama unter ${target.endpoint.url} ist nicht erreichbar.`, costMicro: 0 };
    }
  }
  if (!s.anthropicApiKey) return { ok: false, text: 'Claude ist noch nicht verbunden (Reiter „Verbindung“).', costMicro: 0 };
  try {
    const client = new Anthropic({ apiKey: s.anthropicApiKey, maxRetries: 1, timeout: 45_000 });
    const response = await client.messages.create({
      model: config.model,
      max_tokens: 2048,
      system: [
        { type: 'text', text: prompt.stable, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: prompt.dynamic },
      ],
      messages,
      ...(config.model === 'claude-haiku-4-5' ? {} : { output_config: { effort: 'low' as const } }),
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    const usage = {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      cacheRead: response.usage.cache_read_input_tokens ?? 0,
      cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
    };
    if (response.stop_reason === 'refusal') return { ok: true, text: '(Julia lehnt diese Frage ab.)', costMicro: costMicroUsd(config.model, usage), usage };
    return { ok: true, text: extractMemory(text).text, costMicro: costMicroUsd(config.model, usage), usage };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { ok: false, text: 'Der Anthropic-Schlüssel ist ungültig.', costMicro: 0 };
    if (error instanceof Anthropic.APIError) return { ok: false, text: `Anthropic-Fehler ${error.status ?? ''}: ${error.message}`.slice(0, 300), costMicro: 0 };
    return { ok: false, text: 'Anthropic ist gerade nicht erreichbar.', costMicro: 0 };
  }
}

/** Ollama erreichbar (+ Modell vorhanden, wenn angegeben)? Liefert die Modell-Liste für die Auswahl */
export async function checkOllama(endpoint: Pick<OllamaEndpoint, 'url' | 'apiKey'>, model?: string): Promise<{ ok: boolean; message: string; models?: string[]; version?: string | null }> {
  if (isDemoMode()) return { ok: true, message: 'Demo: Ollama nicht geprüft.', models: ['llama3.2:latest', 'qwen3:8b', 'gpt-oss:20b'], version: 'demo' };
  try {
    const { models, version } = await ollamaModels(endpoint, fetch as unknown as FetchLike, () => AbortSignal.timeout(8000));
    const v = version ? ` (Ollama ${version})` : '';
    if (!model) return { ok: true, message: models.length ? `${models.length} Modell(e) gefunden${v}.` : `Verbunden${v}, aber noch kein Modell geladen – auf dem Ollama-Rechner z. B.: ollama pull llama3.2`, models, version };
    if (!hasOllamaModel(models, model)) {
      return { ok: false, message: models.length ? `Das Modell „${model}“ fehlt. Vorhanden: ${models.slice(0, 8).join(', ')}. Laden mit: ollama pull ${model}` : `Noch kein Modell geladen. Auf dem Ollama-Rechner: ollama pull ${model}`, models, version };
    }
    return { ok: true, message: `Ollama ist verbunden (${model})${v}.`, models, version };
  } catch (error) {
    return { ok: false, message: error instanceof OllamaError ? error.message : 'Ollama antwortet nicht wie erwartet.' };
  }
}
