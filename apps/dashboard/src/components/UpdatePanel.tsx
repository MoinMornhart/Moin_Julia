'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface Latest {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  changes: string[];
  error?: string;
}
interface State {
  agent: boolean;
  requested: boolean;
  status: { state: 'running' | 'success' | 'failed'; from: string; to: string; at: string } | null;
  log: string;
  latest: Latest;
}

/**
 * System → Update: zeigt aktuelle/neueste Version, startet das Update über den Host-Dienst
 * und zeigt live das Protokoll. Während des Updates startet auch das Dashboard neu –
 * dann wird einfach weiter nachgefragt, bis es wieder da ist.
 */
export function UpdatePanel({ initial }: { initial: State }) {
  const [state, setState] = useState<State>(initial);
  const [offline, setOffline] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);
  const running = state.requested || state.status?.state === 'running';
  const watching = useRef(running);

  const refresh = useCallback(async (force = false) => {
    try {
      const res = await fetch(`/api/system/update${force ? '?pruefen=1' : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      setState((await res.json()) as State);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    if (running) watching.current = true;
    if (!running && !offline) return;
    const t = setInterval(() => void refresh(), 2000);
    return () => clearInterval(t);
  }, [running, offline, refresh]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [state.log]);

  const { latest, status } = state;
  const finished = watching.current && !running && status && status.state !== 'running';

  async function start() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/system/update', { method: 'POST' });
      const data = (await res.json()) as { ok: boolean; message: string };
      setMessage({ ok: data.ok, text: data.message });
      if (data.ok) {
        watching.current = true;
        await refresh();
      }
    } catch {
      setMessage({ ok: false, text: 'Anfrage fehlgeschlagen.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="update" className="card mt-8 grid gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Update</h2>
          <p className="mt-1 text-sm text-fog-300">
            Läuft: <b className="font-mono">v{latest.current}</b>
            {latest.latest && (
              <>
                {' '}
                · Neueste: <b className="font-mono">v{latest.latest}</b>
              </>
            )}
          </p>
        </div>
        <button type="button" className="btn-ghost" disabled={running} onClick={() => void refresh(true)}>
          Erneut prüfen
        </button>
      </div>

      {latest.error ? (
        <p className="text-sm text-sun-400">GitHub nicht erreichbar ({latest.error}).</p>
      ) : latest.updateAvailable ? (
        <div className="grid gap-2 rounded-xl border border-coral-500/40 bg-coral-500/5 p-4">
          <p className="font-semibold text-coral-400">⬆ Update auf v{latest.latest} verfügbar</p>
          {latest.changes.length > 0 && (
            <ul className="grid list-disc gap-0.5 pl-5 text-sm text-fog-300">
              {latest.changes.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-sm text-sea-400">✓ Du bist auf dem neuesten Stand.</p>
      )}

      {!state.agent ? (
        <div className="rounded-xl border border-sun-400/40 p-4 text-sm text-fog-300">
          <p className="font-semibold text-fog-100">Update-Knopf einmalig einrichten</p>
          <p className="mt-1">
            Damit das Dashboard Updates starten darf, einmal im Container ausführen (danach bleibt es eingerichtet, auch nach Updates):
          </p>
          <code className="mt-2 block rounded-lg bg-ink-950 p-2 text-xs">moin-julia update-knopf</code>
          <p className="mt-2 text-xs text-fog-500">Bis dahin geht das Update wie gewohnt im Terminal mit <code>update</code>.</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" disabled={busy || running} onClick={() => void start()}>
            {running ? 'Update läuft …' : latest.updateAvailable ? `Jetzt auf v${latest.latest} updaten` : 'Update trotzdem ausführen'}
          </button>
          <span className="text-xs text-fog-500">Mit Backup vorher und automatischem Zurückrollen bei Fehlern.</span>
        </div>
      )}

      {message && <p className={`text-sm ${message.ok ? 'text-sea-400' : 'text-danger-500'}`}>{message.text}</p>}
      {offline && <p className="text-sm text-sun-400">Das Dashboard startet gerade neu – ich frage weiter nach …</p>}
      {finished && status?.state === 'success' && (
        <p className="text-sm text-sea-400">
          ✓ Update fertig: v{status.from} → v{status.to}.{' '}
          <button type="button" className="underline" onClick={() => location.reload()}>
            Seite neu laden
          </button>
        </p>
      )}
      {finished && status?.state === 'failed' && (
        <p className="text-sm text-danger-500">✗ Update fehlgeschlagen – es wurde automatisch auf v{status.from} zurückgerollt. Details im Protokoll unten.</p>
      )}

      {(running || state.log) && (
        <pre ref={logRef} className="max-h-72 overflow-auto rounded-xl bg-ink-950 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-fog-300" aria-live="polite">
          {state.log || 'Warte auf den Server …'}
        </pre>
      )}
    </section>
  );
}
