'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { resetAllXp, setMemberXp } from '@/app/g/[guildId]/level/actions';

/** XP eines Mitglieds direkt setzen */
export function XpEditButton({ guildId, userId, xp }: { guildId: string; userId: string; xp: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(xp));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" className="text-xs text-fog-500 underline hover:text-fog-100" onClick={() => setOpen(true)}>
        XP ändern
      </button>
    );
  return (
    <span className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <input aria-label="Neue XP" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className="input w-32 py-1.5" />
      <button
        type="button"
        className="btn-ghost py-1.5"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setMemberXp(guildId, userId, Number(value));
            setMessage({ ok: r.ok, text: r.message ?? '' });
            if (r.ok) {
              setOpen(false);
              router.refresh();
            }
          })
        }
      >
        {pending ? '…' : 'Setzen'}
      </button>
      {message && <span className={`text-xs ${message.ok ? 'text-sea-400' : 'text-danger-500'}`}>{message.text}</span>}
    </span>
  );
}

/** Alle XP löschen – mit Bestätigungswort */
export function ResetXp({ guildId }: { guildId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <details className="card p-5 text-sm">
      <summary className="cursor-pointer font-semibold text-danger-500">Alle XP zurücksetzen …</summary>
      <div className="mt-3 grid gap-3">
        <p className="text-fog-300">Löscht die XP aller Mitglieder auf diesem Server. Das lässt sich nicht rückgängig machen. Zum Bestätigen ZURÜCKSETZEN eintippen.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="Bestätigung" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="ZURÜCKSETZEN" className="input max-w-xs" />
          <button
            type="button"
            className="btn-ghost text-danger-500"
            disabled={pending || confirm.trim().toUpperCase() !== 'ZURÜCKSETZEN'}
            onClick={() =>
              start(async () => {
                const r = await resetAllXp(guildId, confirm);
                setMessage({ ok: r.ok, text: r.message ?? '' });
                if (r.ok) router.refresh();
              })
            }
          >
            Endgültig zurücksetzen
          </button>
        </div>
        {message && <p className={message.ok ? 'text-sea-400' : 'text-danger-500'}>{message.text}</p>}
      </div>
    </details>
  );
}
