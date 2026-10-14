'use client';

import { useState, useTransition } from 'react';
import type { ProfileAnalysisItem } from '@moin/shared';
import { activateServerProfile, analyzeServerProfile, deactivateServerProfile, refreshBlueprintEverywhere, refreshServerProfile, removeBlueprintRank } from '@/app/g/[guildId]/vorlagen/actions';

export interface BlueprintView {
  id: string;
  icon: string;
  name: string;
  description: string;
  roles: { name: string; color: number; kind: string; rankId?: string }[];
  categories: { name: string; team: boolean; channels: { name: string; voice: boolean; access: string }[] }[];
  modules: string[];
}

const ACCESS_HINT: Record<string, string> = { readonly: '📖 nur lesen', team: '🔒 nur Team', all: '' };
const KIND_HINT: Record<string, string> = { mod: 'Team (moderieren, keine Admin-Rechte)', member: 'Mitglieder', ping: 'zum Anpingen' };
const RANK_HINT = 'eigener Rang (unter Ränge hinzugefügt)';
const ITEM_ICON: Record<ProfileAnalysisItem['kind'], string> = { role: '🎭', category: '📁', text: '#', voice: '🔊' };
const ITEM_LABEL: Record<ProfileAnalysisItem['kind'], string> = { role: 'Rolle', category: 'Kategorie', text: 'Kanal', voice: 'Sprachkanal' };

/**
 * Profil-Auswahl: Vorschau, Anwenden mit Bestätigung, Deaktivieren mit Wahl „angelegte Kanäle/Rollen löschen“.
 * Vor dem Anwenden (Issue #7): pro Rolle/Kanal „vorhandene übernehmen“ oder „neu anlegen“, optional Rollen anpassen.
 */
export function ServerProfiles({
  guildId,
  canEdit,
  isInstanceAdmin = false,
  blueprints,
  active,
}: {
  guildId: string;
  canEdit: boolean;
  isInstanceAdmin?: boolean;
  blueprints: BlueprintView[];
  active: { blueprintId: string; name: string; since: string; createdCount: number } | null;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [deleteCreated, setDeleteCreated] = useState(true);
  const [items, setItems] = useState<ProfileAnalysisItem[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [adjustRoles, setAdjustRoles] = useState(false);

  // „Anwenden …“: erst nachsehen, was es im Server schon gibt
  const prepare = (blueprintId: string) =>
    start(async () => {
      const res = await analyzeServerProfile(guildId, blueprintId);
      if (!res.ok || !res.items) {
        setMessage({ ok: false, text: res.message ?? 'Fehler' });
        return;
      }
      setItems(res.items);
      setPicks(Object.fromEntries(res.items.map((i) => [i.key, i.match?.id ?? 'new'])));
      setAdjustRoles(false);
      setMessage(null);
      setConfirm(blueprintId);
    });
  const choices = () => ({ reuse: Object.fromEntries(items.map((i) => [i.key, picks[i.key] && picks[i.key] !== 'new' ? picks[i.key]! : null])), adjustRoles });
  const reuseCount = items.filter((i) => picks[i.key] && picks[i.key] !== 'new').length;

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
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-ghost w-fit" disabled={!canEdit || pending} onClick={() => run(() => refreshServerProfile(guildId))} title="Fehlende Rollen der Vorlage anlegen, eigene Ränge an Änderungen anpassen – nichts wird gelöscht">
              🔄 Profil aktualisieren
            </button>
            <button type="button" className="btn-ghost w-fit" disabled={!canEdit || pending} onClick={() => run(() => deactivateServerProfile(guildId, deleteCreated))}>
              {pending ? '…' : 'Profil deaktivieren und alten Stand zurückholen'}
            </button>
          </div>
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
              <button type="button" className="btn-primary" onClick={() => prepare(b.id)} disabled={pending}>
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
                  <li key={r.name} className="flex items-center gap-2" title={r.rankId ? RANK_HINT : KIND_HINT[r.kind]}>
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: `#${r.color.toString(16).padStart(6, '0')}` }} />
                    <span data-no-dummies>{r.name}</span> <span className="text-xs text-fog-500">{r.rankId ? '🎖️ eigener Rang' : KIND_HINT[r.kind]}</span>
                    {r.rankId && isInstanceAdmin && (
                      <button type="button" className="text-xs text-fog-500 underline" disabled={pending} onClick={() => run(() => removeBlueprintRank(guildId, r.rankId!))} aria-label={`${r.name} aus der Vorlage nehmen`}>
                        entfernen
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {isInstanceAdmin && b.roles.some((r) => r.rankId) && (
                <button type="button" className="mt-2 text-xs text-coral-400 underline" disabled={pending} onClick={() => run(() => refreshBlueprintEverywhere(guildId, b.id))}>
                  🔄 Alle Server mit diesem Profil aktualisieren
                </button>
              )}
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
                <b>So geht es:</b> Erst wird der jetzige Stand gesichert. Dann legt der Bot an, was fehlt. Was es schon gibt, kannst du übernehmen – der Bot hat
                passende Rollen und Kanäle (auch mit ähnlichem Namen) schon vorgeschlagen. Zum Schluss stellt er die genannten Module passend ein.
              </p>
              <div className="grid gap-1.5" role="list" aria-label="Vorhandenes übernehmen">
                {items.map((item) => (
                  <div key={item.key} role="listitem" className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                    <span className="min-w-0 truncate">
                      <span className="inline-block w-5 text-center text-fog-500" title={ITEM_LABEL[item.kind]}>
                        {ITEM_ICON[item.kind]}
                      </span>{' '}
                      {item.name}
                      {item.match && !item.match.exact && picks[item.key] === item.match.id && <span className="ml-1 text-xs text-sun-400">ähnlich</span>}
                    </span>
                    <select
                      aria-label={`${ITEM_LABEL[item.kind]} ${item.name}`}
                      className="input py-1.5"
                      value={picks[item.key] ?? 'new'}
                      disabled={pending}
                      onChange={(e) => setPicks({ ...picks, [item.key]: e.target.value })}
                    >
                      <option value="new">➕ neu anlegen</option>
                      {item.match && <option value={item.match.id}>übernehmen: {item.match.name}{item.match.exact ? '' : ' (ähnlich)'}</option>}
                      {item.options
                        .filter((o) => o.id !== item.match?.id)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            übernehmen: {o.name}
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
              </div>
              <label className="flex items-start gap-2" title="Nur dazu, nie weg. Beim Deaktivieren bekommen die Rollen ihren alten Stand zurück.">
                <input type="checkbox" checked={adjustRoles} onChange={(e) => setAdjustRoles(e.target.checked)} className="mt-1 size-4 accent-coral-500" disabled={pending} />
                <span>
                  Übernommene Rollen anpassen: Farbe wie im Profil, Team-Rollen bekommen fehlende Moderations-Rechte dazu. Der alte Stand wird gemerkt und beim
                  Deaktivieren zurückgesetzt.
                </span>
              </label>
              <p className="text-fog-300">
                {reuseCount} übernehmen, {items.length - reuseCount} neu anlegen.
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-primary" disabled={pending} onClick={() => run(() => activateServerProfile(guildId, b.id, choices()))}>
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
