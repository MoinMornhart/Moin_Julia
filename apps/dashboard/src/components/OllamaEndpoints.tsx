'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { OLLAMA_THINK, OLLAMA_THINK_LABELS, type OllamaThink, type PublicOllamaEndpoint } from '@moin/shared';
import { deleteOllamaEndpoint, loadOllamaModels, saveOllamaEndpoint } from '@/app/g/[guildId]/julia/actions';

type Msg = { ok: boolean; text: string } | null;

interface Draft {
  id?: string;
  name: string;
  url: string;
  model: string;
  apiKey: string;
  hasKey: boolean;
  keepKey: boolean;
  keepAlive: string;
  numCtx: string;
  think: OllamaThink;
}

const EMPTY: Draft = { name: '', url: '', model: '', apiKey: '', hasKey: false, keepKey: true, keepAlive: '30m', numCtx: '0', think: 'auto' };

const PRESETS: { label: string; draft: Partial<Draft> }[] = [
  { label: '🏠 Heimnetz', draft: { name: 'Heimnetz', url: 'http://192.168.1.20:11434', model: 'llama3.2', keepAlive: '30m' } },
  { label: '☁️ Ollama Cloud', draft: { name: 'Ollama Cloud', url: 'https://ollama.com', model: 'gpt-oss:120b', keepAlive: '5m' } },
];

const fromEndpoint = (e: PublicOllamaEndpoint): Draft => ({ id: e.id, name: e.name, url: e.url, model: e.model, apiKey: '', hasKey: e.hasKey, keepKey: true, keepAlive: e.keepAlive, numCtx: String(e.numCtx), think: e.think });

