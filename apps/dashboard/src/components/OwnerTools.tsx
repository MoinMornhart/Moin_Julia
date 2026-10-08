'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addOwnerChannel, replaceAdministrator, saveOwnerSettings } from '@/app/g/[guildId]/owner/actions';

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, refreshAfter = 2500) =>
    start(async () => {
      const r = await fn();
      setMessage({ ok: r.ok, text: r.message ?? '' });
      if (r.ok) setTimeout(() => router.refresh(), refreshAfter);
    });
  return { pending, message, run };
}

const Msg = ({ m }: { m: { ok: boolean; text: string } | null }) => (m ? <p className={`text-sm ${m.ok ? 'text-sea-400' : 'text-danger-500'}`}>{m.text}</p> : null);

export function AddOwnerChannel({ guildId }: { guildId: string }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'text' | 'voice'>('text');
  const { pending, message, run } = useRun();
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <select aria-label="Kanal-Art" value={kind} onChange={(e) => setKind(e.target.value as 'text' | 'voice')} className="input w-auto">
          <option value="text"># Text</option>
          <option value="voice">🔊 Sprache</option>
        </select>
        <input aria-label="Name des neuen Kanals" value={name} maxLength={90} onChange={(e) => setName(e.target.value)} placeholder="z. B. ideen, finanzen, privat" className="input min-w-0 flex-1" />
        <button type="button" className="btn-ghost" disabled={pending || !name.trim()} onClick={() => run(() => addOwnerChannel(guildId, name, kind))}>
          + Kanal
        </button>
      </div>
      <Msg m={message} />
    </div>
  );
}

export function OwnerSettings({ guildId, allowBots, notifyOwner }: { guildId: string; allowBots: boolean; notifyOwner: boolean }) {
  const [bots, setBots] = useState(allowBots);
  const [notify, setNotify] = useState(notifyOwner);
  const { pending, message, run } = useRun();
  return (
    <div className="grid gap-3 text-sm">
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={bots} onChange={(e) => setBots(e.target.checked)} className="mt-1 size-4 accent-coral-500" />
        <span>
          <b>Andere Bots dürfen mitlesen</b> (z. B. Log- oder Musik-Bots). Aus: nur du und Moin_Julia.
        </span>
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-1 size-4 accent-coral-500" />
        <span>
          <b>Mir eine DM schicken</b>, wenn jemand an den Rechten dreht (mit Namen laut Audit-Log).
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={pending} onClick={() => run(() => saveOwnerSettings(guildId, bots, notify), 800)}>
          Speichern
        </button>
        <Msg m={message} />
      </div>
    </div>
  );
}

/** „Administrator“ ersetzen – mit ausdrücklicher Bestätigung */
export function ReplaceAdminButton({ guildId, roleId, roleName }: { guildId: string; roleId: string; roleName: string }) {
  const [confirm, setConfirm] = useState(false);
  const { pending, message, run } = useRun();
  if (!confirm)
    return (
      <span className="grid gap-1">
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setConfirm(true)}>
          Administrator ersetzen …
        </button>
        <Msg m={message} />
      </span>
    );
  return (
    <span className="grid gap-2 rounded-xl border border-sun-400/40 bg-sun-400/10 p-3 text-xs">
      <span>
        <b>„{roleName}“</b> bekommt statt „Administrator“ <b>alle Einzelrechte</b> (Server verwalten, Kanäle, Rollen, Bannen …). Im Alltag ändert sich kaum etwas – aber die Rolle sieht den
        Owner-Bereich nicht mehr. Die alten Rechte werden gesichert und lassen sich hier jederzeit zurückholen.
      </span>
      <span className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary px-3 py-1.5 text-xs" disabled={pending} onClick={() => run(() => replaceAdministrator(guildId, roleId))}>
          Ja, umstellen
        </button>
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setConfirm(false)}>
          Abbrechen
        </button>
      </span>
      <Msg m={message} />
    </span>
  );
}
