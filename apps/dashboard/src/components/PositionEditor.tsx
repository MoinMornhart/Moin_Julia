'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { PositionData } from '@moin/shared';
import { deletePosition, savePosition } from '@/app/g/[guildId]/team/actions';
import { FormFieldsEditor } from './FormFieldsEditor';

/** Stelle bearbeiten: Text, Fragen, Rollen (geben + entziehen), Probezeit, Wartezeit, Anforderungen */
export function PositionEditor({
  guildId,
  positionId,
  canEdit,
  initial,
  roles,
}: {
  guildId: string;
  positionId: string | null;
  canEdit: boolean;
  initial: PositionData;
  roles: { id: string; name: string; color: number }[];
}) {
  const router = useRouter();
  const [p, setP] = useState<PositionData>(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<PositionData>) => setP({ ...p, ...patch });
  const toggle = (key: 'acceptRoleIds' | 'removeRoleIds', id: string) => set({ [key]: p[key].includes(id) ? p[key].filter((x) => x !== id) : [...p[key], id] });
  const num = (key: 'probationDays' | 'cooldownDays' | 'minAccountDays' | 'minMemberDays', label: string, suffix: string, max: number) => (
    <label className="grid gap-1 text-sm">
      <span className="text-fog-300">{label}</span>
      <span className="flex items-center gap-2">
        <input type="number" min={0} max={max} value={p[key]} className="input w-24" onChange={(e) => set({ [key]: Math.max(0, Math.min(max, Number(e.target.value) || 0)) })} />
        <span className="text-fog-500">{suffix}</span>
      </span>
    </label>
  );

  return (
    <fieldset disabled={!canEdit || pending} className="grid gap-6">
      <div className="card grid gap-4 p-6">
        <div className="grid gap-3 sm:grid-cols-[5rem_1fr_auto] sm:items-end">
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Emoji</span>
            <input value={p.emoji} maxLength={40} placeholder="🛡️" className="input text-center" onChange={(e) => set({ emoji: e.target.value })} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Titel</span>
            <input name="title" value={p.title} maxLength={80} required className="input" onChange={(e) => set({ title: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 pb-2.5 text-sm font-semibold">
            <input type="checkbox" checked={p.open} onChange={(e) => set({ open: e.target.checked })} className="size-4 accent-coral-500" />
            Offen für Bewerbungen
          </label>
        </div>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">Beschreibung</span>
          <textarea value={p.description} maxLength={2000} rows={4} placeholder="Was erwartet die Person? Was sollte sie mitbringen?" className="input" onChange={(e) => set({ description: e.target.value })} />
        </label>
      </div>

      <div className="card grid gap-3 p-6">
        <p className="font-display text-lg font-semibold">Fragen ({p.questions.length}/20)</p>
        <FormFieldsEditor fields={p.questions} onChange={(questions) => set({ questions })} />
      </div>

      <div className="card grid gap-4 p-6">
        <p className="font-display text-lg font-semibold">Bei Annahme</p>
        <div className="grid gap-4 md:grid-cols-2">
          {(['acceptRoleIds', 'removeRoleIds'] as const).map((key) => (
            <div key={key} className="grid gap-1.5 text-sm">
              <span className="font-semibold">{key === 'acceptRoleIds' ? 'Rollen geben' : 'Rollen entziehen'}</span>
              <span className="text-xs text-fog-500">{key === 'acceptRoleIds' ? 'z. B. „Moderator“, „Team“' : 'z. B. „Bewerber:in“'}</span>
              <div className="flex flex-wrap gap-1.5">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={p[key].includes(r.id)}
                    onClick={() => toggle(key, r.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${p[key].includes(r.id) ? 'border-coral-500 bg-coral-500/15 text-coral-400' : 'border-ink-700 text-fog-300 hover:border-ink-600'}`}
                  >
                    @ {r.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-6">{num('probationDays', 'Probezeit (0 = keine)', 'Tage', 365)}</div>
      </div>

      <div className="card grid gap-4 p-6">
        <p className="font-display text-lg font-semibold">Anforderungen</p>
        <div className="flex flex-wrap gap-6">
          {num('minAccountDays', 'Discord-Account mindestens', 'Tage alt', 3650)}
          {num('minMemberDays', 'Auf dem Server seit mindestens', 'Tagen', 3650)}
          {num('cooldownDays', 'Nach einer Absage erneut bewerben nach', 'Tagen', 365)}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            start(async () => {
              const r = await savePosition(guildId, positionId, JSON.stringify(p));
              setMessage({ ok: r.ok, text: r.message ?? '' });
              if (r.ok && !positionId && r.id) router.replace(`/g/${guildId}/team/stellen?stelle=${r.id}`);
              else router.refresh();
            })
          }
        >
          {pending ? 'Speichere …' : 'Stelle speichern'}
        </button>
        {positionId && (
          <button
            type="button"
            className="ml-auto text-sm text-fog-500 hover:text-danger-500"
            onClick={() =>
              start(async () => {
                const r = await deletePosition(guildId, positionId);
                if (r.ok) router.replace(`/g/${guildId}/team/stellen`);
                else setMessage({ ok: false, text: r.message ?? '' });
              })
            }
          >
            Stelle löschen
          </button>
        )}
        {message && <p className={`text-sm ${message.ok ? 'text-sea-400' : 'text-danger-500'}`}>{message.text}</p>}
      </div>
    </fieldset>
  );
}
