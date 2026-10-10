'use client';

import { useState } from 'react';
import { LIMIT_PERIOD_LABELS, LIMIT_PERIODS, LIMIT_UNIT_LABELS, LIMIT_UNITS, type LimitOverride } from '@moin/shared';

/**
 * Ausnahmen vom Limit pro Person oder Rolle – z. B. „Max: 200 Antworten pro Stunde“, „Mods: unbegrenzt“.
 * Wird als JSON im Feld „limitOverrides“ mit dem Julia-Formular gespeichert.
 */
export function LimitOverridesEditor({ initial, roles }: { initial: LimitOverride[]; roles: { id: string; name: string }[] }) {
  const [list, setList] = useState<LimitOverride[]>(initial);
  const set = (i: number, patch: Partial<LimitOverride>) => setList(list.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const add = (kind: 'user' | 'role') =>
    setList([...list, { id: kind === 'role' ? (roles[0]?.id ?? '') : '', kind, name: '', amount: 200, unit: 'antworten', period: 'stunde', cooldownSeconds: 0 }]);

  return (
    <div className="grid gap-2 text-sm">
      <span className="font-semibold">Eigene Limits für einzelne Personen oder Rollen</span>
      <input type="hidden" name="limitOverrides" value={JSON.stringify(list.filter((o) => /^\d{15,22}$/.test(o.id)))} />
      {list.length === 0 && <p className="text-xs text-fog-500">Noch keine – alle haben das allgemeine Limit oben.</p>}
      <ul className="grid gap-2" aria-label="Limit-Ausnahmen">
        {list.map((o, i) => (
          <li key={i} className="grid gap-2 rounded-xl border border-ink-700 bg-ink-900 p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
            {o.kind === 'role' ? (
              <select aria-label={`Rolle ${i + 1}`} value={o.id} onChange={(e) => set(i, { id: e.target.value, name: roles.find((r) => r.id === e.target.value)?.name ?? '' })} className="input">
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    @{r.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                <input aria-label={`Discord-ID Person ${i + 1}`} value={o.id} onChange={(e) => set(i, { id: e.target.value.replace(/\D/g, '').slice(0, 22) })} placeholder="Discord-ID" inputMode="numeric" className="input font-mono" />
                <input aria-label={`Name Person ${i + 1}`} value={o.name} onChange={(e) => set(i, { name: e.target.value.slice(0, 60) })} placeholder="Name (Notiz)" className="input" />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label={`Menge ${i + 1}`}
                type="number"
                min={0}
                max={100000}
                value={o.amount}
                onChange={(e) => set(i, { amount: Math.max(0, Math.min(100_000, Math.round(Number(e.target.value) || 0))) })}
                className="input w-24 tabular-nums"
              />
              <select aria-label={`Einheit ${i + 1}`} value={o.unit} onChange={(e) => set(i, { unit: e.target.value as LimitOverride['unit'] })} className="input w-auto">
                {LIMIT_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {LIMIT_UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
              <span className="text-fog-500">pro</span>
              <select aria-label={`Zeitraum ${i + 1}`} value={o.period} onChange={(e) => set(i, { period: e.target.value as LimitOverride['period'] })} className="input w-auto">
                {LIMIT_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {LIMIT_PERIOD_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                aria-label={`Pause in Sekunden ${i + 1}`}
                title="Pause zwischen zwei Antworten (Sekunden)"
                type="number"
                min={0}
                max={600}
                value={o.cooldownSeconds}
                onChange={(e) => set(i, { cooldownSeconds: Math.max(0, Math.min(600, Math.round(Number(e.target.value) || 0))) })}
                className="input w-20 tabular-nums"
              />
              <span className="text-xs text-fog-500">s Pause</span>
              <button type="button" className="ml-auto text-xs text-fog-500 hover:text-danger-500" onClick={() => setList(list.filter((_, j) => j !== i))} aria-label={`Ausnahme ${i + 1} entfernen`}>
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-fog-500">Menge 0 = unbegrenzt. Wörter = Wörter in den Fragen. Die eigene Regel einer Person geht vor Rollen; bei mehreren Rollen zählt die großzügigste.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" onClick={() => add('user')} disabled={list.length >= 50}>
          + Person
        </button>
        <button type="button" className="btn-ghost" onClick={() => add('role')} disabled={list.length >= 50 || roles.length === 0}>
          + Rolle
        </button>
      </div>
    </div>
  );
}
