'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CHANGE_TYPE_LABELS, CHANGELOG, type ChangeType } from '@moin/shared';

interface Latest {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  changes: string[];
  error?: string;
}

const TYPE_CLS: Record<ChangeType, string> = {
  neu: 'border-sea-500/30 bg-sea-500/15 text-sea-400',
  besser: 'border-[#2f8bff]/30 bg-[#2f8bff]/15 text-[#7cb6ff]',
  fix: 'border-sun-400/30 bg-sun-400/15 text-sun-400',
};

/**
 * Versionszeile unten mittig (wie in VibeWorks): „Moin_Julia · v0.9.0 · abc1234“.
 * Drüberfahren: kurzer Hinweis, ob es ein Update gibt (Prüfung gegen GitHub, serverseitig zwischengespeichert).
 * Klick: Änderungsverlauf mit installierter Version, Update-Hinweis und allen Versionen.
 */
export function VersionFooter({ version, commit }: { version: string; commit: string | null }) {
  const [info, setInfo] = useState<Latest | null>(null);
  const [hover, setHover] = useState(false);
  const loaded = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const guildBase = /^\/g\/(\d+)/.exec(pathname)?.[0] ?? null;
  const short = commit?.slice(0, 7) ?? null;

  async function load() {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const res = await fetch('/api/version');
      setInfo(res.ok ? ((await res.json()) as Latest) : { current: version, latest: null, updateAvailable: false, changes: [], error: 'Prüfung fehlgeschlagen' });
    } catch {
      setInfo({ current: version, latest: null, updateAvailable: false, changes: [], error: 'keine Verbindung' });
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void load(), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur einmal
  }, []);

  const resolve = (link?: string) => (!link ? null : link.startsWith('g:') ? (guildBase ? `${guildBase}/${link.slice(2)}`.replace(/\/$/, '') : null) : link);
  const status = !info ? 'Prüfe auf Updates …' : info.error ? `Update-Prüfung: ${info.error}` : info.updateAvailable ? `Update verfügbar: v${info.latest}` : 'Du bist auf dem neuesten Stand ✓';

  return (
    <footer className="px-4 pt-10 pb-6 text-center text-xs text-fog-500">
      <span className="relative inline-block" onMouseEnter={() => (setHover(true), void load())} onMouseLeave={() => setHover(false)}>
        Moin_Julia ·{' '}
        <button
          type="button"
          onFocus={() => (setHover(true), void load())}
          onBlur={() => setHover(false)}
          onClick={() => dialog.current?.showModal()}
          className="rounded transition hover:text-fog-100 hover:underline"
          aria-haspopup="dialog"
        >
          v{version}
          {short && <span className="font-mono"> · {short}</span>}
          {info?.updateAvailable && <span className="ml-1.5 inline-block size-1.5 animate-pulse rounded-full bg-coral-500 align-middle" aria-label="Update verfügbar" />}
        </button>
        {hover && (
          <span
            role="status"
            className={`enter-fade absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-lg border border-ink-700 bg-ink-900 px-3 py-1.5 whitespace-nowrap shadow-xl ${info?.updateAvailable ? 'text-coral-400' : 'text-fog-300'}`}
          >
            {status}
          </span>
        )}
      </span>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        className="changelog m-auto w-[min(42rem,calc(100vw-2rem))] max-h-[85dvh] rounded-2xl border border-ink-700 bg-ink-900 p-0 text-left text-sm text-fog-100 shadow-2xl backdrop:bg-ink-950/70 backdrop:backdrop-blur-sm"
        aria-labelledby="changelog-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-800 bg-ink-900/95 px-5 py-4 backdrop-blur">
          <h2 id="changelog-title" className="font-display text-lg font-semibold">
            Änderungsverlauf
          </h2>
          <button type="button" onClick={() => dialog.current?.close()} className="grid size-8 place-items-center rounded-lg text-fog-500 hover:bg-ink-800 hover:text-fog-100" aria-label="Schließen">
            ✕
          </button>
        </div>
        <div className="grid gap-6 p-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-ink-700 bg-ink-950/40 px-4 py-3">
            <span>
              Installiert: <strong>v{version}</strong>
            </span>
            {short && <span className="font-mono text-fog-500">{short}</span>}
            <span className={info?.updateAvailable ? 'font-semibold text-coral-400' : 'text-fog-500'}>{status}</span>
            {info?.updateAvailable && (
              <a href="/system#update" className="btn-primary ml-auto px-3 py-1.5 text-xs">
                Zum Update
              </a>
            )}
          </div>
          {info?.updateAvailable && info.changes.length > 0 && (
            <div className="rounded-xl border border-coral-500/40 bg-coral-500/5 p-4">
              <p className="font-semibold text-coral-400">Neu in v{info.latest}</p>
              <ul className="mt-2 grid list-disc gap-1 pl-5 text-fog-300">
                {info.changes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          <ol className="grid gap-6">
            {CHANGELOG.map((entry) => (
              <li key={entry.version}>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-mono text-sm text-coral-400">v{entry.version}</span>
                  <span className="font-semibold">{entry.title}</span>
                  <span className="text-xs text-fog-500">{new Date(entry.date).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}</span>
                  {entry.version === version && <span className="rounded-full bg-coral-500/15 px-2 py-0.5 text-[11px] font-semibold text-coral-400">installiert</span>}
                </div>
                <ul className="mt-2 grid gap-1.5">
                  {entry.changes.map((c, i) => {
                    const href = resolve(c.link);
                    return (
                      <li key={i} className="flex items-start gap-2">
                        <span className={`mt-0.5 shrink-0 rounded-md border px-1.5 text-[11px] font-semibold ${TYPE_CLS[c.type]}`}>{CHANGE_TYPE_LABELS[c.type]}</span>
                        <span className="text-fog-300">
                          {c.text}
                          {href && (
                            <>
                              {' '}
                              <Link href={href} onClick={() => dialog.current?.close()} className="whitespace-nowrap text-coral-400 hover:underline">
                                Ansehen →
                              </Link>
                            </>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </dialog>
    </footer>
  );
}
