'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setDummiesUi } from '@/app/ui-actions';

/** 🍼-Knopf oben rechts: Dashboard super einfach erklärt an/aus */
export function DummiesToggle({ on }: { on: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={pending}
      title={on ? '„Für Dummies“ ist an – zurück zur normalen Ansicht' : 'Alles super einfach erklärt („Für Dummies“)'}
      onClick={() =>
        start(async () => {
          await setDummiesUi(!on);
          router.refresh();
        })
      }
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on ? 'border-sun-400 bg-sun-400/15 text-sun-400' : 'border-ink-700 bg-ink-900/70 text-fog-300 hover:border-sun-400 hover:text-fog-100'}`}
    >
      <span aria-hidden>🍼</span>
      <span className="hidden sm:inline">{on ? 'Für Dummies: an' : 'Für Dummies'}</span>
      <span className="sr-only sm:hidden">Für Dummies</span>
    </button>
  );
}
