'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CATEGORY_LABELS, type ModuleCategory } from '@moin/shared';
import { ModuleToggle } from './ModuleToggle';

export interface GridModule {
  id: string;
  icon: string;
  name: string;
  description: string;
  category: ModuleCategory;
  planned: boolean;
  order: number;
  enabled: boolean;
  hasSettings: boolean;
}

/** Farbverlauf der Icon-Kachel je Kategorie */
const TILE: Record<ModuleCategory, string> = {
  verwaltung: 'from-[#2b3b85] to-[#1a2560]',
  community: 'from-[#16b9a0] to-[#2f8bff]',
  ki: 'from-[#ffa062] to-[#ee3f82]',
};

type Filter = 'alle' | 'aktiv' | ModuleCategory;

/** Modul-Kacheln mit Filter (Kategorie, nur aktive) und Suche – wie die Modul-Übersicht großer Bots. */
export function ModuleGrid({ guildId, modules, canEdit }: { guildId: string; modules: GridModule[]; canEdit: boolean }) {
  const [filter, setFilter] = useState<Filter>('alle');
  const [query, setQuery] = useState('');
  const categories = useMemo(() => [...new Set(modules.map((m) => m.category))], [modules]);
  const q = query.trim().toLowerCase();
  const shown = modules.filter(
    (m) =>
      (filter === 'alle' || (filter === 'aktiv' ? m.enabled : m.category === filter)) &&
      (!q || m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)),
  );
  const chips: { key: Filter; label: string; count: number }[] = [
    { key: 'alle', label: 'Alle', count: modules.length },
    { key: 'aktiv', label: 'Aktiv', count: modules.filter((m) => m.enabled).length },
    ...categories.map((c) => ({ key: c as Filter, label: CATEGORY_LABELS[c].de, count: modules.filter((m) => m.category === c).length })),
  ];

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="-mx-1 flex min-w-0 basis-full gap-1.5 overflow-x-auto px-1 pb-1 sm:basis-auto sm:flex-1" role="tablist" aria-label="Module filtern">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={filter === c.key}
              onClick={() => setFilter(c.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                filter === c.key ? 'border-coral-500 bg-coral-500 text-ink-950' : 'border-ink-700 bg-ink-900 text-fog-300 hover:border-ink-600 hover:text-fog-100'
              }`}
            >
              {c.label}
              <span className={`rounded-full px-1.5 text-xs ${filter === c.key ? 'bg-ink-950/20' : 'bg-ink-800 text-fog-500'}`}>{c.count}</span>
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-64 sm:shrink-0">
          <span className="sr-only">Module durchsuchen</span>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fog-500" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Modul suchen …" className="input pl-9" type="search" />
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="card p-8 text-center text-fog-500">Kein Modul passt zu deiner Suche.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" key={`${filter}-${q}`}>
          {shown.map((m, i) => (
            <li
              key={m.id}
              style={{ '--i': i } as React.CSSProperties}
              className={`enter card lift relative flex flex-col overflow-hidden p-5 ${m.enabled ? 'border-sea-500/40' : ''} ${m.planned ? 'opacity-70' : ''}`}
            >
              {m.enabled && <span className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-sea-500/10 blur-2xl" aria-hidden />}
              <div className="flex items-start justify-between gap-3">
                <span className={`grid size-12 place-items-center rounded-2xl bg-gradient-to-br text-2xl shadow-lg ${TILE[m.category]}`} aria-hidden>
                  {m.icon}
                </span>
                <ModuleToggle guildId={guildId} moduleId={m.id} enabled={m.enabled} disabled={!canEdit || m.planned} label={m.name} />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{m.name}</h3>
              <p className="mt-1 flex-1 text-sm leading-6 text-fog-300">{m.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="chip bg-ink-800 text-fog-500">{CATEGORY_LABELS[m.category].de}</span>
                {m.planned ? (
                  <span className="chip bg-sun-400/15 text-sun-400">Kommt in Modul {m.order}</span>
                ) : m.enabled ? (
                  <span className="chip bg-sea-500/15 text-sea-400">● Aktiv</span>
                ) : (
                  <span className="chip bg-ink-800 text-fog-500">Aus</span>
                )}
                {m.hasSettings && !m.planned && (
                  <Link href={`/g/${guildId}/${m.id}`} className="group/set ml-auto text-sm font-semibold text-coral-400 hover:text-coral-500">
                    Einstellungen <span className="inline-block transition group-hover/set:translate-x-1">→</span>
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
