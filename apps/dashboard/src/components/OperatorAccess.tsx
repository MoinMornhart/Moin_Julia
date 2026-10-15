'use client';

import { useState, useTransition } from 'react';
import { denyOperatorRequest, grantOperator, revokeOperator, setOperatorBlocked } from '@/app/g/[guildId]/einstellungen/actions';

const DURATIONS = [
  { value: '1h', label: '1 Stunde' },
  { value: '24h', label: '24 Stunden' },
  { value: '7d', label: '7 Tage' },
  { value: 'immer', label: 'für immer (bis zum Widerruf)' },
];

export interface OperatorAccessView {
  grant: { scopes: string; until: string; by: string; reason: string | null } | null;
  request: { by: string; reason: string; scopes: string[]; scopesText: string; at: string } | null;
  blocked: boolean;
}

/**
 * Betreiber-Zugang (Issue #13): Owner/Admin sehen, ob der Bot-Betreiber Zugang hat, geben frei (Umfang, Dauer),
 * entziehen ihn oder sperren den Betreiber ganz. Ohne Freigabe sieht der Betreiber nichts von diesem Server.
 */
export function OperatorAccess({ guildId, canManage, view }: { guildId: string; canManage: boolean; view: OperatorAccessView }) {
  const [read, setRead] = useState(view.request ? view.request.scopes.includes('lesen') : true);
  const [dash, setDash] = useState(view.request ? view.request.scopes.includes('dashboard') : false);
  const [duration, setDuration] = useState('24h');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.message });
    });

  return (
    <section id="betreiber" className="card mt-6 grid max-w-4xl gap-4 p-6" aria-label="Betreiber-Zugang">
      <div>
        <h2 className="font-display text-lg font-semibold">🔑 Betreiber-Zugang</h2>
        <p className="mt-1 text-sm text-fog-300">
          Der Betreiber dieses Bots (wer Moin_Julia installiert hat) sieht <b>nichts</b> von deinem Server, solange du es nicht erlaubst. Du entscheidest, wofür und wie lange – und
          kannst ihn jederzeit wieder aussperren.
        </p>
      </div>

      {view.blocked ? (
        <p className="rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm">🚫 Der Betreiber ist gesperrt: kein Zugang, keine Anfragen.</p>
      ) : view.grant ? (
        <p className="rounded-xl border border-sun-400/40 bg-sun-400/10 px-4 py-3 text-sm">
          ✅ Zugang erteilt: <b>{view.grant.scopes}</b>, {view.grant.until} (von {view.grant.by}){view.grant.reason ? <> · Begründung: „{view.grant.reason}“</> : null}
        </p>
      ) : (
        <p className="rounded-xl border border-ink-700 px-4 py-3 text-sm text-fog-300">🔒 Kein Zugang – der Betreiber sieht nichts von diesem Server.</p>
      )}

      {view.request && !view.blocked && (
        <div className="rounded-xl border border-coral-500/40 bg-coral-500/10 px-4 py-3 text-sm">
          🙋 <b>Anfrage vom {view.request.at}</b> für {view.request.scopesText}
          <br />
          Begründung: „{view.request.reason}“
        </div>
      )}

      {canManage ? (
        <div className="grid gap-3 text-sm">
          {!view.blocked && (
            <div className="flex flex-wrap items-end gap-4">
              <fieldset className="flex flex-wrap gap-4">
                <legend className="mb-1 font-semibold">Erlauben</legend>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} disabled={pending} /> 👀 Kanäle mitlesen
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={dash} onChange={(e) => setDash(e.target.checked)} disabled={pending} /> ⚙️ Dashboard verwalten
                </label>
              </fieldset>
              <label className="grid gap-1">
                <span className="font-semibold">Wie lange?</span>
                <select className="input w-auto" value={duration} onChange={(e) => setDuration(e.target.value)} disabled={pending} aria-label="Dauer">
                  {DURATIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="btn-primary" disabled={pending || (!read && !dash)} onClick={() => run(() => grantOperator(guildId, [...(read ? ['lesen'] : []), ...(dash ? ['dashboard'] : [])], duration))}>
                ✅ Freigeben
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {view.grant && (
              <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => revokeOperator(guildId))}>
                Zugang entziehen
              </button>
            )}
            {view.request && !view.blocked && (
              <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => denyOperatorRequest(guildId))}>
                ❌ Anfrage ablehnen
              </button>
            )}
            <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => setOperatorBlocked(guildId, !view.blocked))}>
              {view.blocked ? 'Sperre aufheben' : '🚫 Betreiber sperren'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-fog-500">Ändern können nur Owner und Admins dieses Servers.</p>
      )}
      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? 'text-sea-400' : 'text-danger-500'}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
