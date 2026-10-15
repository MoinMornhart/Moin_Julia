'use client';

import { useTransition } from 'react';
import { setDummiesUi } from '@/app/ui-actions';

/**
 * Ansicht wählen (Issue #10: statt eines auffälligen Knopfs eine ruhige Auswahl oben rechts):
 * „Standard“ oder „🍼 Für Dummies“ (alles super einfach erklärt, Name von Philip festgelegt). Pro Person gemerkt.
 */
export function DummiesToggle({ on }: { on: boolean }) {
  const [pending, start] = useTransition();
  const choose = (value: boolean) =>
    start(async () => {
      if (value === on) return;
      await setDummiesUi(value);
      // Ganz neu laden: ersetzte Wörter sollen beim Umschalten sicher verschwinden
      window.location.reload();
    });
  const option = (value: boolean, icon: string, label: string, hint: string) => (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={on === value}
      disabled={pending}
      onClick={() => choose(value)}
      className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-ink-800 ${on === value ? 'text-fog-100' : 'text-fog-300'}`}
    >
      <span aria-hidden className="w-4 shrink-0">
        {on === value ? '✓' : ''}
      </span>
      <span>
        <span className="block font-semibold">
          {icon} {label}
        </span>
        <span className="block text-xs text-fog-500">{hint}</span>
      </span>
    </button>
  );
  return (
    <details className="relative" data-pause-open>
      <summary
        className={`flex cursor-pointer list-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition [&::-webkit-details-marker]:hidden ${on ? 'border-sun-400 bg-sun-400/15 text-sun-400' : 'border-ink-700 bg-ink-900/70 text-fog-300 hover:border-coral-500 hover:text-fog-100'}`}
        aria-label={on ? 'Ansicht: Für Dummies' : 'Ansicht: Standard'}
      >
        <span aria-hidden>{on ? '🍼' : '👁️'}</span>
        <span className="hidden sm:inline">Ansicht</span>
      </summary>
      <div role="menu" aria-label="Ansicht" className="absolute right-0 z-30 mt-2 grid w-64 gap-0.5 rounded-xl border border-ink-700 bg-ink-900 p-1.5 text-sm shadow-xl">
        {option(false, '👁️', 'Standard', 'Alles mit den normalen Begriffen')}
        {option(true, '🍼', 'Für Dummies', 'Alles super einfach erklärt – für 1 IQ und weniger')}
      </div>
    </details>
  );
}
