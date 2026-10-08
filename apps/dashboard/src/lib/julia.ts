import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, costMicroUsd, extractMemory, type JuliaConfig } from '@moin/shared';
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
    if (!s.ollamaUrl || !s.ollamaModel) return { ok: false, text: 'Ollama ist noch nicht verbunden (Reiter „Verbindung“).', costMicro: 0 };
    try {
      const res = await fetch(`${s.ollamaUrl.replace(/\/+$/, '')}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: s.ollamaModel, stream: false, messages: [{ role: 'system', content: system }, ...messages] }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) return { ok: false, text: `Ollama antwortet mit HTTP ${res.status}.`, costMicro: 0 };
      const data = (await res.json()) as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
      const text = (data.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      return { ok: true, text, costMicro: 0, usage: { input: data.prompt_eval_count ?? 0, output: data.eval_count ?? 0, cacheRead: 0, cacheWrite: 0 } };
    } catch {
      return { ok: false, text: `Ollama unter ${s.ollamaUrl} ist nicht erreichbar.`, costMicro: 0 };
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

/** Ollama erreichbar + Modell vorhanden? */
export async function checkOllama(url: string, model: string): Promise<{ ok: boolean; message: string; models?: string[] }> {
  if (isDemoMode()) return { ok: true, message: 'Demo: Ollama nicht geprüft.' };
  const base = url.trim().replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (!res.ok) return { ok: false, message: `Ollama antwortet mit HTTP ${res.status}.` };
    const data = (await res.json()) as { models?: { name: string }[] };
    const models = (data.models ?? []).map((m) => m.name);
    const found = models.some((m) => m === model || m === `${model}:latest` || m.split(':')[0] === model);
    if (!found) return { ok: false, message: models.length ? `Das Modell „${model}“ fehlt. Vorhanden: ${models.slice(0, 8).join(', ')}. Laden mit: ollama pull ${model}` : `Noch kein Modell geladen. Auf dem Ollama-Rechner: ollama pull ${model}`, models };
    return { ok: true, message: `Ollama ist verbunden (${model}).`, models };
  } catch {
    return { ok: false, message: `Unter ${base} antwortet kein Ollama. Läuft es, und ist es im Netzwerk erreichbar (OLLAMA_HOST=0.0.0.0)?` };
  }
}
