'use client';

import { useState, useTransition } from 'react';

/**
 * Knopf, der eine Server-Action auslöst und das Ergebnis daneben anzeigt.
 * `confirm`: bei Löschen & Co. erst nachfragen („Wirklich …?“ → „Ja“ / „Abbrechen“).
 */
export function ActionButton({
  label,
  run,
  disabled = false,
  confirm,
}: {
  label: string;
  run: () => Promise<{ ok: boolean; message?: string }>;
  disabled?: boolean;
  confirm?: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const go = () => {
    setAsking(false);
    start(async () => setResult(await run()));
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      {asking ? (
        <span className="inline-flex flex-wrap items-center gap-3 text-sm">
          <span className="text-fog-300">{confirm}</span>
          <button type="button" className="font-semibold text-danger-500" disabled={disabled || pending} onClick={go}>
            Ja, {label}
          </button>
          <button type="button" className="text-fog-500" onClick={() => setAsking(false)}>
            Abbrechen
          </button>
        </span>
      ) : (
        <button type="button" className="btn-ghost" disabled={disabled || pending} onClick={() => (confirm ? setAsking(true) : go())}>
          {pending ? '…' : label}
        </button>
      )}
      {result?.message && <span className={`text-sm ${result.ok ? 'text-sea-400' : 'text-danger-500'}`}>{result.message}</span>}
    </span>
  );
}

/** Kleiner Lösch-Knopf mit Rückfrage (gleiches Muster wie „Bewerbung löschen“) */
export function ConfirmButton({
  label,
  question = 'Wirklich?',
  yes = 'Ja, entfernen',
  onConfirm,
  disabled = false,
  className = 'text-xs text-fog-500 hover:text-danger-500',
  ariaLabel,
}: {
  label: React.ReactNode;
  question?: string;
  yes?: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [asking, setAsking] = useState(false);
  if (asking)
    return (
      <span className="inline-flex flex-wrap items-center gap-3 text-xs">
        <span className="text-fog-300">{question}</span>
        <button
          type="button"
          className="font-semibold text-danger-500"
          disabled={disabled}
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
        >
          {yes}
        </button>
        <button type="button" className="text-fog-500" onClick={() => setAsking(false)}>
          Abbrechen
        </button>
      </span>
    );
  return (
    <button type="button" className={className} disabled={disabled} aria-label={ariaLabel} onClick={() => setAsking(true)}>
      {label}
    </button>
  );
}
