'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { CLAUDE_MODEL_IDS, CLAUDE_MODELS, MODE_CREATIVITY, MODE_LENGTH_LABELS, MODE_LENGTHS, type JuliaMode } from '@moin/shared';
import { saveJuliaModes } from '@/app/g/[guildId]/julia/actions';

/**
 * Neue, nie wiederverwendete ID: Würde die ID eines gelöschten Modus neu vergeben, liefe ein Kanal,
 * der noch auf den alten Modus gestellt ist, plötzlich mit der neuen Persona.
 */
const newId = (modes: JuliaMode[]) => {
  let id = `m${Date.now().toString(36)}`;
  while (modes.some((m) => m.id === id)) id = `m${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  return id;
};

/** Modi anlegen/bearbeiten – jeder Modus ist eine eigene Persona */
export function JuliaModesEditor({ guildId, canEdit, initial, provider }: { guildId: string; canEdit: boolean; initial: JuliaMode[]; provider: 'anthropic' | 'ollama' }) {
  const router = useRouter();
  const [modes, setModes] = useState<JuliaMode[]>(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (i: number, patch: Partial<JuliaMode>) => setModes(modes.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  return (
    <fieldset disabled={!canEdit || pending} className="grid max-w-4xl gap-4">
      {modes.length === 0 && (
        <div className="card p-6 text-sm text-fog-300">
          Noch keine eigenen Modi. Der Standard ist immer <b>Julia</b> mit der Persona aus den Einstellungen. Leg einen Modus an, z. B. mit anderem Charakter, anderer Sprache oder kürzeren
          Antworten – umschalten geht im Chat mit <code>modus Name</code> oder <code>/julia modus</code>.
        </div>
      )}
      {modes.map((m, i) => (
        <div key={m.id} className="card grid gap-3 p-5 text-sm" data-mode>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid min-w-0 flex-1 gap-1.5">
              <span className="font-semibold">Name (für „modus …“)</span>
              <input aria-label={`Name von Modus ${i + 1}`} value={m.name} maxLength={30} onChange={(e) => set(i, { name: e.target.value })} className="input" />
            </label>
            <button type="button" className="pb-2 text-xs text-fog-500 hover:text-danger-500" onClick={() => setModes(modes.filter((_, j) => j !== i))}>
              Modus löschen
            </button>
          </div>
          <label className="grid gap-1.5">
            <span className="font-semibold">Persona – wer ist Julia in diesem Modus?</span>
            <textarea aria-label={`Persona von Modus ${i + 1}`} value={m.persona} maxLength={4000} rows={5} onChange={(e) => set(i, { persona: e.target.value })} className="input font-mono text-xs leading-relaxed" placeholder="Du bist … Du sprichst … Du antwortest …" />
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="grid gap-1.5">
              <span className="text-fog-300">Länge</span>
              <select value={m.length} onChange={(e) => set(i, { length: e.target.value as JuliaMode['length'] })} className="input">
                {MODE_LENGTHS.map((l) => (
                  <option key={l} value={l}>
                    {MODE_LENGTH_LABELS[l]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-fog-300">Kreativität</span>
              <select value={m.creativity} onChange={(e) => set(i, { creativity: e.target.value as JuliaMode['creativity'] })} className="input">
                {MODE_CREATIVITY.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            {provider === 'ollama' && (
              <label className="grid gap-1.5">
                <span className="text-fog-300">Ollama-Modell</span>
                <input
                  value={m.ollamaModel}
                  onChange={(e) => set(i, { ollamaModel: e.target.value.trim().slice(0, 120) })}
                  placeholder="wie beim Endpunkt"
                  spellCheck={false}
                  className="input font-mono"
                />
              </label>
            )}
            {provider === 'anthropic' && (
              <label className="grid gap-1.5">
                <span className="text-fog-300">Modell</span>
                <select value={m.model} onChange={(e) => set(i, { model: e.target.value as JuliaMode['model'] })} className="input">
                  <option value="">wie in den Einstellungen</option>
                  {CLAUDE_MODEL_IDS.map((id) => (
                    <option key={id} value={id}>
                      {CLAUDE_MODELS[id].label.split(' – ')[0]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        {modes.length < 15 && (
          <button type="button" className="btn-ghost" onClick={() => setModes([...modes, { id: newId(modes), name: '', persona: '', length: 'kurz', creativity: 'normal', model: '', ollamaModel: '' }])}>
            + Modus
          </button>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            start(async () => {
              const r = await saveJuliaModes(guildId, JSON.stringify(modes));
              setMessage({ ok: r.ok, text: r.message ?? '' });
              if (r.ok) router.refresh();
            })
          }
        >
          {pending ? 'Speichere …' : 'Modi speichern'}
        </button>
        {message && (
          <p role="status" className={`text-sm ${message.ok ? 'text-sea-400' : 'text-danger-500'}`}>
            {message.text}
          </p>
        )}
      </div>
      <p className="text-xs text-fog-500">Sicherheitsregeln, Flirt-Sperren und Budget gelten in jedem Modus und lassen sich nicht abschalten.</p>
    </fieldset>
  );
}
