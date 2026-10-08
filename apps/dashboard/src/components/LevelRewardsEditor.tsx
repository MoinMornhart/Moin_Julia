'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { LevelConfig } from '@moin/shared';
import { saveLevelRewards } from '@/app/g/[guildId]/level/actions';

type Draft = Pick<LevelConfig, 'rewards' | 'rewardsReplace' | 'boosts'>;

/** Belohnungsrollen pro Level + XP-Bonus für Rollen */
export function LevelRewardsEditor({ guildId, canEdit, initial, roles }: { guildId: string; canEdit: boolean; initial: Draft; roles: { id: string; name: string }[] }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const firstRole = roles[0]?.id ?? '';
  const nextLevel = Math.max(0, ...d.rewards.map((r) => r.level)) + 5;

  const roleSelect = (value: string, onChange: (id: string) => void, label: string) => (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="input min-w-0 flex-1">
      {roles.map((r) => (
        <option key={r.id} value={r.id}>
          @ {r.name}
        </option>
      ))}
    </select>
  );

  return (
    <fieldset disabled={!canEdit || pending} className="grid max-w-3xl gap-6">
      <div className="card grid gap-4 p-6">
        <div>
          <p className="font-display text-lg font-semibold">Belohnungsrollen</p>
          <p className="text-sm text-fog-500">Ab diesem Level bekommt man die Rolle automatisch. Wer XP verliert (z. B. Zurücksetzen), verliert sie wieder.</p>
        </div>
        {d.rewards.length === 0 && <p className="text-sm text-fog-500">Noch keine Belohnungen.</p>}
        {d.rewards.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              Level
              <input
                aria-label={`Level für Belohnung ${i + 1}`}
                type="number"
                min={1}
                max={500}
                value={r.level}
                onChange={(e) => setD({ ...d, rewards: d.rewards.map((x, j) => (j === i ? { ...x, level: Math.max(1, Math.min(500, Number(e.target.value) || 1)) } : x)) })}
                className="input w-24"
              />
            </label>
            <span className="text-fog-500">→</span>
            {roleSelect(r.roleId, (roleId) => setD({ ...d, rewards: d.rewards.map((x, j) => (j === i ? { ...x, roleId } : x)) }), `Rolle für Belohnung ${i + 1}`)}
            <button type="button" aria-label="Belohnung entfernen" className="px-2 text-fog-500 hover:text-danger-500" onClick={() => setD({ ...d, rewards: d.rewards.filter((_, j) => j !== i) })}>
              ✕
            </button>
          </div>
        ))}
        {roles.length > 0 && d.rewards.length < 50 && (
          <button type="button" className="btn-ghost justify-self-start" onClick={() => setD({ ...d, rewards: [...d.rewards, { level: nextLevel, roleId: firstRole }] })}>
            + Belohnung
          </button>
        )}
        <div className="grid gap-2 text-sm">
          <label className="flex items-start gap-2">
            <input type="radio" name="mode" checked={!d.rewardsReplace} onChange={() => setD({ ...d, rewardsReplace: false })} className="mt-1 accent-coral-500" />
            <span>
              <b>Stapeln</b> – alle erreichten Rollen behalten
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="mode" checked={d.rewardsReplace} onChange={() => setD({ ...d, rewardsReplace: true })} className="mt-1 accent-coral-500" />
            <span>
              <b>Ersetzen</b> – nur die höchste behalten, niedrigere werden entzogen
            </span>
          </label>
        </div>
      </div>

      <div className="card grid gap-4 p-6">
        <div>
          <p className="font-display text-lg font-semibold">XP-Bonus</p>
          <p className="text-sm text-fog-500">Z. B. Server-Booster +50 %. Hat jemand mehrere, zählt der höchste. Negative Werte bremsen.</p>
        </div>
        {d.boosts.map((b, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            {roleSelect(b.roleId, (roleId) => setD({ ...d, boosts: d.boosts.map((x, j) => (j === i ? { ...x, roleId } : x)) }), `Rolle für Bonus ${i + 1}`)}
            <input
              aria-label={`Bonus ${i + 1} in Prozent`}
              type="number"
              min={-100}
              max={500}
              value={b.percent}
              onChange={(e) => setD({ ...d, boosts: d.boosts.map((x, j) => (j === i ? { ...x, percent: Math.max(-100, Math.min(500, Number(e.target.value) || 0)) } : x)) })}
              className="input w-24"
            />
            <span className="text-sm text-fog-500">%</span>
            <button type="button" aria-label="Bonus entfernen" className="px-2 text-fog-500 hover:text-danger-500" onClick={() => setD({ ...d, boosts: d.boosts.filter((_, j) => j !== i) })}>
              ✕
            </button>
          </div>
        ))}
        {roles.length > 0 && d.boosts.length < 20 && (
          <button type="button" className="btn-ghost justify-self-start" onClick={() => setD({ ...d, boosts: [...d.boosts, { roleId: firstRole, percent: 50 }] })}>
            + Bonus
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            start(async () => {
              const r = await saveLevelRewards(guildId, JSON.stringify(d));
              setMessage({ ok: r.ok, text: r.message ?? '' });
              if (r.ok) router.refresh();
            })
          }
        >
          {pending ? 'Speichere …' : 'Speichern'}
        </button>
        {message && (
          <p role="status" className={`text-sm ${message.ok ? 'text-sea-400' : 'text-danger-500'}`}>
            {message.text}
          </p>
        )}
      </div>
    </fieldset>
  );
}
