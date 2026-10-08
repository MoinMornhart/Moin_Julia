'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { RolePanelData } from '@moin/shared';
import { deletePanel, savePanel, sendPanel } from '@/app/g/[guildId]/willkommen/actions';
import type { ChannelOption } from '@/lib/discord';
import { ChannelSelect } from './ChannelSelect';
import { DiscordPreview, EmbedEditor } from './EmbedEditor';

type Row = RolePanelData['roles'][number] & { uid: number };

export function RolePanelEditor({
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
  initial: RolePanelData & { channelId: string | null };
  channels: ChannelOption[];
  roles: { id: string; name: string; color: number }[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => initial.roles.map((r, uid) => ({ ...r, uid })));
  const [nextUid, setNextUid] = useState(initial.roles.length);
  const [style, setStyle] = useState(initial.style);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const update = (uid: number, patch: Partial<Row>) => setRows(rows.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));

  const submit = (form: FormData) =>
    start(async () => {
      const r = await savePanel(guildId, panelId, form);
      setMessage({ ok: r.ok, text: r.message ?? '' });
      if (r.ok && !panelId && r.id) router.replace(`/g/${guildId}/willkommen/panels?panel=${r.id}`);
      else router.refresh();
    });

  return (
    <form action={submit} className="grid gap-6">
      <fieldset disabled={!canEdit || pending} className="grid gap-6">
        <div className="card grid gap-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
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
                <option value="buttons">Buttons</option>
                <option value="select">Auswahlmenü</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Auswahl</span>
              <select name="mode" defaultValue={initial.mode} className="input">
                <option value="multi">Mehrere Rollen möglich</option>
                <option value="single">Nur eine Rolle aus diesem Panel</option>
              </select>
            </label>
          </div>
        </div>

        <div className="card grid gap-3 p-6">
          <p className="font-display text-lg font-semibold">Rollen ({rows.length}/25)</p>
          {rows.map((r, i) => (
            <div key={r.uid} className="grid gap-2 rounded-xl border border-ink-700 bg-ink-850 p-3 sm:grid-cols-[1.2fr_1fr_5rem_1.2fr_auto] sm:items-center">
              <select name={`role.${i}.id`} value={r.roleId} onChange={(e) => update(r.uid, { roleId: e.target.value })} className="input" aria-label="Rolle">
                {!roles.some((x) => x.id === r.roleId) && <option value={r.roleId}>Unbekannte Rolle</option>}
                {roles.map((x) => (
                  <option key={x.id} value={x.id}>
                    @ {x.name}
                  </option>
                ))}
              </select>
              <input name={`role.${i}.label`} value={r.label} maxLength={80} onChange={(e) => update(r.uid, { label: e.target.value })} placeholder="Beschriftung" className="input" />
              <input name={`role.${i}.emoji`} value={r.emoji} maxLength={40} onChange={(e) => update(r.uid, { emoji: e.target.value })} placeholder="🎮" className="input text-center" aria-label="Emoji" />
              <input
                name={`role.${i}.description`}
                value={r.description}
                maxLength={100}
                onChange={(e) => update(r.uid, { description: e.target.value })}
                placeholder={style === 'select' ? 'Beschreibung (im Menü)' : 'Beschreibung (nur Menü)'}
                className="input"
                disabled={style !== 'select'}
              />
              <button type="button" className="text-sm text-fog-500 hover:text-danger-500" onClick={() => setRows(rows.filter((x) => x.uid !== r.uid))} aria-label="Rolle entfernen">
                ✕
              </button>
            </div>
          ))}
          {rows.length < 25 && roles.length > 0 && (
            <button
              type="button"
              className="btn-ghost w-fit"
              onClick={() => {
                const unused = roles.find((x) => !rows.some((r) => r.roleId === x.id)) ?? roles[0]!;
                setRows([...rows, { roleId: unused.id, label: unused.name, emoji: '', description: '', uid: nextUid }]);
                setNextUid(nextUid + 1);
              }}
            >
              + Rolle
            </button>
          )}
          <p className="text-xs text-fog-500">Die Bot-Rolle muss über diesen Rollen stehen. Mitglieder können nur Rollen aus diesem Panel bekommen.</p>
        </div>

        <div className="card grid gap-3 p-6">
          <p className="font-display text-lg font-semibold">Nachricht</p>
          <EmbedEditor guildId={guildId} name="template" initial={initial.template} />
          <DiscordPreview content="" embed={null}>
            <div className="mt-2 flex flex-wrap gap-2">
              {style === 'buttons' ? (
                rows.map((r) => (
                  <span key={r.uid} className="rounded bg-[#4e5058] px-4 py-1.5 text-sm font-medium text-white">
                    {r.emoji} {r.label}
                  </span>
                ))
              ) : (
                <span className="w-full max-w-sm rounded border border-[#1e1f22] bg-[#1e1f22] px-3 py-2 text-sm text-[#949ba4]">Rollen auswählen … ▾</span>
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
              onClick={() => start(async () => {
                const r = await sendPanel(guildId, panelId);
                setMessage({ ok: r.ok, text: r.message ?? '' });
              })}
            >
              {sent ? 'In Discord aktualisieren' : 'In Discord senden'}
            </button>
            <button
              type="button"
              className="ml-auto text-sm text-fog-500 hover:text-danger-500"
              disabled={!canEdit || pending}
              onClick={() => start(async () => {
                const r = await deletePanel(guildId, panelId);
                if (r.ok) router.replace(`/g/${guildId}/willkommen/panels`);
                else setMessage({ ok: false, text: r.message ?? '' });
              })}
            >
              Panel löschen
            </button>
          </>
        )}
        {message && <p className={`w-full text-sm ${message.ok ? 'text-sea-400' : 'text-danger-500'}`}>{message.text}</p>}
      </div>
    </form>
  );
}
