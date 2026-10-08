'use client';

import { useEffect, useState } from 'react';
import { LogoMark } from './Logo';

/**
 * „Mit Discord anmelden“ mit kurzem Übergang: Kapitänin Julia + „Leinen los …“, bis Discord übernimmt.
 * Kommt man per Zurück-Taste wieder (Seiten-Cache), verschwindet der Übergang wieder.
 */
export function LoginButton({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reset = () => setLeaving(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  return (
    <>
      <a href={href} onClick={() => setLeaving(true)} className={`shine ${className}`}>
        {children}
      </a>
      {leaving && (
        <div className="enter-fade fixed inset-0 z-50 grid place-items-center bg-ink-950/85 backdrop-blur-md" role="status" aria-live="polite">
          <div className="grid justify-items-center gap-5 text-center">
            <div className="relative">
              <span className="absolute inset-0 -z-10 animate-ping rounded-[2rem] bg-coral-500/30" aria-hidden />
              <LogoMark className="size-24" animated />
            </div>
            <div>
              <p className="font-display text-2xl font-bold">Leinen los …</p>
              <p className="mt-1 text-sm text-fog-300">Verbinde mit Discord</p>
            </div>
            <span className="spinner size-6 rounded-full border-2 border-ink-700 border-t-coral-500" aria-hidden />
          </div>
        </div>
      )}
    </>
  );
}
