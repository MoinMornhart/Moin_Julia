'use client';

import { useState, useTransition } from 'react';
import { activateServerProfile, deactivateServerProfile } from '@/app/g/[guildId]/vorlagen/actions';

export interface BlueprintView {
  id: string;
  icon: string;
  name: string;
  description: string;
  roles: { name: string; color: number; kind: string }[];
  categories: { name: string; team: boolean; channels: { name: string; voice: boolean; access: string }[] }[];
  modules: string[];
}

const ACCESS_HINT: Record<string, string> = { readonly: '📖 nur lesen', team: '🔒 nur Team', all: '' };
const KIND_HINT: Record<string, string> = { mod: 'Team (moderieren, keine Admin-Rechte)', member: 'Mitglieder', ping: 'zum Anpingen' };

/** Profil-Auswahl: Vorschau, Anwenden mit Bestätigung, Deaktivieren mit Wahl „angelegte Kanäle/Rollen löschen“ */
export function ServerProfiles({
  guildId,
  canEdit,
  blueprints,
  active,
}: {
  guildId: string;
  canEdit: boolean;
  blueprints: BlueprintView[];
  active: { blueprintId: string; name: string; since: string; createdCount: number } | null;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [deleteCreated, setDeleteCreated] = useState(true);

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const res = await fn();
      setMessage({ ok: res.ok, text: res.message });
      setConfirm(null);
    });

  return (
    <div className="grid max-w-4xl gap-6">
      {message && (
        <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${message.ok ? 'border-sea-500/40 bg-sea-500/10' : 'border-danger-500/40 bg-danger-500/10'}`}>
          {message.text}
        </p>
      )}

      {active && (
        <section className="card grid gap-3 border-sea-500/50 p-6" aria-label="Aktives Profil">
          <p className="font-display text-lg font-semibold">✅ Aktiv: {active.name}</p>
          <p className="text-sm text-fog-300">
            Seit {active.since}. Das Profil hat {active.createdCount} Kanäle/Rollen neu angelegt.
          </p>
          <label className="flex items-start gap-2 text-sm" title="Nur, was das Profil selbst angelegt hat – vorhandene Kanäle und Rollen bleiben immer.">
            <input type="checkbox" checked={deleteCreated} onChange={(e) => setDeleteCreated(e.target.checked)} className="mt-1 size-4 accent-coral-500" disabled={!canEdit || pending} />
            <span>Angelegte Kanäle und Rollen wieder löschen (Nachrichten darin gehen verloren)</span>
          </label>
          <button type="button" className="btn-ghost w-fit" disabled={!canEdit || pending} onClick={() => run(() => deactivateServerProfile(guildId, deleteCreated))}>
            {pending ? '…' : 'Profil deaktivieren und alten Stand zurückholen'}
          </button>
        </section>
      )}

      {blueprints.map((b) => (
        <section key={b.id} className="card grid gap-4 p-6" aria-label={`Profil ${b.name}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold">
                {b.icon} {b.name}
              </h2>
              <p className="mt-1 text-sm text-fog-500">{b.description}</p>
            </div>
            {!active && canEdit && confirm !== b.id && (
              <button type="button" className="btn-primary" onClick={() => setConfirm(b.id)} disabled={pending}>
                Anwenden …
              </button>
            )}
            {active?.blueprintId === b.id && <span className="rounded-full bg-sea-500/20 px-3 py-1 text-xs font-semibold text-sea-400">aktiv</span>}
          </div>

          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="mb-1 font-semibold">Rollen</p>
              <ul className="grid gap-1">
                {b.roles.map((r) => (
                  <li key={r.name} className="flex items-center gap-2" title={KIND_HINT[r.kind]}>
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: `#${r.color.toString(16).padStart(6, '0')}` }} />
                    {r.name} <span className="text-xs text-fog-500">{KIND_HINT[r.kind]}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 mb-1 font-semibold">Bot-Einstellungen</p>
              <p className="text-fog-300">{b.modules.join(', ')}</p>
            </div>
            <div>
              <p className="mb-1 font-semibold">Kanäle</p>
              <ul className="grid gap-2">
                {b.categories.map((c) => (
                  <li key={c.name}>
                    <span className="text-xs font-bold tracking-wide text-fog-500 uppercase">
                      {c.name} {c.team && '🔒'}
                    </span>
                    <ul className="ml-3">
                      {c.channels.map((ch) => (
                        <li key={ch.name} className="text-fog-300">
                          {ch.voice ? '🔊' : '#'} {ch.name} <span className="text-xs text-fog-500">{ACCESS_HINT[ch.access]}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {confirm === b.id && (
            <div className="grid gap-3 rounded-xl border border-sun-400/40 bg-sun-400/10 p-4 text-sm">
              <p>
                <b>So geht es:</b> Erst wird der jetzige Stand gesichert. Dann legt der Bot die fehlenden Rollen und Kanäle an – gleichnamige vorhandene nutzt er
                einfach mit, er ändert und löscht dabei nichts. Zum Schluss stellt er die genannten Module passend ein.
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-primary" disabled={pending} onClick={() => run(() => activateServerProfile(guildId, b.id))}>
                  {pending ? 'Wird eingerichtet …' : `Ja, „${b.name}“ anwenden`}
                </button>
                <button type="button" className="btn-ghost" disabled={pending} onClick={() => setConfirm(null)}>
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
