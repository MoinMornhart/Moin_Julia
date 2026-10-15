'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';

/** Bereiche, die sich live aktualisieren (öffentliche Seiten und die Einrichtung nicht) */
const LIVE_AREAS = ['/g/', '/system', '/servers'];

/**
 * Lädt die Daten der aktuellen Seite jede Sekunde neu (Bot-Status, Listen, Statistiken, Musik …).
 * Pausiert, solange man tippt oder etwas auswählt, ein Dialog offen ist oder der Tab im Hintergrund liegt –
 * so springt nichts unter den Fingern weg und es entsteht keine unnötige Last.
 * In automatischen Tests (Playwright) aus, außer die Adresse enthält ?live=1.
 */
export function LiveRefresh({ intervalMs = 1000 }: { intervalMs?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  // isPending ist true, bis die neuen Daten da und eingebaut sind – solange keine weitere Runde
  const [pending, startTransition] = useTransition();
  const pendingRef = useRef(false);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // Bricht eine Aktualisierung unterwegs ab (Proxy/Netz), wirft Firefox „Error in input stream“ (Issue #12):
  // abfangen statt als Fehler zu melden und 10 s Pause machen
  const pauseUntil = useRef(0);
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason ?? '');
      if (/input stream|network ?error|failed to fetch|load failed|connection closed/i.test(msg)) {
        e.preventDefault();
        pauseUntil.current = Date.now() + 10_000;
      }
    };
    const onError = (e: ErrorEvent) => {
      if (/input stream/i.test(e.message ?? '')) {
        e.preventDefault();
        pauseUntil.current = Date.now() + 10_000;
      }
    };
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
    };
  }, []);

  useEffect(() => {
    if (!LIVE_AREAS.some((a) => pathname === a || pathname.startsWith(a))) return;
    if (navigator.webdriver && !new URLSearchParams(window.location.search).has('live')) return;
    const timer = setInterval(() => {
      if (pendingRef.current || document.hidden || Date.now() < pauseUntil.current || isInteracting()) return;
      // refresh() lädt nur die Server-Daten neu – eingetippte Werte und Scroll-Position bleiben
      startTransition(() => router.refresh());
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, pathname, intervalMs]);

  return null;
}

/** Tippt oder wählt jemand gerade etwas aus, oder ist ein Dialog/Menü offen? */
function isInteracting(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return true;
  if (document.querySelector('dialog[open], [aria-modal="true"], [data-live-pause], details[open][data-pause-open]')) return true;
  const selection = window.getSelection();
  return !!selection && !selection.isCollapsed;
}
