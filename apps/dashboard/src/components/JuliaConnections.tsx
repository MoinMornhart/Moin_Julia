'use client';

import { useActionState, useState, useTransition } from 'react';
import { removeConnection, saveAnthropicKey, saveOllama } from '@/app/g/[guildId]/julia/actions';
import type { ActionResult } from '@/app/g/[guildId]/actions';
import { KeepForm } from './KeepForm';

function Status({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`chip ${ok ? 'bg-sea-400/15 text-sea-400' : 'bg-sun-400/15 text-sun-400'}`}>{ok ? label : 'fehlt'}</span>;
}

function Message({ result }: { result: ActionResult | null }) {
  return result?.message ? <p className={`text-sm ${result.ok ? 'text-sea-400' : 'text-danger-500'}`}>{result.message}</p> : null;
}

/** Claude per API-Schlüssel – mit Erklärung, warum das Abo nicht geht */
export function ClaudeConnection({ guildId, isAdmin, masked }: { guildId: string; isAdmin: boolean; masked: string | null }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>((_p, form) => saveAnthropicKey(guildId, form), null);
  const [removed, setRemoved] = useState<ActionResult | null>(null);
  const [removing, start] = useTransition();
  const [open, setOpen] = useState(!masked);
  return (
    <div className="card grid gap-4 p-5 text-sm">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-2xl" aria-hidden>
          🤖
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Claude (Anthropic)</p>
          <p className="text-fog-300">{masked ? `Schlüssel ${masked}` : 'Klügste Antworten · Prepaid, ab ca. 0,1 Cent pro Antwort mit Haiku'}</p>
        </div>
        <Status ok={!!masked} label="verbunden" />
        {masked && isAdmin && (
          <button type="button" className="text-xs text-fog-500 underline" onClick={() => setOpen(!open)}>
            {open ? 'zuklappen' : 'ändern'}
          </button>
        )}
      </div>
      {open && (
        <>
          <details className="rounded-lg border border-ink-700 px-4 py-3">
            <summary className="cursor-pointer font-semibold">Warum nicht einfach mein Claude-Abo?</summary>
            <p className="mt-2 text-fog-300">
              Ein claude.ai-Abo (Pro/Max) gilt nur für dich persönlich in der Claude-App. Anthropic erlaubt nicht, es für Bots oder andere Programme zu nutzen – dafür gibt es die
              API mit eigenem Schlüssel. Die API rechnet nach Verbrauch ab (Guthaben vorher aufladen), und Moin_Julia stoppt am eingestellten Monatsbudget. Komplett kostenlos geht
              es mit Ollama (unten).
            </p>
          </details>
          {isAdmin ? (
            <KeepForm action={action} className="grid gap-4">
              <ol className="grid list-decimal gap-2 pl-5 text-fog-300">
                <li>
                  Bei{' '}
                  <a href="https://console.anthropic.com/" target="_blank" rel="noopener" className="text-coral-400 underline">
                    console.anthropic.com
                  </a>{' '}
                  anmelden (oder Konto anlegen).
                </li>
                <li>
                  Unter <b>Billing</b> Guthaben aufladen – 5 $ reichen mit Haiku für tausende Antworten. Tipp: dort auch ein <b>Spend limit</b> setzen.
                </li>
                <li>
                  Unter <b>API Keys</b> → <b>Create Key</b>, Name z. B. „Moin Julia“ → Schlüssel kopieren (beginnt mit <code>sk-ant-</code>, wird nur einmal angezeigt).
                </li>
                <li>Hier einfügen und „Prüfen und speichern“ – fertig.</li>
              </ol>
              <fieldset disabled={pending} className="grid gap-1.5">
                <label htmlFor="apiKey" className="font-semibold">
                  API-Schlüssel
                </label>
                <input id="apiKey" name="apiKey" type="password" autoComplete="new-password" placeholder="sk-ant-…" className="input font-mono" />
              </fieldset>
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className="btn-primary" disabled={pending}>
                  {pending ? 'Prüfe …' : 'Prüfen und speichern'}
                </button>
                {masked && (
                  <button type="button" className="text-xs text-fog-500 hover:text-danger-500" disabled={removing} onClick={() => start(async () => setRemoved(await removeConnection(guildId, 'anthropic')))}>
                    Schlüssel entfernen
                  </button>
                )}
                <Message result={state ?? removed} />
              </div>
            </KeepForm>
          ) : (
            <p className="rounded-lg border border-ink-700 px-3 py-2 text-fog-300">Das kann nur der Instanz-Admin einrichten (wer Moin_Julia installiert hat).</p>
          )}
        </>
      )}
    </div>
  );
}