/** Eigene Ollama-Endpunkte: lokal, hinter einem Proxy oder Ollama Cloud – über die Standard-REST-API */
export function OllamaEndpoints({ guildId, isAdmin, endpoints }: { guildId: string; isAdmin: boolean; endpoints: PublicOllamaEndpoint[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(endpoints.length ? null : { ...EMPTY });
  const [models, setModels] = useState<string[]>([]);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const loadModels = () =>
    draft &&
    start(async () => {
      const r = await loadOllamaModels(guildId, { id: draft.id, url: draft.url, apiKey: draft.apiKey });
      setMsg({ ok: r.ok, text: r.message ?? '' });
      if (r.ok && r.models) {
        setModels(r.models);
        if (!draft.model && r.models[0]) set({ model: r.models[0] });
      }
    });

  const save = () =>
    draft &&
    start(async () => {
      const r = await saveOllamaEndpoint(guildId, {
        id: draft.id,
        name: draft.name,
        url: draft.url,
        model: draft.model,
        apiKey: draft.apiKey,
        keepKey: draft.keepKey,
        keepAlive: draft.keepAlive.trim(),
        numCtx: Number(draft.numCtx.replace(/\D/g, '') || 0),
        think: draft.think,
      });
      setMsg({ ok: r.ok, text: r.message ?? '' });
      if (r.ok) {
        // Schlüssel nie im Formular stehen lassen
        setDraft(null);
        setModels([]);
        router.refresh();
      }
    });

  const remove = (id: string, name: string) =>
    start(async () => {
      const r = await deleteOllamaEndpoint(guildId, id);
      setMsg({ ok: r.ok, text: r.ok ? `„${name}“ entfernt. ${r.message ?? ''}` : (r.message ?? '') });
      if (r.ok) router.refresh();
    });

  return (
    <section className="card grid min-w-0 gap-4 p-5 text-sm" aria-labelledby="ollama-title">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-2xl" aria-hidden>
          🦙
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="ollama-title" className="font-semibold">
            Ollama – eigene Endpunkte
          </h2>
          <p className="text-fog-300">Lokal im Heimnetz (kostenlos), hinter einem Proxy oder Ollama Cloud – über die Standard-Schnittstelle /api/chat.</p>
        </div>
        <span className={`chip ${endpoints.length ? 'bg-sea-400/15 text-sea-400' : 'bg-sun-400/15 text-sun-400'}`}>{endpoints.length ? `${endpoints.length} verbunden` : 'fehlt'}</span>
      </div>

      {endpoints.length > 0 && (
        <ul className="grid gap-2" aria-label="Ollama-Endpunkte">
          {endpoints.map((e) => (
            <li key={e.id} className="grid min-w-0 gap-2 rounded-xl border border-ink-700 px-4 py-3 sm:flex sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {e.name} {e.hasKey && <span title="mit API-Schlüssel">🔒</span>}
                </p>
                <p className="truncate font-mono text-xs text-fog-300" title={e.url}>
                  {e.model} · {e.url}
                </p>
                <p className="text-xs text-fog-500">
                  Im Speicher: {e.keepAlive === '-1' ? 'immer' : e.keepAlive} · Kontext: {e.numCtx ? `${e.numCtx.toLocaleString('de-DE')} Tokens` : 'Standard'} · Denken: {OLLAMA_THINK_LABELS[e.think]}
                </p>
              </div>
              {isAdmin && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={pending} onClick={() => (setDraft(fromEndpoint(e)), setModels([]), setMsg(null))}>
                    Bearbeiten
                  </button>
                  <button type="button" className="btn-ghost px-3 py-1.5 text-xs text-danger-500" disabled={pending} onClick={() => remove(e.id, e.name)} aria-label={`${e.name} entfernen`}>
                    Entfernen
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!isAdmin ? (
        <p className="rounded-lg border border-ink-700 px-3 py-2 text-fog-300">Endpunkte einrichten kann nur der Instanz-Admin (wer Moin_Julia installiert hat).</p>
      ) : draft ? (
        <div className="grid min-w-0 gap-4 rounded-xl border border-dashed border-ink-600 p-4">
          <p className="font-semibold">{draft.id ? `„${draft.name}“ bearbeiten` : 'Neuer Endpunkt'}</p>
          {!draft.id && (
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => set(p.draft)}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <fieldset disabled={pending} className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="grid min-w-0 gap-1.5">
              <span className="font-semibold">Name</span>
              <input value={draft.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} placeholder="z. B. Gaming-PC" className="input" />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="font-semibold">Adresse</span>
              <input value={draft.url} maxLength={300} onChange={(e) => set({ url: e.target.value })} placeholder="http://192.168.1.20:11434" spellCheck={false} inputMode="url" className="input font-mono" />
            </label>
            <label className="grid min-w-0 gap-1.5 sm:col-span-2">
              <span className="font-semibold">API-Schlüssel (nur für Ollama Cloud oder geschützte Proxys)</span>
              <input
                type="password"
                autoComplete="new-password"
                value={draft.apiKey}
                onChange={(e) => set({ apiKey: e.target.value })}
                placeholder={draft.hasKey ? '•••• gespeichert – leer lassen zum Behalten' : 'leer lassen, wenn nicht nötig'}
                className="input font-mono"
              />
              {draft.hasKey && (
                <span className="flex items-center gap-2 text-xs text-fog-500">
                  <input type="checkbox" checked={!draft.keepKey} onChange={(e) => set({ keepKey: !e.target.checked })} className="size-4 accent-coral-500" />
                  gespeicherten Schlüssel entfernen
                </span>
              )}
            </label>
            <div className="grid min-w-0 gap-1.5 sm:col-span-2">
              <span className="font-semibold">Modell</span>
              <div className="flex min-w-0 flex-wrap gap-2">
                <input
                  aria-label="Modell"
                  list="ollama-models"
                  value={draft.model}
                  onChange={(e) => set({ model: e.target.value.trim() })}
                  placeholder="llama3.2"
                  spellCheck={false}
                  className="input min-w-0 flex-1 font-mono"
                />
                <datalist id="ollama-models">
                  {models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <button type="button" className="btn-ghost" onClick={loadModels} disabled={!draft.url.trim()}>
                  Modelle laden
                </button>
              </div>
              {models.length > 0 && (
                <div className="flex flex-wrap gap-1.5" aria-label="Gefundene Modelle">
                  {models.slice(0, 20).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={draft.model === m}
                      onClick={() => set({ model: m })}
                      className={`rounded-full border px-2.5 py-1 font-mono text-xs ${draft.model === m ? 'border-coral-500 bg-coral-500/15 text-coral-400' : 'border-ink-700 text-fog-300 hover:border-ink-600'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </fieldset>

          <details className="rounded-lg border border-ink-700 px-4 py-3">
            <summary className="cursor-pointer font-semibold">⚡ Leistung (für schnellere Antworten)</summary>
            <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-3">
              <label className="grid min-w-0 gap-1.5">
                <span className="text-fog-300">Im Speicher halten</span>
                <input value={draft.keepAlive} onChange={(e) => set({ keepAlive: e.target.value })} placeholder="30m" spellCheck={false} className="input font-mono" />
                <span className="text-xs text-fog-500">z. B. 30m, 2h oder -1 = immer. Spart das Neu-Laden (oft 5–30 s) bei der nächsten Frage.</span>
              </label>
              <label className="grid min-w-0 gap-1.5">
                <span className="text-fog-300">Kontextgröße (Tokens)</span>
                <input value={draft.numCtx} onChange={(e) => set({ numCtx: e.target.value.replace(/[^\d]/g, '').slice(0, 6) })} inputMode="numeric" className="input font-mono" />
                <span className="text-xs text-fog-500">0 = Standard des Modells. Größer = mehr Verlauf, aber mehr Speicher.</span>
              </label>
              <label className="grid min-w-0 gap-1.5">
                <span className="text-fog-300">Denk-Modus</span>
                <select value={draft.think} onChange={(e) => set({ think: e.target.value as OllamaThink })} className="input">
                  {OLLAMA_THINK.map((t) => (
                    <option key={t} value={t}>
                      {OLLAMA_THINK_LABELS[t]}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-fog-500">Für Denk-Modelle (qwen3, deepseek-r1, gpt-oss). „Aus“ antwortet deutlich schneller.</span>
              </label>
            </div>
          </details>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" disabled={pending || !draft.name.trim() || !draft.url.trim() || !draft.model.trim()} onClick={save}>
              {pending ? 'Prüfe …' : 'Prüfen und speichern'}
            </button>
            {endpoints.length > 0 && (
              <button type="button" className="btn-ghost" disabled={pending} onClick={() => (setDraft(null), setModels([]), setMsg(null))}>
                Abbrechen
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <button type="button" className="btn-ghost" onClick={() => (setDraft({ ...EMPTY }), setMsg(null))} disabled={endpoints.length >= 10}>
            + Endpunkt hinzufügen
          </button>
        </div>
      )}
      {msg && (
        <p role="status" className={msg.ok ? 'text-sea-400' : 'text-danger-500'}>
          {msg.text}
        </p>
      )}

      <details className="rounded-lg border border-ink-700 px-4 py-3">
        <summary className="cursor-pointer font-semibold">Anleitung: Ollama einrichten und mit der Grafikkarte beschleunigen</summary>
        <ol className="mt-2 grid list-decimal gap-2 pl-5 text-fog-300">
          <li>
            Auf einem Rechner mit Grafikkarte (oder einem eigenen Proxmox-Container): <code>curl -fsSL https://ollama.com/install.sh | sh</code> – Ollama nutzt NVIDIA (CUDA), AMD (ROCm) und viele andere Karten (Vulkan) automatisch.
          </li>
          <li>
            Modell laden: <code>ollama pull llama3.2</code> (klein, 2 GB) oder <code>ollama pull qwen3:8b</code> (besser, 5 GB). Prüfen, ob die GPU genutzt wird: <code>ollama ps</code> → Spalte „PROCESSOR“ zeigt „100% GPU“.
          </li>
          <li>
            Im Netzwerk freigeben: <code>systemctl edit ollama</code> → <code>Environment=&quot;OLLAMA_HOST=0.0.0.0&quot;</code>, dann <code>systemctl restart ollama</code>.
          </li>
          <li>
            Ollama Cloud: unter <code>ollama.com</code> → Einstellungen → API-Schlüssel erstellen, hier „☁️ Ollama Cloud“ wählen und den Schlüssel einfügen.
          </li>
        </ol>
      </details>
    </section>
  );
}
