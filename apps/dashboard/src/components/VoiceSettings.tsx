'use client';

import { useRef, useState, useTransition } from 'react';
import { OPENAI_VOICES, PIPER_DEFAULT_VOICE, VOICE_PROVIDER_LABELS, VOICE_PROVIDERS, type JuliaVoice } from '@moin/shared';
import { previewVoice, saveTtsUrl, saveVoiceKey, saveVoiceSettings } from '@/app/g/[guildId]/julia/actions';

type Msg = { ok: boolean; text: string } | null;

/** Julia → 🗣️ Stimme: /julia sprich – Julia spricht ihre Antwort im Sprachkanal */
export function VoiceSettings({
  guildId,
  canEdit,
  initial,
  hasOpenaiKey,
  hasElevenlabsKey,
  isInstanceAdmin,
  ttsUrl,
}: {
  guildId: string;
  canEdit: boolean;
  initial: JuliaVoice;
  hasOpenaiKey: boolean;
  hasElevenlabsKey: boolean;
  isInstanceAdmin: boolean;
  ttsUrl: string;
}) {
  const [v, setV] = useState<JuliaVoice>(initial);
  const [msg, setMsg] = useState<Msg>(null);
  const [key, setKey] = useState('');
  const [url, setUrl] = useState(ttsUrl);
  const [pending, start] = useTransition();
  const audio = useRef<HTMLAudioElement>(null);
  const set = (patch: Partial<JuliaVoice>) => setV({ ...v, ...patch });
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.message ?? '' });
    });

  return (
    <section className="card grid gap-4 p-6 text-sm" aria-labelledby="voice-title">
      <div>
        <h2 id="voice-title" className="font-display text-lg font-semibold">
          🗣️ Stimme – Julia spricht
        </h2>
        <p className="mt-1 text-fog-500">
          Mit <code>/julia sprich</code> kommt Julia in deinen Sprachkanal und spricht ihre Antwort (der Text steht trotzdem im Chat). Läuft gerade Musik, bleibt es beim Text.
        </p>
      </div>
      <fieldset disabled={!canEdit || pending} className="grid gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="size-4 accent-coral-500" />
          <span className="font-semibold">Julia darf sprechen</span>
        </label>
        <div className="grid gap-2" role="radiogroup" aria-label="Sprachausgabe">
          {VOICE_PROVIDERS.map((p) => (
            <label key={p} className="flex items-start gap-2">
              <input type="radio" name="voice.provider" checked={v.provider === p} onChange={() => set({ provider: p, voice: '' })} className="mt-1 size-4 accent-coral-500" />
              <span>
                {VOICE_PROVIDER_LABELS[p]}
                {p === 'openai' && !hasOpenaiKey && <span className="ml-1 text-xs text-sun-400">(noch kein OpenAI-Schlüssel – unter Verbindung → Eigene Schlüssel)</span>}
                {p === 'elevenlabs' && !hasElevenlabsKey && <span className="ml-1 text-xs text-sun-400">(Schlüssel unten eintragen)</span>}
              </span>
            </label>
          ))}
        </div>

        {v.provider === 'openai' ? (
          <label className="grid max-w-xs gap-1.5">
            <span className="font-semibold">Stimme</span>
            <select value={v.voice || 'nova'} onChange={(e) => set({ voice: e.target.value })} className="input">
              {OPENAI_VOICES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="grid max-w-md gap-1.5">
            <span className="font-semibold">{v.provider === 'piper' ? 'Piper-Stimme' : 'ElevenLabs Voice-ID'}</span>
            <input
              value={v.voice}
              onChange={(e) => set({ voice: e.target.value.trim() })}
              placeholder={v.provider === 'piper' ? PIPER_DEFAULT_VOICE : 'z. B. 21m00Tcm4TlvDq8ikWAM'}
              maxLength={80}
              className="input"
            />
          </label>
        )}

        <label className="grid max-w-md gap-1.5">
          <span className="font-semibold">Tempo: {v.speed.toFixed(1)}×</span>
          <input type="range" min={0.5} max={2} step={0.1} value={v.speed} onChange={(e) => set({ speed: Number(e.target.value) })} className="accent-coral-500" />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" onClick={() => run(() => saveVoiceSettings(guildId, JSON.stringify(v)))}>
            Stimme speichern
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              start(async () => {
                const r = await previewVoice(guildId, JSON.stringify(v));
                setMsg({ ok: r.ok, text: r.message });
                if (r.ok && r.audio && audio.current) {
                  audio.current.src = r.audio;
                  void audio.current.play().catch(() => undefined);
                }
              })
            }
          >
            🔊 Probe hören
          </button>
          <audio ref={audio} className="hidden" />
        </div>

        {v.provider === 'elevenlabs' && (
          <div className="grid max-w-md gap-1.5 rounded-xl border border-ink-700 p-3">
            <span className="font-semibold">ElevenLabs-Schlüssel {hasElevenlabsKey && <span className="text-xs text-sea-400">✓ gespeichert</span>}</span>
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={hasElevenlabsKey ? 'neuen Schlüssel eintragen …' : 'sk_…'} autoComplete="off" className="input" />
            <div className="flex gap-2">
              <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={!key} onClick={() =>
                  start(async () => {
                    const r = await saveVoiceKey(guildId, key);
                    setMsg({ ok: r.ok, text: r.message ?? '' });
                    if (r.ok) setKey('');
                  })
                }
              >
                Schlüssel speichern
              </button>
              {hasElevenlabsKey && (
                <button type="button" className="btn-ghost px-3 py-1.5 text-xs text-danger-500" onClick={() => run(() => saveVoiceKey(guildId, ''))}>
                  Schlüssel entfernen
                </button>
              )}
            </div>
          </div>
        )}

        {v.provider === 'piper' && (
          <div className="grid gap-1.5 rounded-xl border border-ink-700 p-3 text-xs text-fog-300">
            <p>
              <b>Piper einschalten:</b> in der Proxmox-Konsole <code>moin-julia config</code> → Zeile <code>COMPOSE_PROFILES=tts</code> eintragen → speichern → <code>update</code>. Dann läuft
              Piper als kleiner Zusatzdienst mit deutscher Frauenstimme „Kerstin“ – kostenlos, ohne Schlüssel, alles bleibt bei dir.
            </p>
            {isInstanceAdmin && (
              <label className="mt-1 grid max-w-md gap-1">
                <span className="font-semibold">Piper-Adresse (nur du als Instanz-Admin)</span>
                <span className="flex gap-2">
                  <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://tts:5000" className="input" />
                  <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => run(() => saveTtsUrl(guildId, url))}>
                    Adresse speichern
                  </button>
                </span>
                <span className="text-fog-500">Leer = Zusatzdienst „tts“. Oder ein Piper-Server auf einem anderen Rechner.</span>
              </label>
            )}
          </div>
        )}
      </fieldset>
      {msg && (
        <p role="status" className={msg.ok ? 'text-sea-400' : 'text-danger-500'}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
