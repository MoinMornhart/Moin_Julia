'use client';

import { useState } from 'react';
import type { KeywordRule } from '@moin/shared';

const newId = (rules: KeywordRule[]) => {
  let id = `r${Date.now().toString(36)}`;
  while (rules.some((r) => r.id === id)) id = `r${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  return id;
};

/**
 * Stichwort-Regeln: Fällt ein Stichwort, bekommt Julia eine Zusatzanweisung – und antwortet auf Wunsch
 * in einem bestimmten Modus. Wird als JSON im Feld „keywordRules“ gespeichert.
 */
export function KeywordRulesEditor({ initial, modes }: { initial: KeywordRule[]; modes: { id: string; name: string }[] }) {
  const [rules, setRules] = useState<KeywordRule[]>(initial);
  const set = (i: number, patch: Partial<KeywordRule>) => setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="grid gap-2 text-sm">
      <input type="hidden" name="keywordRules" value={JSON.stringify(rules.filter((r) => r.words.trim()))} />
      {rules.length === 0 && <p className="text-xs text-fog-500">Noch keine Regeln.</p>}
      <ul className="grid gap-2" aria-label="Stichwort-Regeln">
        {rules.map((r, i) => (
          <li key={r.id} className="grid gap-2 rounded-xl border border-ink-700 bg-ink-900 p-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto] sm:items-end">
              <label className="grid gap-1">
                <span className="text-fog-300">Stichwörter (mit Komma)</span>
                <input aria-label={`Stichwörter Regel ${i + 1}`} value={r.words} maxLength={300} onChange={(e) => set(i, { words: e.target.value })} placeholder="z. B. Regeln, Regelwerk" className="input" />
              </label>
              <label className="grid gap-1">
                <span className="text-fog-300">Antworten im Modus</span>
                <select aria-label={`Modus Regel ${i + 1}`} value={r.modeId} onChange={(e) => set(i, { modeId: e.target.value })} className="input">
                  <option value="">wie gerade eingestellt</option>
                  {modes.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="pb-2 text-xs text-fog-500 hover:text-danger-500" onClick={() => setRules(rules.filter((_, j) => j !== i))} aria-label={`Regel ${i + 1} entfernen`}>
                ✕ entfernen
              </button>
            </div>
            <label className="grid gap-1">
              <span className="text-fog-300">Was Julia dann tun soll</span>
              <textarea
                aria-label={`Anweisung Regel ${i + 1}`}
                value={r.instruction}
                maxLength={600}
                rows={2}
                onChange={(e) => set(i, { instruction: e.target.value })}
                placeholder="z. B. Verweise freundlich auf #regeln und fasse die wichtigsten drei Regeln kurz zusammen."
                className="input"
              />
            </label>
          </li>
        ))}
      </ul>
      {rules.length < 20 && (
        <div>
          <button type="button" className="btn-ghost" onClick={() => setRules([...rules, { id: newId(rules), words: '', instruction: '', modeId: '' }])}>
            + Regel
          </button>
        </div>
      )}
      <p className="text-xs text-fog-500">Ganze Wörter, Groß/klein egal. Julias Grundregeln gelten weiterhin – eine Regel kann sie nicht aushebeln.</p>
    </div>
  );
}
