'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { rankMembers, type RoleWarning } from '@moin/shared';
import { setMemberRoles } from '@/app/g/[guildId]/mitglieder/actions';
import type { MemberRow } from '@/lib/members';

export interface MemberRoleView {
  id: string;
  name: string;
  color: number;
  /** Grund, warum die Rolle nicht änderbar ist (null = geht) */
  blocked: string | null;
  /** Gefährliche Rechte dieser Rolle (Bezeichnungen) */
  warning: string[];
}

type Sort = 'name' | 'new' | 'old';
const PAGE = 50;
const hex = (c: number) => (c ? `#${c.toString(16).padStart(6, '0')}` : '#8c96ba');
const joined = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }) : '–');

/** Mitglieder-Liste wie in Discord: suchen, sortieren, nach Rolle filtern, Rollen vergeben mit Warnung (Issue #7/#8) */
export function MemberManager({ guildId, canEdit, members, roles }: { guildId: string; canEdit: boolean; members: MemberRow[]; roles: MemberRoleView[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const [roleFilter, setRoleFilter] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [editing, setEditing] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<RoleWarning[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rows, setRows] = useState(members);
  const [pending, start] = useTransition();
  // Neue Daten vom Server übernehmen (z. B. Rolle in Discord vergeben) – nicht mitten im Bearbeiten
  useEffect(() => {
    if (editing === null) setRows(members);
  }, [members, editing]);
  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const list = useMemo(() => {
    let out = query.trim() ? rankMembers(query, rows, 500) : [...rows];
    if (roleFilter) out = out.filter((m) => m.roles.includes(roleFilter));
    if (!query.trim()) {
      const t = (m: MemberRow) => (m.joinedAt ? Date.parse(m.joinedAt) : 0);
      out.sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name, 'de') : sort === 'new' ? (a, b) => t(b) - t(a) : (a, b) => t(a) - t(b));
    }
    return out;
  }, [rows, query, sort, roleFilter]);

  const open = (m: MemberRow) => {
    setEditing(editing === m.id ? null : m.id);
    setPicked(new Set(m.roles));
    setConfirm(null);
    setMsg(null);
  };
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
    setConfirm(null);
  };
  const save = (m: MemberRow, confirmed: boolean) =>
    start(async () => {
      const wanted = [...picked];
      const r = await setMemberRoles(guildId, m.id, wanted, confirmed);
      if (r.confirm) {
        setConfirm(r.confirm);
        setMsg(null);
        return;
      }
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) {
        setRows((all) => all.map((x) => (x.id === m.id ? { ...x, roles: wanted.filter((id) => roleById.has(id)) } : x)));
        setEditing(null);
        setConfirm(null);
      }
    });

  // Live-Warnung schon beim Ankreuzen: welche gefährlichen Rechte kämen dazu?
  const editingMember = rows.find((m) => m.id === editing);
  const liveWarnings = editingMember ? roles.filter((r) => picked.has(r.id) && !editingMember.roles.includes(r.id) && r.warning.length) : [];

  return (
    <div className="grid gap-4">
      {msg && (
        <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${msg.ok ? 'border-sea-500/40 bg-sea-500/10' : 'border-danger-500/40 bg-danger-500/10'}`}>
          {msg.text}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <input
          type="search"
          aria-label="Mitglied suchen"
          placeholder="Name suchen (Tippfehler sind okay) …"
          className="input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
        />
        <select aria-label="Sortieren" className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)} disabled={!!query.trim()}>
          <option value="name">Name A–Z</option>
          <option value="new">Neueste zuerst</option>
          <option value="old">Am längsten dabei</option>
        </select>
        <select aria-label="Nach Rolle filtern" className="input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">Alle Rollen</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-fog-500">
        {list.length} von {rows.length} Mitgliedern
      </p>

      <ul className="grid gap-2" aria-label="Mitglieder-Liste">
        {list.slice(0, shown).map((m) => (
          <li key={m.id} className="card grid gap-3 p-3" aria-label={`Mitglied ${m.name}`}>
            <div className="flex flex-wrap items-center gap-3">
              {m.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatar} alt="" className="size-10 shrink-0 rounded-full" />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-700 text-sm font-bold">{m.name.slice(0, 2).toUpperCase()}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m.name}</p>
                <p className="truncate text-xs text-fog-500">
                  @{m.username} · dabei seit {joined(m.joinedAt)}
                </p>
              </div>
              {canEdit && (
                <button type="button" className="btn-ghost px-3 py-1.5 text-sm" aria-expanded={editing === m.id} onClick={() => open(m)}>
                  {editing === m.id ? 'Schließen' : 'Rollen ändern'}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {m.roles.length === 0 && <span className="text-xs text-fog-500">keine Rollen</span>}
              {m.roles
                .map((id) => roleById.get(id))
                .filter((r): r is MemberRoleView => !!r)
                .map((r) => (
                  <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full border border-ink-600 px-2 py-0.5 text-xs">
                    <span className="size-2 rounded-full" style={{ backgroundColor: hex(r.color) }} />
                    {r.name}
                  </span>
                ))}
            </div>

            {editing === m.id && (
              <div className="grid gap-3 rounded-xl border border-ink-700 p-3" role="group" aria-label={`Rollen von ${m.name}`}>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {roles.map((r) => (
                    <label key={r.id} className={`flex items-start gap-2 text-sm ${r.blocked ? 'opacity-50' : ''}`} title={r.blocked ?? (r.warning.length ? `Gefährlich: ${r.warning.join(', ')}` : '')}>
                      <input type="checkbox" className="mt-1 size-4 accent-coral-500" checked={picked.has(r.id)} disabled={!!r.blocked || pending} onChange={() => toggle(r.id)} />
                      <span className="min-w-0">
                        <span className="mr-1.5 inline-block size-2 rounded-full" style={{ backgroundColor: hex(r.color) }} />
                        {r.name}
                        {r.warning.length > 0 && <span className="ml-1 text-xs text-sun-400">⚠️</span>}
                        {r.blocked && <span className="block text-xs text-fog-500">{r.blocked}</span>}
                      </span>
                    </label>
                  ))}
                </div>

                {(confirm ?? liveWarnings).length > 0 && (
                  <div className="grid gap-1.5 rounded-xl border border-sun-400/50 bg-sun-400/10 p-3 text-sm" role="alert">
                    <p className="font-semibold">⚠️ Achtung: {m.name} bekommt dadurch gefährliche Rechte</p>
                    <ul className="ml-4 list-disc">
                      {confirm
                        ? confirm.map((w) => (
                            <li key={w.roleId}>
                              <b>{w.roleName}:</b> {w.perms.map((p) => `${p.label} (${p.why})`).join(' · ')}
                            </li>
                          ))
                        : liveWarnings.map((r) => (
                            <li key={r.id}>
                              <b>{r.name}:</b> {r.warning.join(', ')}
                            </li>
                          ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {confirm ? (
                    <button type="button" className="btn-primary" disabled={pending} onClick={() => save(m, true)}>
                      {pending ? '…' : 'Ja, trotzdem speichern'}
                    </button>
                  ) : (
                    <button type="button" className="btn-primary" disabled={pending} onClick={() => save(m, false)}>
                      {pending ? '…' : 'Rollen speichern'}
                    </button>
                  )}
                  <button type="button" className="btn-ghost" disabled={pending} onClick={() => setEditing(null)}>
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {list.length > shown && (
        <button type="button" className="btn-ghost w-fit" onClick={() => setShown((n) => n + PAGE)}>
          Mehr zeigen ({list.length - shown} weitere)
        </button>
      )}
    </div>
  );
}
