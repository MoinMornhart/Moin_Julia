import { normalizeWords, wordsMatch } from '../fuzzy.js';

/**
 * Mit Julia im Call reden (Wunsch Philip, 13.10.): Julia bleibt im Sprachkanal, hört zu und antwortet mit Stimme.
 * Datenschutz: nur auf Befehl (/julia gespräch start), mit Ansage beim Betreten, sie reagiert nur auf „Julia …“,
 * Audio wird nicht gespeichert (nur kurz im Speicher für die Spracherkennung), sie geht bei Stille/leerem Kanal.
 */

/** Ohne Weckwort-Satz so lange still, dann verlässt Julia den Kanal */
export const LISTEN_IDLE_MS = 5 * 60_000;
/** Ein Redebeitrag: höchstens so lang (danach wird abgeschnitten) */
export const MAX_UTTERANCE_MS = 15_000;
/** Kürzer = nur Geräusch, wird ignoriert */
export const MIN_UTTERANCE_MS = 600;

/**
 * Beginnt der Satz mit dem Weckwort „Julia“ (auch „Hey Julia“, „Julja“, „Julie“)? Dann die Frage danach, sonst null.
 * Nur am Anfang – wer „…und dann sagte Julia…“ erzählt, ist nicht gemeint.
 */
export function afterWakeWord(text: string): string | null {
  const words = normalizeWords(text);
  const lead = ['hey', 'hallo', 'hi', 'ok', 'okay', 'moin', 'na', 'du', 'also', 'ähm', 'aehm', 'äh'];
  let i = 0;
  while (i < words.length && i < 2 && lead.includes(words[i]!)) i++;
  const w = words[i];
  if (!w || !(wordsMatch(w, 'julia') || ['julie', 'julja', 'juliaa', 'yulia'].includes(w))) return null;
  // Rest des Originaltexts nach dem i-ten Wort (Satzzeichen davor weg)
  const spans = [...text.matchAll(/[\p{L}\p{N}]+/gu)];
  const end = spans[i] ? spans[i]!.index! + spans[i]![0].length : text.length;
  const rest = text.slice(end).replace(/^[\s,.!?:;-]+/, '').trim();
  return rest.length >= 2 ? rest : null;
}

/**
 * Discord liefert 48 kHz Stereo, 16-bit (PCM). Spracherkennung braucht 16 kHz Mono:
 * Kanäle mitteln, jede 3. Probe (mit Mittelwert) nehmen und als WAV verpacken.
 */
export function pcmToWav16kMono(pcm48kStereo: Uint8Array): Uint8Array {
  const view = new DataView(pcm48kStereo.buffer, pcm48kStereo.byteOffset, pcm48kStereo.byteLength);
  const frames = Math.floor(pcm48kStereo.byteLength / 4);
  const outSamples = Math.floor(frames / 3);
  const out = new Uint8Array(44 + outSamples * 2);
  const o = new DataView(out.buffer);
  for (let i = 0; i < outSamples; i++) {
    let sum = 0;
    for (let k = 0; k < 3; k++) {
      const f = (i * 3 + k) * 4;
      sum += view.getInt16(f, true) + view.getInt16(f + 2, true);
    }
    o.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(sum / 6))), true);
  }
  const text = (off: number, s: string) => [...s].forEach((c, j) => o.setUint8(off + j, c.charCodeAt(0)));
  text(0, 'RIFF');
  o.setUint32(4, 36 + outSamples * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  o.setUint32(16, 16, true);
  o.setUint16(20, 1, true); // PCM
  o.setUint16(22, 1, true); // Mono
  o.setUint32(24, 16000, true);
  o.setUint32(28, 32000, true);
  o.setUint16(32, 2, true);
  o.setUint16(34, 16, true);
  text(36, 'data');
  o.setUint32(40, outSamples * 2, true);
  return out;
}

/** Dauer von 48-kHz-Stereo-PCM in ms */
export function pcmDurationMs(bytes: number): number {
  return Math.round((bytes / 4 / 48_000) * 1000);
}

export type SttFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: Uint8Array; signal?: unknown },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export const DEFAULT_STT_URL = 'http://stt:8000';

export class SttError extends Error {
  constructor(
    readonly kind: 'notConfigured' | 'failed',
    message: string,
  ) {
    super(message);
  }
}

/** multipart/form-data von Hand (shared hat keine DOM-Typen) */
function multipart(wav: Uint8Array, fields: Record<string, string>): { body: Uint8Array; type: string } {
  const boundary = `----moin${Math.random().toString(16).slice(2)}`;
  // Alle Feldnamen/-werte sind ASCII – einfache Kodierung reicht (shared hat kein TextEncoder)
  const enc = { encode: (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0) & 0xff)) };
  const parts: Uint8Array[] = [];
  for (const [k, v] of Object.entries(fields)) parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sprache.wav"\r\nContent-Type: audio/wav\r\n\r\n`), wav, enc.encode(`\r\n--${boundary}--\r\n`));
  const body = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    body.set(p, at);
    at += p.length;
  }
  return { body, type: `multipart/form-data; boundary=${boundary}` };
}

/**
 * Sprache → Text. Lokal (Zusatzdienst „stt“, OpenAI-kompatibel: POST /v1/audio/transcriptions) oder OpenAI.
 * provider „lokal“ = eigener Whisper-Dienst ohne Schlüssel, „openai“ = Schlüssel des Servers.
 */
export async function transcribeSpeech(
  input: { wav: Uint8Array; provider: 'lokal' | 'openai'; sttUrl?: string | null; openaiKey?: string | null },
  f: SttFetch,
  timeout: () => unknown = () => undefined,
): Promise<string> {
  const fields: Record<string, string> = { language: 'de', response_format: 'json' };
  let url: string;
  const headers: Record<string, string> = {};
  if (input.provider === 'openai') {
    if (!input.openaiKey) throw new SttError('notConfigured', 'Für die Spracherkennung mit OpenAI fehlt der OpenAI-Schlüssel des Servers.');
    url = 'https://api.openai.com/v1/audio/transcriptions';
    headers.authorization = `Bearer ${input.openaiKey}`;
    fields.model = 'gpt-4o-mini-transcribe';
  } else {
    url = `${(input.sttUrl || DEFAULT_STT_URL).replace(/\/+$/, '')}/v1/audio/transcriptions`;
    fields.model = 'whisper';
  }
  const { body, type } = multipart(input.wav, fields);
  const res = await f(url, { method: 'POST', headers: { ...headers, 'content-type': type }, body, signal: timeout() }).catch(() => {
    throw new SttError('notConfigured', input.provider === 'openai' ? 'OpenAI ist nicht erreichbar.' : 'Die Spracherkennung „stt“ läuft nicht: in .env  COMPOSE_PROFILES=tts,stt  eintragen, dann  update.');
  });
  if (!res.ok) throw new SttError('failed', `Spracherkennung antwortet mit Fehler ${res.status}.`);
  const data = (await res.json().catch(() => null)) as { text?: unknown } | null;
  return typeof data?.text === 'string' ? data.text.trim().slice(0, 1000) : '';
}
