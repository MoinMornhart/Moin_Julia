'use client';

import { useActionState, useState, useTransition } from 'react';
import { removeConnection, saveAnthropicKey } from '@/app/g/[guildId]/julia/actions';
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
