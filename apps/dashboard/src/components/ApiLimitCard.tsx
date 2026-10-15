'use client';

import { useState, useTransition } from 'react';
import { saveApiLimit } from '@/app/system/actions';

/**
 * API-Kostenlimit (Wunsch Philip, 15.10.): Monatsgrenze in Euro für den KI-Schlüssel der Instanz.
 * Zählt nur Anfragen über diesen Schlüssel – Server mit eigenem Schlüssel zahlen selbst.
 */
export function ApiLimitCard({ initial }: { initial: { limitEur: number; spent: string; percent: number; requests: number; usdPerEur: number } }) {
  const [value, setValue] = useState(initial.limitEur ? String(initial.limitEur).replace('.', ',') : '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const bar = initial.percent >= 100 ? 'bg-danger-500' : initial.percent >= 80 ? 'bg-sun-400' : 'bg-sea-500';
  return (
    <section className="card mt-8 grid gap-3 p-6 text-sm" aria-labelledby="apilimit-title">
      <div>
        <h2 id="apilimit-title" className="font-display text-lg font-semibold">
          💸 API-Limit
        </h2>
        <p className="mt-1 text-fog-300">
          Höchstens so viel darf Julia im Monat über <b>deinen</b> KI-Schlüssel kosten. Ist es erreicht, antwortet sie damit erst nächsten Monat wieder – Server mit eigenem
          Schlüssel laufen weiter. Ab 80 % und bei 100 % bekommst du eine DM.
        </p>
      </div>
      <p>
        Diesen Monat: <b>{initial.spent}</b> ({initial.requests.toLocaleString('de-DE')} Anfragen){initial.limitEur > 0 ? <> von {initial.limitEur.toLocaleString('de-DE')} €</> : ' – kein Limit gesetzt'}
      </p>
      {initial.limitEur > 0 && (
        <div className="h-2 overflow-hidden rounded-full bg-ink-800" role="progressbar" aria-label="API-Limit verbraucht" aria-valuenow={initial.percent} aria-valuemin={0} aria-valuemax={100}>
          <i className={`block h-full ${bar}`} style={{ width: `${initial.percent}%` }} />
        </div>
      )}
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveApiLimit(value);
            setMsg({ ok: r.ok, text: r.messages.join(' ') });
          });
        }}
      >
        <label className="grid gap-1">
          <span className="font-semibold">Limit pro Monat (€)</span>
          <input className="input w-36" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="z. B. 80" aria-label="API-Limit in Euro" disabled={pending} />
        </label>
        <button type="submit" className="btn-primary" disabled={pending}>
          Speichern
        </button>
        <span className="text-xs text-fog-500">Leer oder 0 = kein Limit. Umgerechnet mit 1 € = {initial.usdPerEur.toLocaleString('de-DE')} $ (Anthropic rechnet in Dollar).</span>
      </form>
      {msg && (
        <p role="status" className={msg.ok ? 'text-sea-400' : 'text-danger-500'}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
