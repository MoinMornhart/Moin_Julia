'use client';

import { useState, useTransition } from 'react';
import { analyzeTemplate, importTemplate, type Analysis } from '@/app/g/[guildId]/vorlagen/actions';

export function ImportWizard({ guildId, otherGuilds, canEdit }: { guildId: string; otherGuilds: { id: string; name: string }[]; canEdit: boolean }) {
  const [source, setSource] = useState<'file' | 'guild'>('file');
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [sourceGuild, setSourceGuild] = useState(otherGuilds[0]?.id ?? '');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [modules, setModules] = useState<string[]>([]);
  const [opts, setOpts] = useState({ includeEnabled: true, includePanels: true, includeLocale: false });
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  const analyze = () =>
    start(async () => {
      setResult(null);
      const a = await analyzeTemplate(guildId, source === 'file' ? { kind: 'file', text: fileText ?? '' } : { kind: 'guild', guildId: sourceGuild });
      setAnalysis(a);
      if (a.ok) {
        setMapping(Object.fromEntries((a.matches ?? []).map((m) => [m.sourceId, m.targetId ?? ''])));
        setModules((a.summary?.modules ?? []).map((m) => m.id));
      }
    });

  const apply = () =>
    start(async () => {
      if (!analysis?.templateText) return;
      const r = await importTemplate(
        guildId,
        analysis.templateText,
        Object.entries(mapping).map(([s, t]) => [s, t || null]),
        { modules, ...opts },
      );
      setResult(r);
      if (r.ok) setAnalysis(null);
    });

  const missing = (analysis?.matches ?? []).filter((m) => !mapping[m.sourceId]).length;

  return (
    <div className="grid gap-5">
      {!analysis?.ok && (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Quelle">
            {(['file', 'guild'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={source === k}
                onClick={() => setSource(k)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${source === k ? 'border-coral-500 bg-coral-500/15 text-coral-400' : 'border-ink-600 text-fog-300'}`}
              >
                {k === 'file' ? 'Vorlage-Datei' : 'Von meinem anderen Server'}
              </button>
            ))}
          </div>
          {source === 'file' ? (
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Datei (.json)</span>
              <input
                type="file"
                accept=".json,application/json"
                className="input file:mr-3 file:rounded-lg file:border-0 file:bg-ink-700 file:px-3 file:py-1 file:text-fog-100"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  setFileName(file?.name ?? '');
                  setFileText(file ? await file.text() : null);
                }}
              />
              {fileName && <span className="text-xs text-fog-500">{fileName}</span>}
            </label>
          ) : otherGuilds.length ? (
            <label className="grid max-w-md gap-1.5 text-sm">
              <span className="font-semibold">Quell-Server</span>
              <select value={sourceGuild} onChange={(e) => setSourceGuild(e.target.value)} className="input">
                {otherGuilds.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-fog-500">Auf keinem anderen Server bist du Admin und der Bot ist dort.</p>
          )}
          {analysis?.error && <p className="rounded-lg bg-danger-500/10 px-3 py-2 text-sm">❌ {analysis.error}</p>}
          <button
            type="button"
            className="btn-primary w-fit"
            disabled={!canEdit || pending || (source === 'file' ? !fileText : !sourceGuild)}
            onClick={analyze}
          >
            {pending ? 'Prüfe …' : 'Vorlage prüfen'}
          </button>
        </div>
      )}

      {analysis?.ok && analysis.summary && (
        <div className="grid gap-5">
          <div className="rounded-xl border border-ink-700 bg-ink-850 p-4 text-sm">
            <p className="font-semibold">Vorlage von „{analysis.summary.sourceName}“</p>
            <p className="text-fog-500">
              erstellt {new Date(analysis.summary.createdAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })} · {analysis.summary.modules.length} Module ·{' '}
              {analysis.summary.panels} Rollen-Panels
            </p>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 font-semibold">Welche Module übernehmen?</legend>
            <div className="flex flex-wrap gap-2">
              {analysis.summary.modules.map((m) => (
                <label key={m.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-ink-600 bg-ink-850 px-3 py-1.5 text-sm has-checked:border-coral-500 has-checked:bg-coral-500/15">
                  <input
                    type="checkbox"
                    checked={modules.includes(m.id)}
                    onChange={(e) => setModules(e.target.checked ? [...modules, m.id] : modules.filter((x) => x !== m.id))}
                    className="sr-only"
                  />
                  {m.name} <span className="text-xs text-fog-500">{m.enabled ? 'an' : 'aus'}</span>
                </label>
              ))}
            </div>
            <div className="mt-2 grid gap-1.5 text-sm">
              {(
                [
                  ['includeEnabled', 'An/Aus-Zustand der Module übernehmen'],
                  ['includePanels', `Rollen-Panels anlegen (${analysis.summary.panels})`],
                  ['includeLocale', `Bot-Sprache übernehmen (${analysis.summary.locale === 'en' ? 'English' : 'Deutsch'})`],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input type="checkbox" checked={opts[key]} onChange={(e) => setOpts({ ...opts, [key]: e.target.checked })} className="size-4 accent-coral-500" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {(analysis.matches ?? []).length > 0 && (
            <div className="grid gap-2">
              <p className="font-semibold">
                Kanäle & Rollen zuordnen{' '}
                {missing > 0 ? (
                  <span className="chip ml-2 bg-sun-400/15 text-sun-400">{missing} ohne Treffer</span>
                ) : (
                  <span className="chip ml-2 bg-sea-500/15 text-sea-400">alles gefunden</span>
                )}
              </p>
              <p className="text-sm text-fog-500">Per Name gefunden. Ohne Zuordnung wird die Einstellung leer gelassen.</p>
              <div className="overflow-x-auto rounded-xl border border-ink-700">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-ink-700 text-xs tracking-wider text-fog-500 uppercase">
                    <tr>
                      <th className="px-3 py-2">In der Vorlage</th>
                      <th className="px-3 py-2">Auf diesem Server</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-800">
                    {analysis.matches!.map((m) => (
                      <tr key={m.sourceId} className={mapping[m.sourceId] ? '' : 'bg-sun-400/5'}>
                        <td className="px-3 py-2">
                          {m.kind === 'channel' ? '#' : '@'} {m.name}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={mapping[m.sourceId] ?? ''}
                            onChange={(e) => setMapping({ ...mapping, [m.sourceId]: e.target.value })}
                            className="input py-1.5"
                            aria-label={`Zuordnung für ${m.name}`}
                          >
                            <option value="">— weglassen —</option>
                            {(m.kind === 'channel' ? analysis.channels! : analysis.roles!).map((x) => (
                              <option key={x.id} value={x.id}>
                                {m.kind === 'channel' ? '#' : '@'} {x.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" disabled={!canEdit || pending || modules.length === 0} onClick={apply}>
              {pending ? 'Übernehme …' : 'Jetzt übernehmen'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setAnalysis(null)} disabled={pending}>
              Abbrechen
            </button>
            <span className="text-xs text-fog-500">Vorher wird automatisch ein Backup angelegt.</span>
          </div>
        </div>
      )}

      {result && <p className={`text-sm ${result.ok ? 'text-sea-400' : 'text-danger-500'}`}>{result.ok ? '✅ ' : '❌ '}{result.message}</p>}
    </div>
  );
}
