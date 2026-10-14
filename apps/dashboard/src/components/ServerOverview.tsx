'use client';

import { useState, useTransition } from 'react';
import { inviteMe, readChannel, serverDetails, type ChannelMessage, type ServerDetails } from '@/app/system/server/actions';

const hex = (c: number) => (c ? `#${c.toString(16).padStart(6, '0')}` : '#8c96ba');

/** Liste aller Server; Details, Einladung und (mit Support-Zugang) Mitlesen pro Server */
export function ServerOverview({ guilds }: { guilds: { id: string; name: string; icon: string | null }[] }) {
  return (
    <ul className="grid gap-3" aria-label="Server-Liste">
      {guilds.map((g) => (
        <ServerRow key={g.id} guild={g} />
      ))}
    </ul>
  );
}

function ServerRow({ guild }: { guild: { id: string; name: string; icon: string | null } }) {
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
    <li className="card grid gap-3 p-4" aria-label={`Server ${guild.name}`}>
      <div className="flex flex-wrap items-center gap-3">
        {guild.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={guild.icon} alt="" className="size-10 rounded-xl" />
        ) : (
          <span className="grid size-10 place-items-center rounded-xl bg-ink-700 text-sm font-bold">{guild.name.slice(0, 2).toUpperCase()}</span>
        )}
        <span className="min-w-0 flex-1 truncate font-semibold">{guild.name}</span>
        <button type="button" className="btn-ghost px-3 py-1.5 text-sm" disabled={pending} onClick={load} aria-expanded={!!details}>
          {details ? 'Zuklappen' : 'Details'}
        </button>
        <button
          type="button"
          className="btn-primary px-3 py-1.5 text-sm"
          disabled={pending}
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
            {details.support ? `🛟 Support-Zugang: an (${details.support.until}, erlaubt von ${details.support.by})` : '🔒 Kein Support-Zugang – Mitlesen nicht möglich.'}
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
