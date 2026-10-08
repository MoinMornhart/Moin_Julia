'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { APPLICATION_TAGS, TAG_LABELS, type ApplicationStatus } from '@moin/shared';
import {
  acceptApplication,
  addApplicationNote,
  claimApplication,
  deleteApplication,
  inviteToInterview,
  passOnApplication,
  rejectApplication,
  setApplicationTag,
} from '@/app/g/[guildId]/team/actions';

type Result = { ok: boolean; message?: string };

/** Seitenleiste einer Bewerbung (wie im GalaxyBot-Team-Dashboard) */
export function ApplicationActions({
  guildId,
  appId,
  status,
  canReview,
  canDelete,
  isMine,
  handlerTag,
  tag,
  interview,
  probationDays,
  members,
  voiceChannels,
}: {
  guildId: string;
  appId: string;
  status: ApplicationStatus;
  canReview: boolean;
  canDelete: boolean;
  isMine: boolean;
  handlerTag: string | null;
  tag: string | null;
  interview: { at?: string; place?: string; status?: string } | null;
  probationDays: number;
  members: { id: string; tag: string }[];
  voiceChannels: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<Result | null>(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [passTo, setPassTo] = useState('');
  const [when, setWhen] = useState('');
  const [place, setPlace] = useState('');
  const [probation, setProbation] = useState(probationDays > 0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMessage(r);
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  const pendingApp = status === 'pending';

  if (!canReview) {
    return <aside className="card p-5 text-sm text-fog-300">Du kannst diese Bewerbung ansehen, aber nicht bearbeiten. Prüfer-Rollen legt ein Admin unter Teams → Einstellungen fest.</aside>;
  }

  return (
    <aside className="grid gap-4 lg:sticky lg:top-6">
      <section className="card grid gap-3 p-5 text-sm">
        <p className="font-semibold">Bearbeitet von</p>
        <p className="text-fog-300">{handlerTag ?? 'noch niemandem'}</p>
        <button type="button" className="btn-ghost w-full" disabled={pending} onClick={() => run(() => claimApplication(guildId, appId))}>
          {isMine ? 'Wieder freigeben' : '🙋 Übernehmen'}
        </button>
        {members.length > 0 && (
          <div className="flex gap-2">
            <select value={passTo} onChange={(e) => setPassTo(e.target.value)} className="input py-1.5" aria-label="Weitergeben an">
              <option value="">Weitergeben an …</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.tag}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-ghost px-3"
              disabled={pending || !passTo}
              onClick={() => run(() => passOnApplication(guildId, appId, passTo, members.find((m) => m.id === passTo)?.tag ?? ''), () => setPassTo(''))}
            >
              ➡️
            </button>
          </div>
        )}
      </section>

      <section className="card grid gap-2 p-5 text-sm">
        <label htmlFor="app-tag" className="font-semibold">
          Tag
        </label>
        <select id="app-tag" value={tag ?? ''} className="input" disabled={pending} onChange={(e) => run(() => setApplicationTag(guildId, appId, e.target.value || null))}>
          <option value="">— kein Tag —</option>
          {APPLICATION_TAGS.map((t) => (
            <option key={t} value={t}>
              {TAG_LABELS[t]}
            </option>
          ))}
        </select>
      </section>

      <section className="card grid gap-2 p-5 text-sm">
        <label htmlFor="app-note" className="font-semibold">
          Notiz fürs Team
        </label>
        <textarea id="app-note" value={note} rows={3} maxLength={1000} className="input" onChange={(e) => setNote(e.target.value)} />
        <button type="button" className="btn-ghost w-fit" disabled={pending || !note.trim()} onClick={() => run(() => addApplicationNote(guildId, appId, note), () => setNote(''))}>
          Notiz speichern
        </button>
      </section>

      {pendingApp && (
        <section className="card grid gap-2 p-5 text-sm">
          <p className="font-semibold">Gespräch</p>
          {interview?.at && (
            <p className="text-fog-300">
              {new Date(interview.at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' })} · {interview.place} ·{' '}
              <b>{interview.status === 'accepted' ? 'zugesagt ✅' : interview.status === 'declined' ? 'abgesagt ❌' : 'eingeladen'}</b>
            </p>
          )}
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="input" aria-label="Zeitpunkt" />
          <input list="voice-channels" value={place} maxLength={200} placeholder="Ort (z. B. 🔊 Support-Warteraum)" className="input" onChange={(e) => setPlace(e.target.value)} aria-label="Ort" />
          <datalist id="voice-channels">
            {voiceChannels.map((v) => (
              <option key={v} value={`🔊 ${v}`} />
            ))}
          </datalist>
          <button type="button" className="btn-ghost w-fit" disabled={pending || !when || !place.trim()} onClick={() => run(() => inviteToInterview(guildId, appId, new Date(when).toISOString(), place))}>
            🗓️ Einladen (DM)
          </button>
        </section>
      )}

      {pendingApp && (
        <section className="card grid gap-3 border-coral-500/30 p-5 text-sm">
          <p className="font-semibold">Entscheidung</p>
          {probationDays > 0 && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={probation} onChange={(e) => setProbation(e.target.checked)} className="accent-coral-500" />
              mit {probationDays} Tagen Probezeit
            </label>
          )}
          <button type="button" className="btn-primary w-full" disabled={pending} onClick={() => run(() => acceptApplication(guildId, appId, probation))}>
            ✅ Annehmen
          </button>
          <textarea value={reason} rows={3} maxLength={1000} placeholder="Begründung für die Absage (Pflicht – die Person bekommt sie per DM)" className="input" onChange={(e) => setReason(e.target.value)} aria-label="Begründung" />
          <button type="button" className="btn-ghost w-full border-danger-500/50 text-danger-500" disabled={pending || !reason.trim()} onClick={() => run(() => rejectApplication(guildId, appId, reason))}>
            ❌ Ablehnen
          </button>
        </section>
      )}

      {canDelete && (
        <section className="grid gap-2 px-1 text-sm">
          {confirmDelete ? (
            <div className="flex items-center gap-3">
              <span className="text-fog-300">Wirklich löschen?</span>
              <button type="button" className="font-semibold text-danger-500" disabled={pending} onClick={() => run(() => deleteApplication(guildId, appId), () => router.replace(`/g/${guildId}/team`))}>
                Ja, löschen
              </button>
              <button type="button" className="text-fog-500" onClick={() => setConfirmDelete(false)}>
                Abbrechen
              </button>
            </div>
          ) : (
            <button type="button" className="w-fit text-fog-500 hover:text-danger-500" onClick={() => setConfirmDelete(true)}>
              Bewerbung löschen
            </button>
          )}
        </section>
      )}

      {message?.message && (
        <p className={`px-1 text-sm ${message.ok ? 'text-sea-400' : 'text-danger-500'}`} role="status">
          {message.ok ? '✓ ' : '✗ '}
          {message.message}
        </p>
      )}
    </aside>
  );
}
