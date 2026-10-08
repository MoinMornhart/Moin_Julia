'use client';

import { useState, useTransition } from 'react';

/** Knopf, der eine Server-Action auslöst und das Ergebnis daneben anzeigt */
export function ActionButton({ label, run, disabled = false }: { label: string; run: () => Promise<{ ok: boolean; message?: string }>; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button type="button" className="btn-ghost" disabled={disabled || pending} onClick={() => start(async () => setResult(await run()))}>
        {pending ? '…' : label}
      </button>
      {result?.message && <span className={`text-sm ${result.ok ? 'text-sea-400' : 'text-danger-500'}`}>{result.message}</span>}
    </span>
  );
}