/** Ollama – lokale KI ohne Schlüssel */
export function OllamaConnection({ guildId, isAdmin, url, model }: { guildId: string; isAdmin: boolean; url: string | null; model: string | null }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>((_p, form) => saveOllama(guildId, form), null);
  const [removed, setRemoved] = useState<ActionResult | null>(null);
  const [removing, start] = useTransition();
  const connected = !!(url && model);
  const [open, setOpen] = useState(!connected);
  return (
    <div className="card grid gap-4 p-5 text-sm">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-2xl" aria-hidden>
          🦙
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Ollama (lokal, kostenlos)</p>
          <p className="text-fog-300">{connected ? `${model} auf ${url}` : 'Ohne Schlüssel, ohne Kosten – braucht einen Rechner mit genug RAM (ab ca. 8 GB)'}</p>
        </div>
        <Status ok={connected} label="verbunden" />
        {connected && isAdmin && (
          <button type="button" className="text-xs text-fog-500 underline" onClick={() => setOpen(!open)}>
            {open ? 'zuklappen' : 'ändern'}
          </button>
        )}
      </div>
      {open &&
        (isAdmin ? (
          <KeepForm action={action} className="grid gap-4">
            <ol className="grid list-decimal gap-2 pl-5 text-fog-300">
              <li>
                Auf einem Rechner im Heimnetz (z. B. eigener Proxmox-Container): <code>curl -fsSL https://ollama.com/install.sh | sh</code>
              </li>
              <li>
                Modell laden: <code>ollama pull llama3.2</code> (klein, 2 GB) oder <code>ollama pull qwen2.5:7b</code> (besser, 5 GB).
              </li>
              <li>
                Im Netzwerk freigeben: <code>systemctl edit ollama</code> → <code>Environment=&quot;OLLAMA_HOST=0.0.0.0&quot;</code>, dann <code>systemctl restart ollama</code>.
              </li>
              <li>Adresse und Modell hier eintragen – Moin_Julia prüft sofort, ob alles passt.</li>
            </ol>
            <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="font-semibold">Adresse</span>
                <input name="url" defaultValue={url ?? ''} placeholder="http://192.168.1.20:11434" spellCheck={false} className="input font-mono" />
              </label>
              <label className="grid gap-1.5">
                <span className="font-semibold">Modell</span>
                <input name="model" defaultValue={model ?? 'llama3.2'} spellCheck={false} className="input font-mono" />
              </label>
            </fieldset>
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn-primary" disabled={pending}>
                {pending ? 'Prüfe …' : 'Prüfen und speichern'}
              </button>
              {connected && (
                <button type="button" className="text-xs text-fog-500 hover:text-danger-500" disabled={removing} onClick={() => start(async () => setRemoved(await removeConnection(guildId, 'ollama')))}>
                  Verbindung entfernen
                </button>
              )}
              <Message result={state ?? removed} />
            </div>
          </KeepForm>
        ) : (
          <p className="rounded-lg border border-ink-700 px-3 py-2 text-fog-300">Das kann nur der Instanz-Admin einrichten.</p>
        ))}
    </div>
  );
}
