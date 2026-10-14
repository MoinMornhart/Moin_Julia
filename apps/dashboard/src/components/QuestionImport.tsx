'use client';

import { useState } from 'react';
import { IMPORTED_KIND_LABELS, parseQuestions, questionsToFields, type FormField, type ImportedQuestion } from '@moin/shared';

/** „📋 Fragen aus Text übernehmen“: Text einfügen → Fragen + Feldart erkennen → Vorschau → anhängen oder ersetzen */
export function QuestionImport({ existing, onApply }: { existing: FormField[]; onApply: (fields: FormField[]) => void }) {
  const [text, setText] = useState('');
  const [found, setFound] = useState<(ImportedQuestion & { use: boolean })[] | null>(null);

  const apply = (replace: boolean) => {
    const chosen = (found ?? []).filter((q) => q.use);
    const keep = replace ? [] : existing;
    const used = new Set(keep.map((f) => f.id));
    let n = 1;
    const fields = questionsToFields(chosen).map((f) => {
      while (used.has(`q${n}`)) n++;
      used.add(`q${n}`);
      return { ...f, id: `q${n}` };
    });
    onApply([...keep, ...fields].slice(0, 20));
    setFound(null);
    setText('');
  };

  return (
    <details className="rounded-xl border border-ink-700 p-3 text-sm">
      <summary className="cursor-pointer font-semibold">📋 Fragen aus Text übernehmen</summary>
      <div className="mt-3 grid gap-3">
        <p className="text-fog-500">
          Alten Bewerbungstext einfügen (z. B. aus einem Google-Formular oder Discord-Post). Fragen und Feldart werden automatisch erkannt: Auswahl (mit Optionen wie „- Discord“ oder
          „(morgens / abends)“), Ja/Nein, kurzer/langer Text, Zahl, Datum, Datei.
        </p>
        <textarea aria-label="Bewerbungstext" value={text} rows={8} maxLength={20000} className="input font-mono text-xs" placeholder={'1. Wie alt bist du?\n2. Warum möchtest du ins Team?\n3. Wann bist du online? (morgens / abends)'} onChange={(e) => setText(e.target.value)} />
        <button type="button" className="btn-ghost w-fit" disabled={!text.trim()} onClick={() => setFound(parseQuestions(text).map((q) => ({ ...q, use: true })))}>
          Fragen erkennen
        </button>
        {found && (
          <div className="grid gap-2" aria-label="Erkannte Fragen">
            {found.length === 0 ? (
              <p className="text-fog-500">Keine Fragen gefunden – Fragen sollten mit „?“ oder „:“ enden oder nummeriert sein.</p>
            ) : (
              <>
                <ul className="grid gap-1.5">
                  {found.map((q, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1 size-4 accent-coral-500" checked={q.use} aria-label={`Übernehmen: ${q.question}`} onChange={(e) => setFound(found.map((x, j) => (j === i ? { ...x, use: e.target.checked } : x)))} />
                      <span className="min-w-0">
                        {q.question} <span className="rounded-md bg-ink-800 px-1.5 py-0.5 text-xs text-sea-400">{IMPORTED_KIND_LABELS[q.kind]}</span>
                        {q.options.length > 0 && <span className="block text-xs text-fog-500">Optionen: {q.options.join(' · ')}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-primary" onClick={() => apply(false)}>
                    Anhängen ({found.filter((q) => q.use).length})
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => apply(true)}>
                    Bisherige Fragen ersetzen
                  </button>
                </div>
                <p className="text-xs text-fog-500">Danach unten noch „Speichern“ – vorher lässt sich jede Frage wie gewohnt anpassen.</p>
              </>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
