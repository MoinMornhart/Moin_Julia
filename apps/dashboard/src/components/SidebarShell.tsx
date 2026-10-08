'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Rahmen der Seitenleiste: am Desktop fest links, am Handy eine Kopfzeile mit Menü-Knopf,
 * die Leiste gleitet von links herein (schließt bei Seitenwechsel, Escape oder Tipp daneben).
 */
export function SidebarShell({ top, children }: { top: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink-800 bg-ink-950/80 px-4 py-3 backdrop-blur lg:hidden">
        {top}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menü öffnen"
          aria-expanded={open}
          aria-controls="sidebar"
          className="grid size-10 place-items-center rounded-xl border border-ink-700 bg-ink-900 text-fog-100"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h10" />
          </svg>
        </button>
      </div>

      <div
        className={`fixed inset-0 z-40 bg-ink-950/70 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside
        id="sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-ink-800 bg-ink-950 px-4 py-5 transition-transform duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-68 lg:max-w-none lg:translate-x-0 lg:bg-transparent ${
          open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Menü schließen"
          className="absolute top-4 right-4 grid size-9 place-items-center rounded-lg text-fog-500 hover:bg-ink-850 hover:text-fog-100 lg:hidden"
        >
          ✕
        </button>
        {children}
      </aside>
    </>
  );
}
