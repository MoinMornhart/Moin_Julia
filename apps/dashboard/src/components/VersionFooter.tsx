'use client';

import { useEffect, useRef, useState } from 'react';

interface Latest {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  changes: string[];
  error?: string;
}

/**
 * Version unten mittig auf jeder Seite. Beim Drüberfahren, Fokussieren oder Antippen
 * wird bei GitHub nachgesehen, ob es ein Update gibt (serverseitig 10 Minuten zwischengespeichert).
 */
export function VersionFooter({ version }: { version: string }) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<Latest | null>(null);
  const [loading, setLoading] = useState(false);
  const loaded = useRef(false);
  const box = useRef<HTMLDivElement>(null);

  async function load() {
    if (loaded.current) return;
    loaded.current = true;
    setLoading(true);
    try {
      const res = await fetch('/api/version');
      setInfo(res.ok ? ((await res.json()) as Latest) : { current: version, latest: null, updateAvailable: false, changes: [], error: 'Prüfung fehlgeschlagen' });
    } catch {
      setInfo({ current: version, latest: null, updateAvailable: false, changes: [], error: 'Keine Verbindung' });
    } finally {
      setLoading(false);
    }
  }

  // Leise im Hintergrund prüfen, damit ein Punkt auf ein Update hinweisen kann
  useEffect(() => {
    const t = setTimeout(() => void load(), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur einmal beim Laden
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const show = () => {
    setOpen(true);
    void load();
  };

  return (
    <footer className="flex justify-center px-4 pt-10 pb-6">
      <div ref={box} className="relative" onMouseEnter={show} onMouseLeave={() => setOpen(false)}>
        <button
          type="button"
          onFocus={show}
          onClick={() => (open ? setOpen(false) : show())}
          aria-expanded={open}
          aria-controls="version-info"
          className="flex min-h-9 items-center gap-2 rounded-full border border-ink-700 bg-ink-900/70 px-3.5 py-1.5 font-mono text-xs text-fog-500 transition hover:border-ink-600 hover:text-fog-300"
        >
          Moin_Julia v{version}
          {info?.updateAvailable && <span className="size-2 rounded-full bg-coral-500" aria-label="Update verfügbar" />}
        </button>
        {open && (
          <div
            id="version-info"
            role="status"
            className="absolute bottom-full left-1/2 z-50 mb-2 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-ink-700 bg-ink-900 p-4 text-left text-sm shadow-2xl"
          >
            {loading || !info ? (
              <p className="text-fog-300">Prüfe auf Updates …</p>
            ) : info.error ? (
              <p className="text-fog-300">Konnte nicht prüfen ({info.error}). Läuft gerade: v{version}.</p>
            ) : info.updateAvailable ? (
              <div className="grid gap-2">
                <p className="font-semibold text-coral-400">
                  ⬆ Update verfügbar: v{info.latest}
                </p>
                {info.changes.length > 0 && (
                  <ul className="grid list-disc gap-0.5 pl-4 text-xs text-fog-300">
                    {info.changes.slice(0, 5).map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
                <a href="/system#update" className="btn-primary mt-1 w-fit px-3 py-1.5 text-xs">
                  Zum Update
                </a>
              </div>
            ) : (
              <p className="text-sea-400">✓ Du bist auf dem neuesten Stand (v{version}).</p>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
