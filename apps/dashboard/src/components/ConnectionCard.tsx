'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { PLATFORM_LABELS } from '@moin/shared';
import { removeConnection, removeServerConnection, saveConnection, saveServerConnection } from '@/app/g/[guildId]/alerts/actions';
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
  scope = 'instance',
}: {
  guildId: string;
  platform: 'twitch' | 'kick';
  isAdmin: boolean;
  clientId: string | null;
  secret: string | null;
  steps: React.ReactNode[];
  /** instance = für alle Server (nur Instanz-Admin); server = eigene App nur für diesen Server (Server-Admins) */
  scope?: 'instance' | 'server';
}) {
  const save = scope === 'server' ? saveServerConnection : saveConnection;
  const remove = scope === 'server' ? removeServerConnection : removeConnection;
  const connected = !!(clientId && secret);
  // Eigene Server-App ist freiwillig – darum zugeklappt starten
  const [open, setOpen] = useState(scope === 'server' ? false : !connected);
  // Nur die neueste Meldung (Speichern ODER Entfernen); Secret-Feld nach Erfolg leeren
  const [last, setLast] = useState<ActionResult | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [, action, pending] = useActionState<ActionResult | null, FormData>(async (_p, form) => {
    const result = await save(guildId, platform, form);
    setLast(result);
    if (result.ok) setInputKey((k) => k + 1);
    return result;
  }, null);
  const [removing, startRemove] = useTransition();
  useEffect(() => setOpen(scope === 'server' ? false : !connected), [connected, scope]);
  const label = PLATFORM_LABELS[platform];

  return (
    <div className="card grid gap-4 p-5 text-sm">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-2xl" aria-hidden>
          {ICON[platform]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{scope === 'server' ? `Eigene ${label}-App nur für diesen Server` : label}</p>
          <p className="text-fog-300">
            {connected
              ? `Verbunden (Client-ID ${clientId?.slice(0, 6)}…)`
              : scope === 'server'
                ? 'Freiwillig – ohne eigene App gilt die Verbindung der Instanz (oben).'
                : 'Noch nicht verbunden – einmalig einrichten, dann laufen alle Live-Meldungen.'}
          </p>
        </div>
        <span className={`chip ${connected ? 'bg-sea-400/15 text-sea-400' : scope === 'server' ? 'bg-ink-800 text-fog-500' : 'bg-sun-400/15 text-sun-400'}`}>
          {connected ? 'verbunden' : scope === 'server' ? 'optional' : 'fehlt'}
        </span>
        {(connected || scope === 'server') && isAdmin && (
          <button type="button" className="text-xs text-fog-500 underline" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? 'zuklappen' : connected ? 'ändern' : 'einrichten'}
          </button>
        )}
      </div>
      {open && !isAdmin && (
        <p className="rounded-lg border border-ink-700 px-3 py-2 text-fog-300">
          {scope === 'server' ? 'Das können Owner und Admins dieses Servers einrichten.' : 'Das kann nur der Instanz-Admin einrichten (wer Moin_Julia installiert hat).'}
        </p>
      )}
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
              <input key={inputKey} name="clientSecret" type="password" placeholder={secret ? 'leer lassen = unverändert' : ''} autoComplete="new-password" className="input font-mono" />
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
                onClick={() => startRemove(async () => setLast(await remove(guildId, platform)))}
              >
                Verbindung entfernen
              </button>
            )}
          </div>
        </KeepForm>
      )}
      {last?.message && <p className={`text-sm ${last.ok ? 'text-sea-400' : 'text-danger-500'}`}>{last.message}</p>}
    </div>
  );
}
