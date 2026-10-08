'use client';

import { FORM_FIELD_LABELS, FORM_FIELD_TYPES, nextId, type FormField } from '@moin/shared';

/**
 * Fragen-Editor (wie GalaxyBot-Formulare): Kurztext, Langtext, Auswahl mit Emoji-Optionen, Datei-Upload;
 * Pflicht, Platzhalter, Mindest-/Höchstlänge.
 */
export function FormFieldsEditor({ fields, onChange, max = 20 }: { fields: FormField[]; onChange: (fields: FormField[]) => void; max?: number }) {
  const update = (id: string, patch: Partial<FormField>) => onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...fields];
    const [item] = next.splice(i, 1);
    next.splice(i + dir, 0, item!);
    onChange(next);
  };
  return (
    <div className="grid gap-3">
      {fields.map((f, i) => (
        <div key={f.id} className="grid gap-3 rounded-xl border border-ink-700 bg-ink-850 p-4" data-field={f.id}>
          <div className="grid gap-2 sm:grid-cols-[1fr_11rem_auto] sm:items-center">
            <input value={f.label} maxLength={45} placeholder={`Frage ${i + 1}`} aria-label={`Frage ${i + 1}`} className="input" onChange={(e) => update(f.id, { label: e.target.value })} />
            <select value={f.type} aria-label="Art" className="input" onChange={(e) => update(f.id, { type: e.target.value as FormField['type'], options: e.target.value === 'select' && !f.options.length ? [{ label: 'Option 1', emoji: '' }] : f.options })}>
              {FORM_FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FORM_FIELD_LABELS[t]}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1 text-fog-500">
              <button type="button" className="rounded px-2 hover:bg-ink-700 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Nach oben">
                ↑
              </button>
              <button type="button" className="rounded px-2 hover:bg-ink-700 disabled:opacity-30" disabled={i === fields.length - 1} onClick={() => move(i, 1)} aria-label="Nach unten">
                ↓
              </button>
              <button type="button" className="rounded px-2 hover:bg-ink-700 hover:text-danger-500" onClick={() => onChange(fields.filter((x) => x.id !== f.id))} aria-label="Frage entfernen">
                ✕
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={f.required} onChange={(e) => update(f.id, { required: e.target.checked })} className="accent-coral-500" />
              Pflicht
            </label>
            {f.type !== 'file' && (
              <input value={f.placeholder} maxLength={100} placeholder="Platzhalter (optional)" className="input w-56 flex-none py-1.5" onChange={(e) => update(f.id, { placeholder: e.target.value })} />
            )}
            {(f.type === 'short' || f.type === 'long') && (
              <>
                <label className="flex items-center gap-1.5 text-fog-300">
                  min.
                  <input type="number" min={0} max={4000} value={f.minLength} className="input w-20 py-1.5" onChange={(e) => update(f.id, { minLength: Math.max(0, Number(e.target.value) || 0) })} />
                </label>
                <label className="flex items-center gap-1.5 text-fog-300">
                  max.
                  <input type="number" min={1} max={4000} value={f.maxLength} className="input w-24 py-1.5" onChange={(e) => update(f.id, { maxLength: Math.max(1, Number(e.target.value) || 1) })} />
                </label>
              </>
            )}
            {f.type === 'file' && <span className="text-xs text-fog-500">Bilder (PNG, JPG, GIF, WebP), bis zu 5 Stück à 8 MB</span>}
          </div>
          {f.type === 'select' && (
            <div className="grid gap-2">
              {f.options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input value={o.emoji} maxLength={40} placeholder="🙂" aria-label="Emoji" className="input w-16 text-center" onChange={(e) => update(f.id, { options: f.options.map((x, j) => (j === oi ? { ...x, emoji: e.target.value } : x)) })} />
                  <input value={o.label} maxLength={100} placeholder={`Option ${oi + 1}`} aria-label={`Option ${oi + 1}`} className="input" onChange={(e) => update(f.id, { options: f.options.map((x, j) => (j === oi ? { ...x, label: e.target.value } : x)) })} />
                  <button type="button" className="px-2 text-fog-500 hover:text-danger-500" onClick={() => update(f.id, { options: f.options.filter((_, j) => j !== oi) })} aria-label="Option entfernen">
                    ✕
                  </button>
                </div>
              ))}
              {f.options.length < 25 && (
                <button type="button" className="w-fit text-sm font-semibold text-coral-400 hover:text-coral-500" onClick={() => update(f.id, { options: [...f.options, { label: `Option ${f.options.length + 1}`, emoji: '' }] })}>
                  + Option
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      {fields.length < max && (
        <button
          type="button"
          className="btn-ghost w-fit"
          onClick={() =>
            onChange([...fields, { id: nextId('f', fields.map((x) => x.id)), label: '', type: 'short', required: true, placeholder: '', minLength: 0, maxLength: 1000, options: [] }])
          }
        >
          + Frage
        </button>
      )}
    </div>
  );
}
