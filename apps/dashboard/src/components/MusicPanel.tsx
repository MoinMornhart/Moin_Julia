'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { formatClock, LOOP_LABELS, LOOP_MODES, MUSIC_EFFECT_IDS, MUSIC_EFFECTS, type LoopMode, type MusicConfig, type MusicPreset, type MusicState, type TrackKind } from '@moin/shared';
import { musicControl, saveMusicSettings, searchRadio, setMusicYoutube, type RadioHit } from '@/app/g/[guildId]/musik/actions';

/** „Jetzt läuft“ mit Steuerknöpfen – aktualisiert sich alle 5 Sekunden */
export function NowPlaying({ guildId, state, channelName, canControl }: { guildId: string; state: MusicState | null; channelName: string | null; canControl: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  // Uhrzeit erst im Browser (sonst weicht der Server-Text ab → Hydration-Fehler)
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
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
  const raw = cur?.startedAt && now !== null ? (state?.paused ? (state.updatedAt ?? now) - cur.startedAt : now - cur.startedAt) : 0;
  const elapsed = Math.max(0, cur?.durationMs ? Math.min(raw, cur.durationMs) : raw);
  const icon = (kind: TrackKind) => (kind === 'radio' ? '📻' : kind === 'youtube' ? '▶️' : '🎧');

  return (
    <div className="card grid grid-cols-[minmax(0,1fr)] gap-4 p-5 text-sm">
      <div className="flex items-center gap-3">
        {cur?.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cur.thumbnail} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="shrink-0 text-3xl" aria-hidden>
            {cur ? icon(cur.kind) : '🎵'}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-[0.15em] text-fog-500 uppercase">{cur ? (state?.paused ? 'Pausiert' : 'Jetzt läuft') : 'Gerade still'}</p>
          <p className="truncate font-display text-xl font-semibold">{cur ? cur.title : 'Nichts in der Warteschlange'}</p>
          {cur?.author && <p className="truncate text-xs text-fog-300">👤 {cur.author}</p>}
          <p className="text-xs text-fog-500">
            {cur
              ? [
                  channelName ? `🔊 ${channelName}` : null,
                  cur.kind !== 'radio' && cur.startedAt && now !== null ? `⏱ ${formatClock(elapsed)}${cur.durationMs ? ` / ${formatClock(cur.durationMs)}` : ''}` : null,
                  `Lautstärke ${state?.volume ?? '–'} %`,
                  `Wiederholen: ${LOOP_LABELS[state?.loop ?? 'off']}`,
                  state?.effect ? `${MUSIC_EFFECTS[state.effect].emoji} ${MUSIC_EFFECTS[state.effect].de}` : null,
                  state?.autoplay ? '✨ Autoplay' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'In Discord: Sprachkanal betreten und /musik play eingeben.'}
          </p>
          {cur && cur.kind !== 'radio' && cur.durationMs ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-800" role="progressbar" aria-label="Fortschritt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, (elapsed / cur.durationMs) * 100))}>
              <i className="block h-full bg-coral-500" style={{ width: `${Math.min(100, (elapsed / cur.durationMs) * 100)}%` }} />
            </div>
          ) : null}
        </div>
      </div>
      {cur && canControl && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => run('back')} aria-label="Vorheriger Titel">
            ⏮️
          </button>
          <button type="button" className="btn-primary px-4" disabled={pending} onClick={() => run('pause')} aria-label={state?.paused ? 'Weiter' : 'Pause'}>
            {state?.paused ? '▶️ Weiter' : '⏸️ Pause'}
          </button>
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => run('skip')}>
            ⏭️ Weiter zum nächsten
          </button>
          <button type="button" className="btn-ghost" disabled={pending || (state?.queue.length ?? 0) < 2} onClick={() => run('shuffle')} aria-label="Mischen">
            🔀
          </button>
          <select aria-label="Effekt" value={state?.effect ?? 'aus'} disabled={pending} onChange={(e) => run(`effect:${e.target.value}`)} className="input w-auto py-2">
            <option value="aus">✨ Kein Effekt</option>
            {MUSIC_EFFECT_IDS.map((id) => (
              <option key={id} value={id}>
                {MUSIC_EFFECTS[id].emoji} {MUSIC_EFFECTS[id].de}
              </option>
            ))}
          </select>
          <button type="button" className={`btn-ghost ${state?.autoplay ? 'text-coral-400' : ''}`} disabled={pending} aria-pressed={!!state?.autoplay} onClick={() => run(state?.autoplay ? 'autoplay:off' : 'autoplay:on')}>
            ✨ Autoplay
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
              <li key={`${q.url}-${i}`} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {i + 1}. {icon(q.kind)} {q.title}
                  {q.durationMs ? <span className="text-xs text-fog-500"> · {formatClock(q.durationMs)}</span> : null}
                </span>
                {canControl && (
                  <button type="button" className="px-2 text-xs text-fog-500 hover:text-danger-500" disabled={pending} onClick={() => run(`remove:${i + 1}`)} aria-label={`${q.title} entfernen`}>
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** Einstellungen + Favoriten mit Sendersuche */
export function MusicSettings({ guildId, canEdit, isInstanceAdmin, config, roles }: { guildId: string; canEdit: boolean; isInstanceAdmin: boolean; config: MusicConfig; roles: { id: string; name: string }[] }) {
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
        {(
          [
            ['autoplay', '✨ Autoplay', 'Ist die Warteschlange leer, geht es mit passenden Titeln weiter (nur mit YouTube). In Discord umschaltbar mit /musik autoplay.'],
            ['stay247', '🕒 24/7-Modus', 'Moin_Julia bleibt im Sprachkanal, auch wenn nichts läuft oder niemand zuhört.'],
            ['voteSkip', '🗳️ Abstimmen zum Überspringen', 'Wer kein DJ ist, kann nur per Abstimmung überspringen (2/3 der Zuhörer). Den eigenen Wunsch darf man immer überspringen.'],
          ] as const
        ).map(([key, label, hint]) => (
          <label key={key} className="flex items-start gap-2">
            <input type="checkbox" checked={c[key]} onChange={(e) => set({ [key]: e.target.checked })} className="mt-1 size-4 accent-coral-500" />
            <span>
              <b>{label}</b>
              <span className="block text-xs text-fog-500">{hint}</span>
            </span>
          </label>
        ))}
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={c.allowPrivateUrls} disabled={!isInstanceAdmin} onChange={(e) => set({ allowPrivateUrls: e.target.checked })} className="mt-1 size-4 accent-coral-500 disabled:opacity-50" />
          <span>
            <b>Links ins eigene Netz erlauben</b> (z. B. Musik vom NAS: <code>http://192.168.1.20/…</code>)
            <span className="block text-xs text-sun-400">Achtung: Dann kann jede Person mit Musik-Rechten den Bot Adressen in deinem Heimnetz abrufen lassen. Nur einschalten, wenn du den Leuten vertraust.</span>
            {!isInstanceAdmin && <span className="block text-xs text-fog-500">Ändern kann das nur der Instanz-Admin (die Person, die Moin_Julia eingerichtet hat).</span>}
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

/**
 * YouTube & Co. für die ganze Instanz – nur der Instanz-Admin schaltet, auf eigenes Risiko
 * (Nutzungsbedingungen von YouTube/Spotify verbieten das Abspielen über Bots).
 */
export function YoutubeSwitch({ guildId, enabled, isInstanceAdmin }: { guildId: string; enabled: boolean; isInstanceAdmin: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const toggle = (on: boolean) =>
    start(async () => {
      const r = await setMusicYoutube(guildId, on);
      setMessage({ ok: r.ok, text: r.message ?? '' });
      setConfirm(false);
      if (r.ok) router.refresh();
    });

  return (
    <section className="card grid max-w-4xl gap-3 p-6 text-sm" aria-labelledby="yt-title">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="yt-title" className="font-display text-lg font-semibold">
          ▶️ YouTube, SoundCloud, Spotify &amp; Apple Music
        </h2>
        <span className={`chip ${enabled ? 'bg-sea-500/15 text-sea-400' : 'bg-ink-800 text-fog-300'}`}>{enabled ? 'an' : 'aus'}</span>
      </div>
      <p className="text-fog-300">
        Wie bei Euphony: Songs per Name suchen, YouTube-/SoundCloud-Links und Playlists, Spotify-/Apple-Links (werden auf YouTube gesucht), Autoplay. Es gilt für alle Server dieser Instanz.
      </p>
      <p className="rounded-lg border border-sun-400/40 bg-sun-400/10 px-3 py-2 text-xs text-sun-400">
        ⚠️ Eigenes Risiko: YouTube und Spotify verbieten das Abspielen über Bots in ihren Nutzungsbedingungen – deshalb wurden Rythm und Groovy abgeschaltet. Möglich sind z. B. eine Sperre des Bot-Accounts oder
        Ärger wegen Urheberrecht. Ohne diesen Schalter spielt Moin_Julia Internet-Radio und direkte Audio-Links.
      </p>
      {!isInstanceAdmin ? (
        <p className="text-xs text-fog-500">Ein- und ausschalten kann das nur der Instanz-Admin (die Person, die Moin_Julia eingerichtet hat).</p>
      ) : enabled ? (
        <div>
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => toggle(false)}>
            YouTube &amp; Co. ausschalten
          </button>
        </div>
      ) : confirm ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" disabled={pending} onClick={() => toggle(true)}>
            Ja, auf eigenes Risiko einschalten
          </button>
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => setConfirm(false)}>
            Abbrechen
          </button>
        </div>
      ) : (
        <div>
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => setConfirm(true)}>
            YouTube &amp; Co. einschalten …
          </button>
        </div>
      )}
      {message && (
        <p role="status" className={`text-sm ${message.ok ? 'text-sea-400' : 'text-danger-500'}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
