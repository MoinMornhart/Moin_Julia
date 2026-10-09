'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { SuggestionBoard } from '@moin/shared';
import { saveSuggestionBoards, sendSuggestionPanel } from '@/app/g/[guildId]/community/actions';
import type { ChannelOption } from '@/lib/discord';

type Msg = { ok: boolean; text: string } | null;

function ChannelPick({ label, value, channels, empty, onChange }: { label: string; value: string; channels: ChannelOption[]; empty: string; onChange: (v: string) => void }) {
  const text = channels.filter((c) => c.type === 0 || c.type === 5);
  return (
    <label className="grid min-w-0 gap-1 text-sm">
      <span className="text-fog-300">{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="input">
        <option value="">{empty}</option>
        {text.map((c) => (
          <option key={c.id} value={c.id}>
            #{c.name}
            {c.group ? ` (${c.group})` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

/** „Vorschlag einreichen“-Knopf in den Kanal eines Bereichs schicken */
function PanelButton({ guildId, boardId, disabled }: { guildId: string; boardId: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn-ghost px-3 py-1.5 text-xs"
        disabled={pending || disabled}
        onClick={() =>
          start(async () => {
            const r = await sendSuggestionPanel(guildId, boardId);
            setMsg({ ok: r.ok, text: r.message ?? '' });
          })
        }
      >
        💡 Knopf „Vorschlag einreichen“ posten
      </button>
      {msg && <span className={`text-xs ${msg.ok ? 'text-sea-400' : 'text-danger-500'}`}>{msg.text}</span>}
    </span>
  );
}

/**
 * Mehrere Vorschlags-Bereiche wie bei GalaxyBot: jeder mit eigenem Kanal, optionalem Team-Kanal (dort
 * entscheidet das Team per Knopf), Ergebnis-Kanal, Team-Rollen – und dem Knopf zum Einreichen im Kanal.
 */
export function SuggestionBoards({
  guildId,
  canEdit,
  enabled,
  main,
  initial,
  channels,
  roles,
}: {
  guildId: string;
  canEdit: boolean;
  enabled: boolean;
  main: { name: string; channelId: string } | null;
  initial: SuggestionBoard[];
  channels: ChannelOption[];
  roles: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [boards, setBoards] = useState<SuggestionBoard[]>(initial);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const saved = new Set(initial.map((b) => b.id));
  const update = (i: number, patch: Partial<SuggestionBoard>) => setBoards(boards.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const channelName = (id: string) => channels.find((c) => c.id === id)?.name ?? id;

  return (
    <section className="card mb-6 grid gap-4 p-6 text-sm" aria-labelledby="boards-title">
      <div>
        <h2 id="boards-title" className="font-display text-lg font-semibold">
          Bereiche &amp; Knopf zum Einreichen
        </h2>
        <p className="text-fog-500">
          Wie bei GalaxyBot: Jeder Bereich hat seinen Kanal mit dem Knopf „💡 Vorschlag einreichen“ (bleibt immer unten). Mit Team-Kanal entscheiden Owner, Admins und Team-Rollen dort per
          Knopf (✅ Annehmen · ❌ Ablehnen · 🤔 In Prüfung), sonst direkt unter dem Vorschlag.
        </p>
        {!enabled && <p className="mt-2 text-sun-400">Vorschläge sind aus – erst unter „Einstellungen“ einschalten.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-700 px-4 py-3">
        <span className="min-w-0 flex-1">
          <b>{main?.name ?? 'Hauptbereich'}</b> <span className="text-fog-500">{main ? `· #${channelName(main.channelId)} · Einstellungen im Reiter „Einstellungen“` : '· noch kein Kanal gewählt (Reiter „Einstellungen“)'}</span>
        </span>
        {canEdit && main && <PanelButton guildId={guildId} boardId="main" disabled={!enabled} />}
      </div>

      <fieldset disabled={!canEdit || pending} className="grid min-w-0 gap-3">
        <legend className="sr-only">Weitere Bereiche</legend>
        {boards.map((b, i) => (
          <div key={b.id} className="grid gap-3 rounded-xl border border-ink-700 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid min-w-0 flex-1 gap-1">
                <span className="text-fog-300">Name des Bereichs</span>
                <input aria-label={`Name von Bereich ${i + 2}`} value={b.name} maxLength={40} onChange={(e) => update(i, { name: e.target.value })} className="input" />
              </label>
              <button type="button" className="btn-ghost px-3 py-2 text-danger-500" onClick={() => setBoards(boards.filter((_, j) => j !== i))} aria-label={`Bereich ${b.name || i + 2} entfernen`}>
                ✕
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <ChannelPick label="Vorschlags-Kanal" value={b.channelId} channels={channels} empty="— Kanal wählen —" onChange={(v) => update(i, { channelId: v })} />
              <ChannelPick label="Team-Kanal (optional)" value={b.staffChannelId} channels={channels} empty="— keiner —" onChange={(v) => update(i, { staffChannelId: v })} />
              <ChannelPick label="Ergebnis-Kanal (optional)" value={b.resultChannelId} channels={channels} empty="— keiner —" onChange={(v) => update(i, { resultChannelId: v })} />
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={b.threads} onChange={(e) => update(i, { threads: e.target.checked })} className="size-4 accent-coral-500" />
                Thread zum Diskutieren
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={b.anonymous} onChange={(e) => update(i, { anonymous: e.target.checked })} className="size-4 accent-coral-500" />
                Anonym
              </label>
            </div>
            <div className="grid gap-1.5">
              <span className="text-fog-300">Team-Rollen, die entscheiden dürfen (Owner und Admins immer)</span>
              <div className="flex flex-wrap gap-1.5">
                {roles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={b.staffRoleIds.includes(r.id)}
                    onClick={() => update(i, { staffRoleIds: b.staffRoleIds.includes(r.id) ? b.staffRoleIds.filter((x) => x !== r.id) : [...b.staffRoleIds, r.id] })}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${b.staffRoleIds.includes(r.id) ? 'border-coral-500 bg-coral-500/15 text-coral-400' : 'border-ink-700 text-fog-300 hover:border-ink-600'}`}
                  >
                    @ {r.name}
                  </button>
                ))}
              </div>
            </div>
            {saved.has(b.id) && <PanelButton guildId={guildId} boardId={b.id} disabled={!enabled} />}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-ghost"
            disabled={boards.length >= 9}
            onClick={() => setBoards([...boards, { id: `b${Date.now().toString(36)}`, name: '', channelId: '', threads: true, anonymous: false, staffRoleIds: [], staffChannelId: '', resultChannelId: '' }])}
          >
            + Bereich hinzufügen
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              start(async () => {
                const r = await saveSuggestionBoards(guildId, JSON.stringify(boards));
                setMsg({ ok: r.ok, text: r.message ?? '' });
                if (r.ok) router.refresh();
              })
            }
          >
            {pending ? 'Speichere …' : 'Bereiche speichern'}
          </button>
          {msg && (
            <p role="status" className={msg.ok ? 'text-sea-400' : 'text-danger-500'}>
              {msg.text}
            </p>
          )}
        </div>
      </fieldset>
    </section>
  );
}
