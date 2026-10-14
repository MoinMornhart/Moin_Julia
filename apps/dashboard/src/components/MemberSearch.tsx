'use client';

import { useEffect, useState, useTransition } from 'react';
import { searchMembers } from '@/app/g/[guildId]/actions';

/**
 * Eine Person per Namen finden (Issue #7: „Namen-Vervollständigung überall“) – Treffer anklicken füllt ID und Name.
 * Für Stellen, die bisher nur eine Discord-ID kannten (Limits pro Person, Herrscher ernennen).
 */
export function MemberSearch({ guildId, label, onPick }: { guildId: string; label: string; onPick: (m: { id: string; name: string }) => void }) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<{ id: string; name: string }[]>([]);
  const [searching, start] = useTransition();

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    const timer = setTimeout(() => start(async () => setHits(await searchMembers(guildId, q))), 250);
    return () => clearTimeout(timer);
  }, [query, guildId]);

  return (
    <div className="grid gap-1">
      {/* Enter in der Suche soll nicht das umgebende Formular abschicken */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        placeholder="🔎 Name suchen …"
        aria-label={label}
        className="input"
      />
      {(hits.length > 0 || searching) && (
        <div className="flex flex-wrap gap-1.5" aria-label={`${label}: Treffer`}>
          {searching && hits.length === 0 && <span className="text-xs text-fog-500">suche …</span>}
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              className="rounded-full border border-ink-700 px-2.5 py-0.5 text-xs text-fog-300 hover:border-coral-500"
              onClick={() => {
                onPick(h);
                setQuery('');
                setHits([]);
              }}
            >
              @{h.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
