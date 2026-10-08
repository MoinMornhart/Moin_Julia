'use client';

import { useActionState, useState, useTransition } from 'react';
import { PLATFORM_LABELS } from '@moin/shared';
import { removeConnection, saveConnection } from '@/app/g/[guildId]/alerts/actions';
import type { ActionResult } from '@/app/g/[guildId]/actions';
import { KeepForm } from './KeepForm';

const ICON = { twitch: '🟣', kick: '🟢' };

/** Twitch/Kick verbinden: Schritt-für-Schritt-Anleitung + Client-ID/Secret mit Live-Prüfung */
export function ConnectionCard({
  guildId,
  platform,
  isAdmin,
  clientId,
  secret,
  steps,
}: {
  guildId: string;
  platform: 'twitch' | 'kick';
  isAdmin: boolean;
  clientId: string | null;
  secret: string | null;
  steps: React.ReactNode[];
}) {
  const connected = !!(clientId && secret);
  const [open, setOpen] = useState(!connected);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>((_p, form) => saveConnection(guildId, platform, form), null);
  const [removing, startRemove] = useTransition();
  const [removed, setRemoved] = useState<ActionResult | null>(null);
  const label = PLATFORM_LABELS[platform];

  return (
    <div className="card grid gap-4 p-5 text-sm">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-2xl" aria-hidden>
          {ICON[platform]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{label}</p>
          <p className="text-fog-300">{connected ? `Verbunden (Client-ID ${clientId?.slice(0, 6)}…)` : 'Noch nicht verbunden – einmalig einrichten, dann laufen alle Live-Meldungen.'}</p>
        </div>
        <span className={`chip ${connected ? 'bg-sea-400/15 text-sea-400' : 'bg-sun-400/15 text-sun-400'}`}>{connected ? 'verbunden' : 'fehlt'}</span>
        {connected && isAdmin && (
          <button type="button" className="text-xs text-fog-500 underline" onClick={() => setOpen(!open)}>
            {open ? 'zuklappen' : 'ändern'}
          </button>
        )}
      </div>
      {open && !isAdmin && <p className="rounded-lg border border-ink-700 px-3 py-2 text-fog-300">Das kann nur der Instanz-Admin einrichten (wer Moin_Julia installiert hat).</p>}
      {open && isAdmin && (
        <KeepForm action={action} className="grid gap-4">
          <ol className="grid list-decimal gap-2 pl-5 text-fog-300">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="font-semibold">Client-ID</span>
              <input name="clientId" defaultValue={clientId ?? ''} spellCheck={false} autoComplete="off" className="input font-mono" />
            </label>
            <label className="grid gap-1.5">
              <span className="font-semibold">
                Client-Secret <span className="ml-1 font-mono text-xs font-normal text-fog-500">{secret ?? ''}</span>
              </span>
              <input name="clientSecret" type="password" placeholder={secret ? 'leer lassen = unverändert' : ''} autoComplete="new-password" className="input font-mono" />
            </label>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? 'Prüfe …' : 'Prüfen und speichern'}
            </button>
            {connected && (
              <button
                type="button"
                className="text-xs text-fog-500 hover:text-danger-500"
                disabled={removing}
                onClick={() => startRemove(async () => setRemoved(await removeConnection(guildId, platform)))}
              >
                Verbindung entfernen
              </button>
            )}
            {(state ?? removed)?.message && <p className={`text-sm ${(state ?? removed)?.ok ? 'text-sea-400' : 'text-danger-500'}`}>{(state ?? removed)?.message}</p>}
          </div>
        </KeepForm>
      )}
    </div>
  );
}
