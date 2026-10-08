'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { newReasonId, type TicketPanelData, type TicketReason } from '@moin/shared';
import { deleteTicketPanel, saveTicketPanel, sendTicketPanel } from '@/app/g/[guildId]/tickets/actions';
import type { ChannelOption } from '@/lib/discord';
import { ChannelSelect } from './ChannelSelect';
import { DiscordPreview, EmbedEditor } from './EmbedEditor';
import { KeepForm } from './KeepForm';

/** Ticket-Panel: Name, Kanal, Darstellung, Nachricht und Gründe (jeweils mit bis zu 5 Formular-Fragen) */
export function TicketPanelEditor({
  guildId,
  panelId,
  sent,
  canEdit,
  initial,
  channels,
  roles,
}: {
  guildId: string;
  panelId: string | null;
  sent: boolean;
  canEdit: boolean;
  initial: TicketPanelData & { channelId: string | null };
  channels: ChannelOption[];
  roles: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [reasons, setReasons] = useState<TicketReason[]>(initial.reasons);
  const [style, setStyle] = useState(initial.style);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const categories = channels.filter((c) => c.type === 4);
  const update = (id: string, patch: Partial<TicketReason>) => setReasons(reasons.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const submit = (form: FormData) =>
    start(async () => {
      form.set('reasons', JSON.stringify(reasons));
      const r = await saveTicketPanel(guildId, panelId, form);
      setMessage({ ok: r.ok, text: r.message ?? '' });
      if (r.ok && !panelId && r.id) router.replace(`/g/${guildId}/tickets/panels?panel=${r.id}`);
      else router.refresh();
    });

  return (
    <KeepForm action={submit} className="grid gap-6">
      <fieldset disabled={!canEdit || pending} className="grid gap-6">
        <div className="card grid gap-4 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Name (nur im Dashboard)</span>
              <input name="name" defaultValue={initial.name} maxLength={60} required className="input" />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Kanal</span>
              <ChannelSelect id="channelId" name="channelId" channels={channels} defaultValue={initial.channelId} emptyLabel="— Kanal wählen —" />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Darstellung</span>
              <select name="style" value={style} onChange={(e) => setStyle(e.target.value as typeof style)} className="input">
                <option value="buttons">Knöpfe</option>
                <option value="select">Auswahlmenü</option>
              </select>
            </label>
          </div>
        </div>

        <div className="card grid gap-3 p-6">
          <p className="font-display text-lg font-semibold">Gründe ({reasons.length}/10)</p>
          <p className="text-sm text-fog-500">Jeder Grund ist ein Knopf bzw. Menü-Eintrag. Optional mit Fragen, die beim Öffnen beantwortet werden (max. 5).</p>
          {reasons.map((r) => (
            <div key={r.id} className="grid gap-3 rounded-xl border border-ink-700 bg-ink-850 p-4" data-reason={r.id}>
              <div className="grid gap-2 sm:grid-cols-[1fr_5rem_1.4fr_auto] sm:items-center">
                <input value={r.label} maxLength={80} placeholder="Beschriftung" aria-label="Beschriftung" className="input" onChange={(e) => update(r.id, { label: e.target.value })} />
                <input value={r.emoji} maxLength={40} placeholder="🎫" aria-label="Emoji" className="input text-center" onChange={(e) => update(r.id, { emoji: e.target.value })} />
                <input
                  value={r.description}
                  maxLength={100}
                  placeholder={style === 'select' ? 'Beschreibung (im Menü)' : 'Beschreibung (nur Menü)'}
                  aria-label="Beschreibung"
                  className="input"
                  disabled={style !== 'select'}
                  onChange={(e) => update(r.id, { description: e.target.value })}
                />
                <button type="button" className="text-sm text-fog-500 hover:text-danger-500" onClick={() => setReasons(reasons.filter((x) => x.id !== r.id))} aria-label="Grund entfernen">
                  ✕
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-xs text-fog-300">
                  Kategorie für diese Tickets
                  <select value={r.categoryId ?? ''} className="input" onChange={(e) => update(r.id, { categoryId: e.target.value || null })}>
                    <option value="">— Standard aus den Einstellungen —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        📁 {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs text-fog-300">
                  Zusätzliches Team für diesen Grund
                  <select
                    value={r.teamRoleIds[0] ?? ''}
                    className="input"
                    onChange={(e) => update(r.id, { teamRoleIds: e.target.value ? [e.target.value] : [] })}
                  >
                    <option value="">— nur das Standard-Team —</option>
                    {roles.map((x) => (
                      <option key={x.id} value={x.id}>
                        @ {x.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-2">
                {r.questions.map((q, qi) => (
                  <div key={qi} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto_auto] sm:items-center">
                    <input
                      value={q.label}
                      maxLength={45}
                      placeholder={`Frage ${qi + 1}`}
                      aria-label={`Frage ${qi + 1}`}
                      className="input"
                      onChange={(e) => update(r.id, { questions: r.questions.map((x, j) => (j === qi ? { ...x, label: e.target.value } : x)) })}
                    />
                    <input
                      value={q.placeholder}
                      maxLength={100}
                      placeholder="Beispiel-Antwort (optional)"
                      className="input"
                      onChange={(e) => update(r.id, { questions: r.questions.map((x, j) => (j === qi ? { ...x, placeholder: e.target.value } : x)) })}
                    />
                    <label className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={q.required} onChange={(e) => update(r.id, { questions: r.questions.map((x, j) => (j === qi ? { ...x, required: e.target.checked } : x)) })} className="accent-coral-500" />
                      Pflicht
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={q.long} onChange={(e) => update(r.id, { questions: r.questions.map((x, j) => (j === qi ? { ...x, long: e.target.checked } : x)) })} className="accent-coral-500" />
                      lang
                    </label>
                    <button type="button" className="text-xs text-fog-500 hover:text-danger-500" onClick={() => update(r.id, { questions: r.questions.filter((_, j) => j !== qi) })}>
                      ✕
                    </button>
                  </div>
                ))}
                {r.questions.length < 5 && (
                  <button
                    type="button"
                    className="w-fit text-sm font-semibold text-coral-400 hover:text-coral-500"
                    onClick={() => update(r.id, { questions: [...r.questions, { label: '', placeholder: '', required: true, long: false }] })}
                  >
                    + Frage
                  </button>
                )}
              </div>
            </div>
          ))}
          {reasons.length < 10 && (
            <button
              type="button"
              className="btn-ghost w-fit"
              onClick={() =>
                setReasons([...reasons, { id: newReasonId(reasons.map((r) => r.id)), label: 'Neuer Grund', emoji: '', description: '', questions: [], categoryId: null, teamRoleIds: [] }])
              }
            >
              + Grund
            </button>
          )}
        </div>

        <div className="card grid gap-3 p-6">
          <p className="font-display text-lg font-semibold">Nachricht</p>
          <EmbedEditor guildId={guildId} name="template" initial={initial.template} />
          <DiscordPreview content="" embed={null}>
            <div className="mt-2 flex flex-wrap gap-2">
              {style === 'buttons' ? (
                reasons.map((r) => (
                  <span key={r.id} className="rounded bg-[#5865f2] px-4 py-1.5 text-sm font-medium text-white">
                    {r.emoji} {r.label}
                  </span>
                ))
              ) : (
                <span className="w-full max-w-sm rounded border border-[#1e1f22] bg-[#1e1f22] px-3 py-2 text-sm text-[#949ba4]">Worum geht es? ▾</span>
              )}
            </div>
          </DiscordPreview>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={!canEdit || pending}>
          {pending ? 'Speichere …' : 'Speichern'}
        </button>
        {panelId && (
          <>
            <button
              type="button"
              className="btn-ghost"
              disabled={!canEdit || pending}
              onClick={() =>
                start(async () => {
                  const r = await sendTicketPanel(guildId, panelId);
                  setMessage({ ok: r.ok, text: r.message ?? '' });
                })
              }
            >
              {sent ? 'In Discord aktualisieren' : 'In Discord senden'}
            </button>
            <button
              type="button"
              className="ml-auto text-sm text-fog-500 hover:text-danger-500"
              disabled={!canEdit || pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteTicketPanel(guildId, panelId);
                  if (r.ok) router.replace(`/g/${guildId}/tickets/panels`);
                  else setMessage({ ok: false, text: r.message ?? '' });
                })
              }
            >
              Panel löschen
            </button>
          </>
        )}
        {message && <p className={`text-sm ${message.ok ? 'text-sea-400' : 'text-danger-500'}`}>{message.text}</p>}
      </div>
    </KeepForm>
  );
}
