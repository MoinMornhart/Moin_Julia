'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { claimInstanceAdmin } from '@/app/system/actions';

/** Erster Schritt auf der System-Seite, solange es noch keinen Instanz-Admin gibt. */
export function ClaimAdminForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <form
      className="card grid max-w-xl gap-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await claimInstanceAdmin(code);
          if (r.ok) router.refresh();
          else setError(r.messages[0]);
        });
      }}
    >
      <div>
        <h2 className="font-display text-xl font-semibold">Instanz-Admin werden</h2>
        <p className="mt-1 text-sm text-fog-300">
          Noch niemand verwaltet diese Installation. Gib den Einrichtungs-Code ein – im Container zeigt ihn <code>moin-julia setup-code</code> an.
          Danach kannst du hier Bot-Token, Adresse und Schlüssel ändern.
        </p>
      </div>
      <input id="claimCode" value={code} onChange={(e) => setCode(e.target.value)} placeholder="MOIN-XXXX-XXXX" autoComplete="off" spellCheck={false} className="input font-mono" />
      {error && <p className="rounded-lg bg-danger-500/10 px-3 py-2 text-sm">❌ {error}</p>}
      <button className="btn-primary w-fit" disabled={pending || !code.trim()}>
        {pending ? 'Prüfe …' : 'Admin werden'}
      </button>
    </form>
  );
}
