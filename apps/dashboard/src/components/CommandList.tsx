'use client';

import { useMemo, useState } from 'react';
import { normalizeWords, type CommandCatalogEntry, type CommandNote } from '@moin/shared';

export type CommandView = CommandCatalogEntry & { who: string; note: CommandNote };

/** Befehle durchsuchen; pro Modul eine Tabelle „Was man beachten muss“ */
export function CommandList({
  commands,
  modules,
  sentences,
}: {
  commands: CommandView[];
  modules: { id: string; icon: string; name: string; on: boolean }[];
  sentences: { example: string; what: string; who: string }[];
}) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const words = normalizeWords(query);
    if (!words.length) return commands;
    return commands.filter((c) => {
      const hay = normalizeWords(`${c.name} ${c.description} ${c.module} ${c.options.map((o) => o.name).join(' ')}`).join(' ');
      return words.every((w) => hay.includes(w));
    });
  }, [commands, query]);

  return (
    <div className="grid gap-6">
      <input type="search" aria-label="Befehl suchen" placeholder="Befehl suchen, z. B. „play“ oder „timeout“ …" className="input max-w-md" value={query} onChange={(e) => setQuery(e.target.value)} />
      {shown.length === 0 && <p className="text-sm text-fog-500">Kein Befehl gefunden.</p>}

      {modules.map((m) => {
        const list = shown.filter((c) => c.module === m.id);
        if (!list.length) return null;
        return (
          <section key={m.id} className="card grid gap-3 p-5" aria-label={`Befehle ${m.name}`}>
            <h2 className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold">
              {m.icon} {m.name}
              <span className={`rounded-full px-2.5 py-0.5 text-xs ${m.on ? 'bg-sea-500/20 text-sea-400' : 'bg-ink-700 text-fog-500'}`}>{m.on ? 'Modul an' : 'Modul aus – Befehle antworten mit Hinweis'}</span>
            </h2>
            <ul className="grid gap-2">
              {list.map((c) => (
                <li key={c.name} className="grid gap-1 rounded-lg border border-ink-800 px-3 py-2 text-sm">
                  <p>
                    <code className="font-semibold text-coral-400">/{c.name}</code> <span className="text-fog-300">– {c.description}</span>
                  </p>
                  {c.options.length > 0 && (
                    <p className="flex flex-wrap gap-1.5 text-xs">
                      {c.options.map((o) => (
                        <span key={o.name} className="rounded-md bg-ink-800 px-1.5 py-0.5" title={o.description}>
                          {o.name}
                          {o.required ? '*' : ''}
                        </span>
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold">Was man beachten muss</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-xs" aria-label={`Was man beachten muss – ${m.name}`}>
                  <thead>
                    <tr className="border-b border-ink-700 text-fog-500">
                      <th className="py-1.5 pr-3">Befehl</th>
                      <th className="py-1.5 pr-3">Wer darf</th>
                      <th className="py-1.5 pr-3">Bot braucht</th>
                      <th className="py-1.5 pr-3">Voraussetzungen / Wo / Limits</th>
                      <th className="py-1.5">Rückgängig?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((c) => (
                      <tr key={c.name} className="border-b border-ink-800 align-top">
                        <td className="py-1.5 pr-3 font-mono">/{c.name}</td>
                        <td className="py-1.5 pr-3">{c.who}</td>
                        <td className="py-1.5 pr-3">{c.note.bot ?? '–'}</td>
                        <td className="py-1.5 pr-3">{[c.note.needs, c.note.channels, c.note.limits].filter(Boolean).join(' · ') || '–'}</td>
                        <td className="py-1.5">{c.note.undo ?? '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        );
      })}

      <section className="card grid gap-3 p-5" aria-label="Julia-Sätze">
        <h2 className="font-display text-lg font-semibold">💬 Mit Julia reden (ohne Slash-Befehl)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-ink-700 text-fog-500">
                <th className="py-1.5 pr-3">Beispiel</th>
                <th className="py-1.5 pr-3">Was passiert</th>
                <th className="py-1.5">Wer darf</th>
              </tr>
            </thead>
            <tbody>
              {sentences.map((s) => (
                <tr key={s.example} className="border-b border-ink-800 align-top">
                  <td className="py-1.5 pr-3 font-mono">{s.example}</td>
                  <td className="py-1.5 pr-3">{s.what}</td>
                  <td className="py-1.5">{s.who}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
