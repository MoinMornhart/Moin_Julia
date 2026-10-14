'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import type { CopyJob } from '@moin/shared';
import { analyzeCopy, cancelCopy, copySources, copyStatus, startCopy, undoCopy, type CopyAnalysis, type CopySource } from '@/app/g/[guildId]/vorlagen/kopieren/actions';

const LIMITS = [
  { value: 0, label: 'keine' },
  { value: 50, label: 'letzte 50' },
  { value: 100, label: 'letzte 100' },
  { value: 500, label: 'letzte 500' },
  { value: 1000, label: 'letzte 1000' },
];

const STATUS_LABEL: Record<CopyJob['status'], string> = { queued: '⏳ Wartet', running: '🔄 Läuft', done: '✅ Fertig', failed: '❌ Fehlgeschlagen', cancelled: '⏹️ Abgebrochen' };

/** Server kopieren: Quelle wählen → Vorschau → starten → Fortschritt */
export function ServerCopy({ guildId, canEdit, initial }: { guildId: string; canEdit: boolean; initial: CopyJob | null }) {
  const [sources, setSources] = useState<CopySource[] | null>(null);
  const [source, setSource] = useState('');
  const [roles, setRoles] = useState(true);
  const [channels, setChannels] = useState(true);
  const [messages, setMessages] = useState(100);
  const [analysis, setAnalysis] = useState<CopyAnalysis | null>(null);
  const [asking, setAsking] = useState(false);
  const [job, setJob] = useState<CopyJob | null>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const active = job?.status === 'queued' || job?.status === 'running';

  useEffect(() => {
    if (!canEdit) return;
    void copySources(guildId).then((r) => (r.ok ? setSources(r.sources ?? []) : setMsg({ ok: false, text: r.message ?? 'Fehler' })));
  }, [guildId, canEdit]);

  const refresh = useCallback(async () => setJob(await copyStatus(guildId)), [guildId]);
  // Fortschritt alle 2 s, solange es läuft
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(t);
  }, [active, refresh]);

  const choose = (id: string) => {
    setSource(id);
    setAnalysis(null);
    setAsking(false);
    setMsg(null);
    if (!id) return;
    start(async () => {
      const r = await analyzeCopy(guildId, id);
      if (r.ok) setAnalysis(r.analysis ?? null);
      else setMsg({ ok: false, text: r.message ?? 'Fehler' });
    });
  };

  const go = () =>
    start(async () => {
      setAsking(false);
      const r = await startCopy(guildId, source, { roles, channels: channels || messages > 0, messages });
      setMsg({ ok: r.ok, text: r.message });
      await refresh();
    });

  const pct = job && job.counts.messageTotal ? Math.round((job.counts.messages / job.counts.messageTotal) * 100) : job?.status === 'done' ? 100 : 0;
  const sourceName = sources?.find((s) => s.id === source)?.name ?? '';

  return (
    <div className="grid max-w-4xl gap-6">
      {job && (
        <section className="card grid gap-3 p-5" aria-label="Letzte Kopie">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              {STATUS_LABEL[job.status]} – von „{job.sourceName}“
            </p>
            <span className="text-xs text-fog-500 tabular-nums">{new Date(job.startedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
          <p className="text-sm text-fog-300" aria-live="polite">
            {job.step}
          </p>
          {job.options.messages > 0 && (
            <div className="h-2 overflow-hidden rounded-full bg-ink-800" role="progressbar" aria-label="Fortschritt Nachrichten" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <i className="block h-full bg-coral-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-fog-300">
            <li>🏷️ {job.counts.roles} Rollen neu{job.counts.reusedRoles ? ` · ${job.counts.reusedRoles} mitbenutzt` : ''}</li>
            <li>💬 {job.counts.channels} Kanäle neu{job.counts.reusedChannels ? ` · ${job.counts.reusedChannels} mitbenutzt` : ''}</li>
            {job.options.messages > 0 && (
              <li>
                ✉️ {job.counts.messages} / {job.counts.messageTotal} Nachrichten
              </li>
            )}
          </ul>
          {job.errors.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-sun-400">⚠️ {job.errors.length} Hinweis(e)</summary>
              <ul className="mt-2 grid gap-1 text-fog-300">
                {job.errors.slice(0, 50).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex flex-wrap gap-3">
            {active && (
              <button type="button" className="btn-ghost" disabled={!canEdit || pending} onClick={() => start(async () => setMsg(await cancelCopy(guildId).then((r) => ({ ok: r.ok, text: r.message }))))}>
                ⏹️ Abbrechen
              </button>
            )}
            {!active && job.created.roleIds.length + job.created.channelIds.length > 0 && (
              <button
                type="button"
                className="btn-ghost"
                disabled={!canEdit || pending}
                onClick={() =>
                  start(async () => {
                    const r = await undoCopy(guildId);
                    setMsg({ ok: r.ok, text: r.message });
                    await refresh();
                  })
                }
              >
                🧹 Angelegtes wieder löschen ({job.created.channelIds.length} Kanäle, {job.created.roleIds.length} Rollen)
              </button>
            )}
          </div>
        </section>
      )}

      <section className="card grid gap-4 p-5" aria-label="Neue Kopie">
        <h2 className="font-display text-xl font-semibold">Von einem anderen Server kopieren</h2>
        {!canEdit ? (
          <p className="text-fog-300">Nur Owner und Administratoren können Server kopieren.</p>
        ) : sources === null ? (
          <p className="text-fog-500">Lade Server …</p>
        ) : sources.length === 0 ? (
          <p className="text-fog-300">Kein anderer Server gefunden: Der Bot muss dort auch sein, und du musst dort Owner oder Administrator sein.</p>
        ) : (
          <>
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold">Quell-Server</span>
              <select className="input" value={source} onChange={(e) => choose(e.target.value)} disabled={active || pending} aria-label="Quell-Server">
                <option value="">Server wählen …</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="grid gap-2" disabled={active || pending}>
              <legend className="mb-1 text-sm font-semibold">Was soll mit?</legend>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={roles} onChange={(e) => setRoles(e.target.checked)} /> Rollen (Namen, Farben, Rechte)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={channels || messages > 0} disabled={messages > 0} onChange={(e) => setChannels(e.target.checked)} /> Kategorien &amp; Kanäle mit Rechten
              </label>
              <label className="flex flex-wrap items-center gap-2">
                Nachrichten pro Textkanal:
                <select className="input w-auto" value={messages} onChange={(e) => setMessages(Number(e.target.value))} aria-label="Nachrichten pro Kanal">
                  {LIMITS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
            {analysis && (
              <div className="rounded-xl border border-ink-700 p-3 text-sm" aria-label="Vorschau Kopie">
                <p className="mb-1 font-semibold">Vorschau</p>
                <ul className="grid gap-0.5 text-fog-300">
                  {roles && (
                    <li>
                      🏷️ {analysis.roles.create} Rollen neu, {analysis.roles.reuse} gleichnamige werden mitbenutzt
                    </li>
                  )}
                  <li>
                    💬 {analysis.channels.create} Kanäle/Kategorien neu, {analysis.channels.reuse} gleichnamige werden mitbenutzt
                  </li>
                  {messages > 0 && (
                    <li>
                      ✉️ bis zu {messages} Nachrichten aus {analysis.textChannels} Textkanälen – mit Name, Bild und Datum der ursprünglichen Person
                    </li>
                  )}
                </ul>
                <p className="mt-2 text-xs text-fog-500">
                  Vorhandenes wird nie verändert oder gelöscht. Bot-Rollen, Threads und Personen-Rechte werden nicht kopiert; Rechte nur so weit, wie der Bot sie selbst hat
                  (nie Administrator). Nachrichten kommen per Webhook (Discord zeigt „APP“ daneben), viele Nachrichten dauern ein paar Minuten.
                </p>
              </div>
            )}
            {asking ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-fog-300">„{sourceName}“ wirklich hierher kopieren? Beide Server bekommen einen Hinweis im Log-Kanal.</span>
                <button type="button" className="font-semibold text-coral-400" onClick={go} disabled={pending}>
                  Ja, kopieren
                </button>
                <button type="button" className="text-fog-500" onClick={() => setAsking(false)}>
                  Abbrechen
                </button>
              </div>
            ) : (
              <button type="button" className="btn-primary justify-self-start" disabled={!source || !analysis || active || pending} onClick={() => setAsking(true)}>
                📋 Kopieren …
              </button>
            )}
          </>
        )}
        {msg && <p className={`text-sm ${msg.ok ? 'text-sea-400' : 'text-danger-500'}`}>{msg.text}</p>}
      </section>
    </div>
  );
}
