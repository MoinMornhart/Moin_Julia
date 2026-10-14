'use client';

import { useState, useTransition } from 'react';
import { buildRankName, dangerousIn, RANK_PACKAGE_INFO, RANK_PACKAGES, RANK_SEPARATORS, RANK_TEMPLATES, rankPermissions, splitRankName, type RankPackage } from '@moin/shared';
import { createRank, updateRank, type RankInput } from '@/app/g/[guildId]/raenge/actions';

export interface RankRoleView {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: string;
  blocked: string | null;
}

const SEPARATOR_LABELS: Record<string, string> = { ' ': 'Leerzeichen', '': 'ohne' };
const QUICK_EMOJIS = ['👑', '🛡️', '🔨', '🎧', '💎', '⭐', '🎮', '🎥', '🎨', '🚀', '🌊', '⚓', '🔥', '🤖', '👤'];
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

const EMPTY: RankInput = { emoji: '⭐', separator: '‖', name: '', color: 0x2fd1b8, pkg: 'mitglied', hoist: false, mentionable: false };

/** Ränge-Baukasten (Issue #8): Vorlagen, Live-Vorschau, anlegen und bearbeiten */
export function RankBuilder({ guildId, canEdit, isOwner, roles }: { guildId: string; canEdit: boolean; isOwner: boolean; roles: RankRoleView[] }) {
  const [form, setForm] = useState<RankInput>(EMPTY);
  const [editing, setEditing] = useState<RankRoleView | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<RankInput>) => setForm((f) => ({ ...f, ...patch }));

  const name = buildRankName(form.emoji, form.separator, form.name);
  const dangers = form.pkg === 'unveraendert' ? [] : dangerousIn(rankPermissions(form.pkg));

  const applyTemplate = (t: (typeof RANK_TEMPLATES)[number]) => {
    setEditing(null);
    setForm({ emoji: t.emoji, separator: form.separator, name: t.name, color: t.color, pkg: t.pkg === 'admin' && !isOwner ? 'mod' : t.pkg, hoist: RANK_PACKAGE_INFO[t.pkg].hoist, mentionable: false });
    setMsg(t.pkg === 'admin' && !isOwner ? { ok: false, text: 'Administrator-Ränge legt nur der Server-Owner an – das Paket steht deshalb auf „Moderator“.' } : null);
  };
  const edit = (r: RankRoleView) => {
    const parts = splitRankName(r.name);
    setEditing(r);
    setForm({ emoji: parts.emoji, separator: (RANK_SEPARATORS as readonly string[]).includes(parts.separator) ? parts.separator : ' ', name: parts.name, color: r.color, pkg: 'unveraendert', hoist: r.hoist, mentionable: r.mentionable });
    setMsg(null);
  };
  const submit = () =>
    start(async () => {
      const r = editing ? await updateRank(guildId, editing.id, form) : await createRank(guildId, form);
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) {
        setEditing(null);
        setForm(EMPTY);
      }
    });

  return (
    <div className="grid gap-6">
      {msg && (
        <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${msg.ok ? 'border-sea-500/40 bg-sea-500/10' : 'border-danger-500/40 bg-danger-500/10'}`}>
          {msg.text}
        </p>
      )}

      {canEdit && (
        <section className="card grid gap-3 p-5" aria-label="Vorlagen">
          <h2 className="font-display text-lg font-semibold">Vorlagen</h2>
          <div className="flex flex-wrap gap-2">
            {RANK_TEMPLATES.map((t) => (
              <button key={t.name} type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => applyTemplate(t)} title={RANK_PACKAGE_INFO[t.pkg].hint}>
                <span className="mr-1.5 inline-block size-2 rounded-full" style={{ backgroundColor: hex(t.color) }} />
                {t.emoji} {t.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {canEdit && (
        <section className="card grid gap-4 p-5" aria-label={editing ? 'Rang bearbeiten' : 'Rang bauen'}>
          <h2 className="font-display text-lg font-semibold">{editing ? `„${editing.name}“ bearbeiten` : 'Rang bauen'}</h2>
          <div className="grid gap-3 sm:grid-cols-[110px_130px_minmax(0,1fr)]">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Emoji</span>
              <input className="input" value={form.emoji} maxLength={16} onChange={(e) => set({ emoji: e.target.value })} aria-label="Emoji" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Trennzeichen</span>
              <select className="input" value={form.separator} onChange={(e) => set({ separator: e.target.value })} aria-label="Trennzeichen">
                {RANK_SEPARATORS.map((s) => (
                  <option key={s || 'ohne'} value={s}>
                    {SEPARATOR_LABELS[s] ?? s}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Name</span>
              <input className="input" value={form.name} maxLength={90} onChange={(e) => set({ name: e.target.value })} placeholder="z. B. Mod" aria-label="Name des Rangs" />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Schnell-Emojis">
            {QUICK_EMOJIS.map((e) => (
              <button key={e} type="button" className="rounded-lg border border-ink-700 px-2 py-1 hover:border-ink-500" onClick={() => set({ emoji: e })} aria-label={`Emoji ${e}`}>
                {e}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[130px_minmax(0,1fr)]">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Farbe</span>
              <input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-ink-700 bg-transparent" value={hex(form.color)} onChange={(e) => set({ color: parseInt(e.target.value.slice(1), 16) })} aria-label="Farbe" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Rechte-Paket</span>
              <select className="input" value={form.pkg} onChange={(e) => set({ pkg: e.target.value as RankInput['pkg'], hoist: e.target.value === 'unveraendert' ? form.hoist : RANK_PACKAGE_INFO[e.target.value as RankPackage].hoist })} aria-label="Rechte-Paket">
                {editing && <option value="unveraendert">Rechte nicht ändern</option>}
                {RANK_PACKAGES.map((p) => (
                  <option key={p} value={p} disabled={p === 'admin' && !isOwner}>
                    {RANK_PACKAGE_INFO[p].label}
                    {p === 'admin' && !isOwner ? ' (nur Server-Owner)' : ''}
                  </option>
                ))}
              </select>
              <span className="text-xs text-fog-500">{form.pkg === 'unveraendert' ? 'Die Rechte der Rolle bleiben, wie sie sind.' : RANK_PACKAGE_INFO[form.pkg].hint}</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-4 accent-coral-500" checked={form.hoist} onChange={(e) => set({ hoist: e.target.checked })} />
              In der Mitgliederliste getrennt anzeigen
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-4 accent-coral-500" checked={form.mentionable} onChange={(e) => set({ mentionable: e.target.checked })} />
              Alle dürfen den Rang @erwähnen
            </label>
          </div>

          <div className="grid gap-2 rounded-xl border border-ink-700 bg-ink-950/60 p-4" aria-label="Vorschau">
            <p className="text-xs font-bold tracking-[0.15em] text-fog-500 uppercase">Vorschau wie in Discord</p>
            <p className="text-lg font-semibold" style={{ color: hex(form.color) }} data-testid="rank-preview">
              {name || '…'}
            </p>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-ink-600 px-2 py-0.5 text-xs">
              <span className="size-2 rounded-full" style={{ backgroundColor: hex(form.color) }} />
              {name || '…'}
            </span>
          </div>

          {dangers.length > 0 && (
            <div className="rounded-xl border border-sun-400/50 bg-sun-400/10 p-3 text-sm" role="alert">
              <p className="font-semibold">⚠️ Dieser Rang bekommt gefährliche Rechte:</p>
              <p>{dangers.map((d) => d.label).join(', ')} – nur an Leute vergeben, denen du vertraust.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={pending || !name} onClick={submit}>
              {pending ? '…' : editing ? 'Änderungen speichern' : 'Rang anlegen'}
            </button>
            {editing && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setEditing(null);
                  setForm(EMPTY);
                }}
              >
                Abbrechen
              </button>
            )}
          </div>
        </section>
      )}

      <section className="card grid gap-3 p-5" aria-label="Vorhandene Ränge">
        <h2 className="font-display text-lg font-semibold">Vorhandene Ränge ({roles.length})</h2>
        <ul className="grid gap-1.5">
          {roles.map((r) => {
            const d = dangerousIn(r.permissions);
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-800 px-3 py-2 text-sm">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color ? hex(r.color) : '#8c96ba' }} />
                <span className="min-w-0 flex-1 truncate font-medium" style={{ color: r.color ? hex(r.color) : undefined }}>
                  <span data-no-dummies>{r.name}</span>
                </span>
                {d.length > 0 && <span className="text-xs text-sun-400" title={d.map((x) => x.label).join(', ')}>⚠️ {d.some((x) => x.name === 'Administrator') ? 'Administrator' : `${d.length} heikle Rechte`}</span>}
                {canEdit &&
                  (r.blocked ? (
                    <span className="text-xs text-fog-500">{r.blocked}</span>
                  ) : (
                    <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => edit(r)} aria-label={`${r.name} bearbeiten`}>
                      Bearbeiten
                    </button>
                  ))}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
