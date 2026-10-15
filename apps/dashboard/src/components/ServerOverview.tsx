'use client';

import { useState, useTransition } from 'react';
import { inviteMe, readChannel, requestAccess, serverDetails, type AccessState, type ChannelMessage, type ServerDetails } from '@/app/system/server/actions';

const hex = (c: number) => (c ? `#${c.toString(16).padStart(6, '0')}` : '#8c96ba');

/** Liste aller Server; Details, Einladung und (mit Support-Zugang) Mitlesen pro Server */
type Row = { id: string; name: string; icon: string | null; access: AccessState };

export function ServerOverview({ guilds }: { guilds: Row[] }) {
  return (
    <ul className="grid gap-3" aria-label="Server-Liste">
      {guilds.map((g) => (
        <ServerRow key={g.id} guild={g} />
      ))}
    </ul>
  );
}

function ServerRow({ guild }: { guild: Row }) {
  const granted = !!guild.access.granted;
  const [details, setDetails] = useState<ServerDetails | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [channel, setChannel] = useState('');
  const [messages, setMessages] = useState<ChannelMessage[] | null>(null);
  const [pending, start] = useTransition();

  const load = () =>
    start(async () => {
      if (details) return setDetails(null);
      const r = await serverDetails(guild.id);
      if (r.ok && r.data) setDetails(r.data);
      else setMsg({ ok: false, text: r.message ?? 'Fehler' });
    });

  return (
    <li className={`card grid gap-3 p-4 ${granted ? '' : 'border-dashed'}`} aria-label={`Server ${guild.name}`}>
      <div className="flex flex-wrap items-center gap-3">
        {guild.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={guild.icon} alt="" className="size-10 rounded-xl" />
        ) : (
          <span className="grid size-10 place-items-center rounded-xl bg-ink-700 text-sm font-bold">{guild.name.slice(0, 2).toUpperCase()}</span>
        )}
        <span className={`min-w-0 flex-1 truncate font-semibold ${granted ? '' : 'text-fog-500'}`}>
          {guild.name}
          <span className="ml-2 text-xs font-normal">
            {granted ? <span className="text-sea-400">🔑 {guild.access.granted!.scopes} · {guild.access.granted!.until}</span> : guild.access.blocked ? <span className="text-danger-500">🚫 gesperrt</span> : <span>🔒 keine Freigabe</span>}
          </span>
        </span>
        <button type="button" className="btn-ghost px-3 py-1.5 text-sm" disabled={pending || !granted} onClick={load} aria-expanded={!!details} title={granted ? undefined : 'Erst Zugang anfragen'}>
          {details ? 'Zuklappen' : 'Details'}
        </button>
        <button
          type="button"
          className="btn-primary px-3 py-1.5 text-sm"
          disabled={pending || !granted}
          title={granted ? undefined : 'Erst Zugang anfragen'}
          onClick={() =>
            start(async () => {
              const r = await inviteMe(guild.id);
              setMsg({ ok: r.ok, text: r.message });
            })
          }
        >
          🎟️ Einladung per DM
        </button>
      </div>
      {!granted && !guild.access.blocked && <AccessRequest guildId={guild.id} requestedAt={guild.access.requestedAt} />}
      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? 'text-sea-400' : 'text-danger-500'}`}>
          {msg.text}
        </p>
      )}

      {details && (
        <div className="grid gap-3 text-sm">
          <p className="text-fog-300">
            Owner: <b>{details.owner}</b> · Mitglieder: <b>{details.members ?? '?'}</b> · Rollen: <b>{details.roles.length}</b>
            {details.missing.length > 0 && <span className="text-sun-400"> · Bot fehlt: {details.missing.join(', ')}</span>}
          </p>
          <p className={details.support ? 'text-sea-400' : 'text-fog-500'}>
            {details.support ? `🔑 Freigabe: ${details.support.until}, erlaubt von ${details.support.by}` : '🔒 Keine Freigabe.'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 font-semibold">Kanäle</p>
              <ul className="grid gap-1.5">
                {details.categories.map((c) => (
                  <li key={c.name}>
                    <span className="text-xs font-bold tracking-wide text-fog-500 uppercase">{c.name}</span>
                    <ul className="ml-3">
                      {c.channels.map((ch) => (
                        <li key={ch.id} className="text-fog-300" data-no-dummies>
                          {ch.voice ? '🔊' : '#'} {ch.name}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 font-semibold">Rollen</p>
              <ul className="flex flex-wrap gap-1.5">
                {details.roles.map((r) => (
                  <li key={r.name} className="inline-flex items-center gap-1.5 rounded-full border border-ink-600 px-2 py-0.5 text-xs">
                    <span className="size-2 rounded-full" style={{ backgroundColor: hex(r.color) }} />
                    {r.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {details.support && (
            <div className="grid gap-2 rounded-xl border border-ink-700 p-3" aria-label="Mitlesen">
              <p className="font-semibold">👀 Mitlesen (Support-Zugang)</p>
              <div className="flex flex-wrap gap-2">
                <select aria-label="Textkanal" className="input w-auto" value={channel} onChange={(e) => setChannel(e.target.value)}>
                  <option value="">Kanal wählen …</option>
                  {details.categories.flatMap((c) => c.channels.filter((ch) => !ch.voice).map((ch) => <option key={ch.id} value={ch.id}>#{ch.name}</option>))}
                </select>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={!channel || pending}
                  onClick={() =>
                    start(async () => {
                      const r = await readChannel(guild.id, channel);
                      if (r.ok) setMessages(r.messages ?? []);
                      else setMsg({ ok: false, text: r.message ?? 'Fehler' });
                    })
                  }
                >
                  Letzte 50 Nachrichten
                </button>
              </div>
              {messages && (
                <ul className="grid max-h-96 gap-1 overflow-y-auto text-xs" data-no-dummies>
                  {messages.length === 0 && <li className="text-fog-500">Keine Nachrichten.</li>}
                  {messages.map((m, i) => (
                    <li key={i}>
                      <span className="text-fog-500">{m.at}</span> <b>{m.author}:</b> {m.content}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** „Zugang anfragen“ mit Begründung und Umfang (Issue #13) */
function AccessRequest({ guildId, requestedAt }: { guildId: string; requestedAt: string | null }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [read, setRead] = useState(true);
  const [dash, setDash] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setOpen(true)}>
          🙋 Zugang anfragen …
        </button>
        {requestedAt && !msg && <span className="text-fog-500">Angefragt am {requestedAt} – wartet auf Antwort.</span>}
        {msg && (
          <span role="status" className={msg.ok ? 'text-sea-400' : 'text-danger-500'}>
            {msg.text}
          </span>
        )}
      </div>
    );
  return (
    <form
      className="grid gap-3 rounded-xl border border-ink-700 p-3 text-sm"
      aria-label="Zugang anfragen"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await requestAccess(guildId, reason, [...(read ? ['lesen'] : []), ...(dash ? ['dashboard'] : [])]);
          setMsg({ ok: r.ok, text: r.message });
          if (r.ok) setOpen(false);
        });
      }}
    >
      <label className="grid gap-1">
        <span className="font-semibold">Warum brauchst du Zugang?</span>
        <textarea className="input min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required minLength={10} placeholder="z. B. Ticket-Panel zeigt einen Fehler, ich möchte mir die Einstellungen ansehen" />
      </label>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-1 font-semibold">Wofür?</legend>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} /> 👀 Kanäle mitlesen
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={dash} onChange={(e) => setDash(e.target.checked)} /> ⚙️ Dashboard verwalten (wie ein Admin)
        </label>
      </fieldset>
      <p className="text-xs text-fog-500">Owner oder Admin bekommen die Begründung mit Knöpfen (im Log-Kanal, sonst per DM) und entscheiden über Dauer – auch für immer. Du bekommst eine DM mit der Antwort.</p>
      <div className="flex gap-3">
        <button type="submit" className="btn-primary px-3 py-1.5" disabled={pending || reason.trim().length < 10 || (!read && !dash)}>
          Anfrage schicken
        </button>
        <button type="button" className="text-fog-500" onClick={() => setOpen(false)}>
          Abbrechen
        </button>
      </div>
      {msg && <p className={msg.ok ? 'text-sea-400' : 'text-danger-500'}>{msg.text}</p>}
    </form>
  );
}
