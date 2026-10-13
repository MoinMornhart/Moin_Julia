import { z } from 'zod';

/**
 * Julia spricht (Issue #7): `/julia sprich` – Julia kommt in den Sprachkanal und spricht ihre Antwort.
 * Anbieter:
 *  - piper: kostenlos, ohne Schlüssel, läuft lokal als Zusatzdienst „tts“ (Docker-Profil) oder auf einem eigenen Rechner
 *  - openai: mit dem OpenAI-Schlüssel des Servers
 *  - elevenlabs: mit eigenem ElevenLabs-Schlüssel des Servers (kostenpflichtig, sehr natürlich)
 */
export const VOICE_PROVIDERS = ['piper', 'openai', 'elevenlabs'] as const;
export type VoiceProvider = (typeof VOICE_PROVIDERS)[number];

export const VOICE_PROVIDER_LABELS: Record<VoiceProvider, string> = {
  piper: 'Piper – kostenlos, ohne Schlüssel (läuft bei dir)',
  openai: 'OpenAI – mit dem OpenAI-Schlüssel des Servers',
  elevenlabs: 'ElevenLabs – sehr natürlich, eigener Schlüssel (kostenpflichtig)',
};

/** Stimmen von OpenAI (gpt-4o-mini-tts) */
export const OPENAI_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'] as const;
export const PIPER_DEFAULT_VOICE = 'de_DE-thorsten-medium';
export const DEFAULT_TTS_URL = 'http://tts:5000';

export const juliaVoiceSchema = z
  .object({
    enabled: z.boolean().default(false),
    provider: z.enum(VOICE_PROVIDERS).default('piper'),
    /** Stimme: Piper-Stimmenname, OpenAI-Stimme oder ElevenLabs-Voice-ID (leer = Standard) */
    voice: z.string().trim().regex(/^[\w.-]{0,80}$/).default(''),
    /** Sprechtempo 0,5 … 2 */
    speed: z.number().min(0.5).max(2).default(1),
  })
  .default({ enabled: false, provider: 'piper', voice: '', speed: 1 });
export type JuliaVoice = z.infer<typeof juliaVoiceSchema>;

/** Höchstens so viele Zeichen werden gesprochen (Kosten, Länge im Sprachkanal) */
export const MAX_SPOKEN_CHARS = 600;

/**
 * Text fürs Vorlesen aufbereiten: Markdown, Links, Erwähnungen und Emojis raus, auf MAX_SPOKEN_CHARS kürzen
 * (an einem Satzende, wenn möglich).
 */
export function speakableText(text: string): string {
  let t = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/<a?:\w+:\d+>/g, '')
    .replace(/<[@#&!]+\d+>/g, '')
    .replace(/[*_~|>#]+/g, '')
    .replace(/\p{Extended_Pictographic}️?/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > MAX_SPOKEN_CHARS) {
    const cut = t.slice(0, MAX_SPOKEN_CHARS);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    t = end > MAX_SPOKEN_CHARS / 2 ? cut.slice(0, end + 1) : `${cut.trimEnd()} …`;
  }
  return t;
}

export class VoiceError extends Error {
  constructor(
    readonly kind: 'notConfigured' | 'failed',
    message: string,
  ) {
    super(message);
  }
}

/**
 * Text → Audio (Piper: WAV, OpenAI/ElevenLabs: MP3). Gemeinsam für Bot (Sprachkanal) und Dashboard (Probe hören).
 * Schlüssel/Adresse gibt der Aufrufer mit – hier wird nichts gespeichert.
 */
/** Schlanker fetch-Typ (shared hat keine DOM-/Node-Typen) */
export type VoiceFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: unknown },
) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

export async function synthesizeSpeech(
  input: { voice: JuliaVoice; text: string; ttsUrl?: string | null; openaiKey?: string | null; elevenlabsKey?: string | null },
  f: VoiceFetch,
  timeout: () => unknown = () => undefined,
): Promise<{ audio: Uint8Array; mime: 'audio/wav' | 'audio/mpeg' }> {
  const text = speakableText(input.text);
  if (!text) throw new VoiceError('failed', 'Nichts zu sagen.');
  const { voice } = input;
  const signal = timeout();
  let res: Awaited<ReturnType<VoiceFetch>>;
  let mime: 'audio/wav' | 'audio/mpeg' = 'audio/mpeg';
  if (voice.provider === 'piper') {
    const base = (input.ttsUrl || DEFAULT_TTS_URL).replace(/\/+$/, '');
    mime = 'audio/wav';
    res = await f(`${base}/synthesize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, voice: voice.voice || PIPER_DEFAULT_VOICE, length_scale: Math.round((1 / voice.speed) * 100) / 100 }),
      signal,
    }).catch(() => {
      throw new VoiceError('notConfigured', `Piper ist nicht erreichbar (${base}) – läuft der Zusatzdienst „tts“?`);
    });
  } else if (voice.provider === 'openai') {
    if (!input.openaiKey) throw new VoiceError('notConfigured', 'Für OpenAI fehlt der OpenAI-Schlüssel des Servers (Julia → Verbindung → Eigene Schlüssel).');
    const v = (OPENAI_VOICES as readonly string[]).includes(voice.voice) ? voice.voice : 'nova';
    res = await f('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { authorization: `Bearer ${input.openaiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: v, input: text, speed: voice.speed, response_format: 'mp3' }),
      signal,
    });
  } else {
    if (!input.elevenlabsKey) throw new VoiceError('notConfigured', 'Für ElevenLabs fehlt der Schlüssel des Servers.');
    if (!voice.voice) throw new VoiceError('notConfigured', 'Für ElevenLabs bitte eine Voice-ID eintragen.');
    res = await f(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.voice)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': input.elevenlabsKey, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { speed: Math.min(1.2, Math.max(0.7, voice.speed)) } }),
      signal,
    });
  }
  if (!res.ok) throw new VoiceError(res.status === 401 || res.status === 403 ? 'notConfigured' : 'failed', `Sprachausgabe antwortet mit HTTP ${res.status}${res.status === 401 ? ' (Schlüssel ungültig)' : ''}.`);
  const audio = new Uint8Array(await res.arrayBuffer());
  if (audio.length < 100) throw new VoiceError('failed', 'Leere Antwort der Sprachausgabe.');
  return { audio, mime };
}
