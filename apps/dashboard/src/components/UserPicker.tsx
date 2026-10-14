'use client';

import { useEffect, useState, useTransition } from 'react';
import { searchMembers } from '@/app/g/[guildId]/actions';

/**
 * Personen auswählen (nicht nur Rollen): Namen tippen, Treffer anklicken. Die IDs gehen als
 * mehrere Formularfelder mit demselben Namen mit (wie bei den Rollen-Chips).
 */
export function UserPicker({ guildId, name, label, initial }: { guildId: string; name: string; label: string; initial: { id: string; name: string }[] }) {
  const [picked, setPicked] = useState(initial);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<{ id: string; name: string }[]>([]);
  const [searching, start] = useTransition();

  // Erst nach kurzer Tipp-Pause suchen (schont Discords Limits)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      return;
    }
    const timer = setTimeout(() => start(async () => setHits(await searchMembers(guildId, q))), 250);
    return () => clearTimeout(timer);
  }, [query, guildId]);

  return (
    <div className="grid gap-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      {picked.map((p) => (
        <input key={p.id} type="hidden" name={name} value={p.id} />
      ))}
      <div className="flex flex-wrap gap-1.5" aria-label={`${label}: ausgewählt`}>
        {picked.length === 0 && <span className="text-xs text-fog-500">niemand</span>}
        {picked.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1 rounded-full border border-coral-500/60 bg-coral-500/10 px-2.5 py-0.5 text-xs font-semibold text-coral-400">
            @{p.name}
            <button type="button" aria-label={`${p.name} entfernen`} className="text-fog-300 hover:text-danger-500" onClick={() => setPicked(picked.filter((x) => x.id !== p.id))}>
              ✕
            </button>
          </span>
        ))}
      </div>
      {/* Enter in der Suche soll nicht das umgebende Formular abschicken */}
      <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} placeholder="Name eintippen, z. B. „Ozzy“ …" aria-label={`${label}: Person suchen`} className="input max-w-xs" />
      {(hits.length > 0 || searching) && (
        <div className="flex flex-wrap gap-1.5" aria-label={`${label}: Treffer`}>
          {searching && <span className="text-xs text-fog-500">suche …</span>}
          {hits
            .filter((h) => !picked.some((p) => p.id === h.id))
            .map((h) => (
              <button
                key={h.id}
                type="button"
                className="rounded-full border border-ink-700 px-2.5 py-0.5 text-xs text-fog-300 hover:border-coral-500"
                onClick={() => {
                  setPicked([...picked, h].slice(0, 100));
                  setQuery('');
                  setHits([]);
                }}
              >
                + @{h.name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
