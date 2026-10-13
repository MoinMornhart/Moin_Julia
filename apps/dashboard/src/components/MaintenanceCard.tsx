'use client';

import { useState, useTransition } from 'react';
import { setMaintenanceMode } from '@/app/system/actions';

/** System → Wartung: Bot und Webseite vorübergehend „offline“ nehmen */
export function MaintenanceCard({ initial }: { initial: { on: boolean; message: string; since: string | null } }) {
  const [on, setOn] = useState(initial.on);
  const [message, setMessage] = useState(initial.message);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const toggle = (next: boolean) =>
    start(async () => {
      const r = await setMaintenanceMode(next, message);
      setResult({ ok: r.ok, text: r.messages.join(' ') });
      if (r.ok) setOn(next);
    });

  return (
    <section className={`card mt-8 grid gap-4 p-6 text-sm ${on ? 'border-sun-400/60' : ''}`} aria-labelledby="maint-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="maint-title" className="font-display text-lg font-semibold">
            🛠️ Wartungsmodus {on && <span className="ml-2 rounded-full bg-sun-400/20 px-2.5 py-0.5 align-middle text-xs text-sun-400">aktiv{initial.since && initial.on ? ` seit ${initial.since}` : ''}</span>}
          </h2>
          <p className="mt-1 text-fog-300">
            Nimmt Bot und Webseite vorübergehend vom Netz: Alle sehen eine Wartungsseite – nur du kommst weiter rein, um es wieder auszuschalten. Der Bot erscheint
            offline, Befehle antworten mit „Wartung“, Julia, Musik und regelmäßige Meldungen pausieren. Server-Schutz und Moderation laufen sicherheitshalber weiter.
          </p>
        </div>
      </div>
      <label className="grid max-w-xl gap-1.5">
        <span className="font-semibold">Hinweis für alle (optional)</span>
        <input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} placeholder="z. B. Update läuft – um 20 Uhr wieder da" className="input" disabled={pending} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        {on ? (
          <button type="button" className="btn-primary" disabled={pending} onClick={() => toggle(false)}>
            {pending ? '…' : '✅ Wartung beenden – wieder online'}
          </button>
        ) : (
          <button type="button" className="btn-ghost border-sun-400/60" disabled={pending} onClick={() => toggle(true)}>
            {pending ? '…' : '🛠️ Wartung starten (offline nehmen)'}
          </button>
        )}
        {on && (
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => toggle(true)} title="Nur den Hinweistext ändern">
            Hinweis aktualisieren
          </button>
        )}
      </div>
      {result && <p role="status" className={result.ok ? 'text-sea-400' : 'text-danger-400'}>{result.text}</p>}
    </section>
  );
}
