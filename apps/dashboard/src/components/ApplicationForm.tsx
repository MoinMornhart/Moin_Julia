'use client';

import { useState, useTransition } from 'react';
import type { FormField } from '@moin/shared';
import { submitApplication } from '@/app/bewerben/[guildId]/actions';

/** Bewerbungsformular auf der öffentlichen Seite: Kurztext, Langtext, Auswahl, Bild-Upload */
export function ApplicationForm({ guildId, positionId, questions }: { guildId: string; positionId: string; questions: FormField[] }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, { ref: string; preview: string; name: string }[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (id: string, v: string) => setValues({ ...values, [id]: v });

  async function upload(fieldId: string, file: File) {
    setBusy(fieldId);
    try {
      const body = new FormData();
      body.set('guildId', guildId);
      body.set('file', file);
      const res = await fetch('/api/bewerben/upload', { method: 'POST', body });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; ref?: string; error?: string };
      if (data.ok && data.ref) setFiles({ ...files, [fieldId]: [...(files[fieldId] ?? []), { ref: data.ref, preview: URL.createObjectURL(file), name: file.name }].slice(0, 5) });
      else setResult({ ok: false, message: data.error ?? 'Hochladen fehlgeschlagen.' });
    } finally {
      setBusy(null);
    }
  }

  if (result?.ok) {
    return (
      <div className="enter card border-sea-500/50 p-8 text-center">
        <p className="text-4xl">🎉</p>
        <p className="mt-3 font-display text-2xl font-semibold">Bewerbung abgeschickt!</p>
        <p className="mt-2 text-fog-300">{result.message}</p>
        <a href={`/bewerben/${guildId}`} className="btn-ghost mt-6 inline-flex">
          Zurück zu den Stellen
        </a>
      </div>
    );
  }

  return (
    <form
      className="card grid gap-5 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const payload = { ...values };
        for (const [id, list] of Object.entries(files)) payload[id] = list.map((f) => f.ref).join(',');
        start(async () => setResult(await submitApplication(guildId, positionId, payload)));
      }}
    >
      {questions.length === 0 && <p className="text-fog-300">Für diese Stelle gibt es keine Fragen – schick deine Bewerbung einfach ab.</p>}
      {questions.map((q) => (
        <div key={q.id} className="grid gap-1.5 text-sm">
          <label htmlFor={`q-${q.id}`} className="font-semibold">
            {q.label} {q.required && <span className="text-coral-400">*</span>}
          </label>
          {q.type === 'long' ? (
            <textarea id={`q-${q.id}`} rows={5} maxLength={q.maxLength} placeholder={q.placeholder} required={q.required} className="input" value={values[q.id] ?? ''} onChange={(e) => set(q.id, e.target.value)} />
          ) : q.type === 'select' ? (
            <select id={`q-${q.id}`} required={q.required} className="input" value={values[q.id] ?? ''} onChange={(e) => set(q.id, e.target.value)}>
              <option value="">{q.placeholder || '— bitte wählen —'}</option>
              {q.options.map((o) => (
                <option key={o.label} value={o.label}>
                  {o.emoji} {o.label}
                </option>
              ))}
            </select>
          ) : q.type === 'file' ? (
            <div className="grid gap-2">
              <input
                id={`q-${q.id}`}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                disabled={busy === q.id || (files[q.id]?.length ?? 0) >= 5}
                className="text-sm text-fog-300 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-700 file:px-3 file:py-1.5 file:text-fog-100"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void upload(q.id, f);
                }}
              />
              <div className="flex flex-wrap gap-2">
                {(files[q.id] ?? []).map((f) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={f.ref} src={f.preview} alt={f.name} className="size-20 rounded-lg border border-ink-700 object-cover" />
                ))}
              </div>
            </div>
          ) : (
            <input id={`q-${q.id}`} maxLength={q.maxLength} placeholder={q.placeholder} required={q.required} className="input" value={values[q.id] ?? ''} onChange={(e) => set(q.id, e.target.value)} />
          )}
          {(q.type === 'short' || q.type === 'long') && (
            <span className="text-xs text-fog-500">
              {(values[q.id] ?? '').length}/{q.maxLength}
              {q.minLength ? ` · mindestens ${q.minLength}` : ''}
            </span>
          )}
        </div>
      ))}
      {result && !result.ok && <p className="text-sm text-danger-500">❌ {result.message}</p>}
      <button type="submit" className="btn-primary shine w-fit" disabled={pending || busy !== null}>
        {pending ? 'Wird gesendet …' : 'Bewerbung abschicken'}
      </button>
    </form>
  );
}
