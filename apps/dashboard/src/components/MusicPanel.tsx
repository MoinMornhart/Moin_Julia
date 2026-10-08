'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { formatClock, LOOP_LABELS, LOOP_MODES, type LoopMode, type MusicConfig, type MusicPreset, type MusicState } from '@moin/shared';
import { musicControl, saveMusicSettings, searchRadio, type RadioHit } from '@/app/g/[guildId]/musik/actions';

/** „Jetzt läuft“ mit Steuerknöpfen – aktualisiert sich alle 5 Sekunden */
export function NowPlaying({ guildId, state, channelName, canControl }: { guildId: string; state: MusicState | null; channelName: string | null; canControl: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(() => router.refresh(), 5000);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [router]);
  const run = (action: string) =>
    start(async () => {
      const r = await musicControl(guildId, action);
      setMessage(r.message ?? null);
      setTimeout(() => router.refresh(), 800);
    });
  const cur = state?.current;

  return (
    <div className="card grid gap-4 p-5 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-3xl" aria-hidden>
          {cur ? (cur.kind === 'radio' ? '📻' : '🎧') : '🎵'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-[0.15em] text-fog-500 uppercase">{cur ? (state?.paused ? 'Pausiert' : 'Jetzt läuft') : 'Gerade still'}</p>
          <p className="truncate font-display text-xl font-semibold">{cur ? cur.title : 'Nichts in der Warteschlange'}</p>
          <p className="text-xs text-fog-500">
            {cur ? `${channelName ? `🔊 ${channelName} · ` : ''}${cur.kind === 'file' && cur.startedAt ? `⏱ ${formatClock(now - cur.startedAt)} · ` : ''}Lautstärke ${state?.volume ?? '–'} % · Wiederholen: ${LOOP_LABELS[state?.loop ?? 'off']}` : 'In Discord: Sprachkanal betreten und /musik play eingeben.'}
          </p>
        </div>
      </div>
      {cur && canControl && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary px-4" disabled={pending} onClick={() => run('pause')} aria-label={state?.paused ? 'Weiter' : 'Pause'}>
            {state?.paused ? '▶️ Weiter' : '⏸️ Pause'}
          </button>
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => run('skip')}>
            ⏭️ Weiter zum nächsten
          </button>
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => run('voldown')} aria-label="Leiser">
            🔉
          </button>
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => run('volup')} aria-label="Lauter">
            🔊
          </button>
          <select aria-label="Wiederholen" value={state?.loop ?? 'off'} disabled={pending} onChange={(e) => run(`loop:${e.target.value as LoopMode}`)} className="input w-auto py-2">
            {LOOP_MODES.map((m) => (
              <option key={m} value={m}>
                🔁 {LOOP_LABELS[m]}
              </option>
            ))}
          </select>
          <button type="button" className="btn-ghost text-danger-500" disabled={pending} onClick={() => run('stop')}>
            ⏹️ Stopp
          </button>
          {message && <span className="text-xs text-fog-500">{message}</span>}
        </div>
      )}
      {state && state.queue.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-fog-300">Danach ({state.queue.length})</p>
          <ol className="grid gap-1 text-fog-300">
            {state.queue.slice(0, 10).map((q, i) => (
              <li key={`${q.url}-${i}`} className="truncate">
                {i + 1}. {q.kind === 'radio' ? '📻' : '🎧'} {q.title}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** Einstellungen + Favoriten mit Sendersuche */
export function MusicSettings({ guildId, canEdit, config, roles }: { guildId: string; canEdit: boolean; config: MusicConfig; roles: { id: string; name: string }[] }) {
  const router = useRouter();
  const [c, setC] = useState<MusicConfig>(config);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<RadioHit[]>([]);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [manual, setManual] = useState<MusicPreset>({ name: '', url: '' });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<MusicConfig>) => setC({ ...c, ...patch });
  const search = () =>
    start(async () => {
      const r = await searchRadio(guildId, query);
      setHits(r.hits);
      setSearchMsg(r.message ?? null);
    });
  const addPreset = (p: MusicPreset) => c.presets.length < 25 && !c.presets.some((x) => x.url === p.url) && set({ presets: [...c.presets, p] });

  return (
    <fieldset disabled={!canEdit || pending} className="grid max-w-4xl gap-6">
      <div className="card grid gap-4 p-6 text-sm">
        <p className="font-display text-lg font-semibold">⭐ Favoriten</p>
        <p className="text-fog-500">Erscheinen in Discord zuerst, wenn man /musik play tippt.</p>
        {c.presets.length === 0 && <p className="text-fog-500">Noch keine Favoriten.</p>}
        <ul className="grid gap-2">
          {c.presets.map((p, i) => (
            <li key={`${p.url}-${i}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-700 px-3 py-2">
              <input aria-label={`Name von Favorit ${i + 1}`} value={p.name} maxLength={60} onChange={(e) => set({ presets: c.presets.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} className="input min-w-0 flex-1 py-1.5" />
              <span className="min-w-0 flex-[2] truncate font-mono text-xs text-fog-500" title={p.url}>
                {p.url}
              </span>
              <button type="button" aria-label="Favorit entfernen" className="px-2 text-fog-500 hover:text-danger-500" onClick={() => set({ presets: c.presets.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 rounded-xl border border-dashed border-ink-600 p-3">
          <span className="font-semibold">📻 Radiosender suchen</span>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="Sendername"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  search();
                }
              }}
              placeholder="z. B. 1LIVE, Radio Hamburg, Lofi"
              className="input min-w-0 flex-1"
            />
            <button
              type="button"
              className="btn-ghost"
              onClick={search}
            >
              Suchen
            </button>
          </div>
          {searchMsg && <p className="text-xs text-fog-500">{searchMsg}</p>}
          {hits.length > 0 && (
            <ul className="grid gap-1" aria-label="Suchergebnisse">
              {hits.map((h) => (
                <li key={h.url} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    {h.name} <span className="text-xs text-fog-500">{[h.country, h.bitrate ? `${h.bitrate} kbit/s` : ''].filter(Boolean).join(' · ')}</span>
                  </span>
                  <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => addPreset({ name: h.name, url: h.url })}>
                    + Favorit
                  </button>
                </li>
              ))}
            </ul>
          )}
          <span className="mt-2 font-semibold">🔗 Oder eigenen Link</span>
          <div className="flex flex-wrap gap-2">
            <input aria-label="Name für eigenen Link" value={manual.name} maxLength={60} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="Name" className="input w-40" />
            <input aria-label="Eigener Audio-Link" value={manual.url} maxLength={500} onChange={(e) => setManual({ ...manual, url: e.target.value })} placeholder="https://…/stream.mp3" className="input min-w-0 flex-1 font-mono text-xs" />
            <button
              type="button"
              className="btn-ghost"
              disabled={!manual.name.trim() || !/^https?:\/\//.test(manual.url)}
              onClick={() => {
                addPreset({ name: manual.name.trim(), url: manual.url.trim() });
                setManual({ name: '', url: '' });
              }}
            >
              + Favorit
            </button>
          </div>
        </div>
      </div>

      <div className="card grid gap-4 p-6 text-sm">
        <p className="font-display text-lg font-semibold">Einstellungen</p>
        <div className="grid gap-1.5">
          <span className="font-semibold">DJ-Rollen</span>
          <span className="text-xs text-fog-500">Leer = alle, die im selben Sprachkanal sind, dürfen steuern. Admins dürfen immer.</span>
          <div className="flex flex-wrap gap-1.5">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={c.djRoleIds.includes(r.id)}
                onClick={() => set({ djRoleIds: c.djRoleIds.includes(r.id) ? c.djRoleIds.filter((x) => x !== r.id) : [...c.djRoleIds, r.id] })}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${c.djRoleIds.includes(r.id) ? 'border-coral-500 bg-coral-500/15 text-coral-400' : 'border-ink-700 text-fog-300 hover:border-ink-600'}`}
              >
                @ {r.name}
              </button>
            ))}
          </div>
        </div>
        <label className="grid max-w-md gap-1.5">
          <span className="font-semibold">Start-Lautstärke: {c.defaultVolume} %</span>
          <input type="range" min={1} max={100} value={c.defaultVolume} onChange={(e) => set({ defaultVolume: Number(e.target.value) })} className="accent-coral-500" />
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="grid gap-1">
            <span className="text-fog-300">Warteschlange höchstens</span>
            <input type="number" min={1} max={200} value={c.maxQueue} onChange={(e) => set({ maxQueue: Math.max(1, Math.min(200, Number(e.target.value) || 1)) })} className="input w-28" />
          </label>
          <label className="grid gap-1">
            <span className="text-fog-300">Kanal verlassen nach (still/allein)</span>
            <span className="flex items-center gap-2">
              <input type="number" min={10} max={3600} value={c.leaveAfterSeconds} onChange={(e) => set({ leaveAfterSeconds: Math.max(10, Math.min(3600, Number(e.target.value) || 10)) })} className="input w-28" />
              <span className="text-fog-500">Sekunden</span>
            </span>
          </label>
        </div>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={c.allowPrivateUrls} onChange={(e) => set({ allowPrivateUrls: e.target.checked })} className="mt-1 size-4 accent-coral-500" />
          <span>
            <b>Links ins eigene Netz erlauben</b> (z. B. Musik vom NAS: <code>http://192.168.1.20/…</code>)
            <span className="block text-xs text-sun-400">Achtung: Dann kann jede Person mit Musik-Rechten den Bot Adressen in deinem Heimnetz abrufen lassen. Nur einschalten, wenn du den Leuten vertraust.</span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            start(async () => {
              const r = await saveMusicSettings(guildId, JSON.stringify(c));
              setMessage({ ok: r.ok, text: r.message ?? '' });
              if (r.ok) router.refresh();
            })
          }
        >
          {pending ? 'Speichere …' : 'Speichern'}
        </button>
        {message && (
          <p role="status" className={`text-sm ${message.ok ? 'text-sea-400' : 'text-danger-500'}`}>
            {message.text}
          </p>
        )}
      </div>
    </fieldset>
  );
}
