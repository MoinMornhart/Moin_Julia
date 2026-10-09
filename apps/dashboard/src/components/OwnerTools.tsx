'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addOwnerChannel, createAdminRole, replaceAdministrator, saveOwnerSettings } from '@/app/g/[guildId]/owner/actions';

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, refreshAfter = 2500) =>
    start(async () => {
      const r = await fn();
      setMessage({ ok: r.ok, text: r.message ?? '' });
      if (r.ok) setTimeout(() => router.refresh(), refreshAfter);
    });
  return { pending, message, run };
}

const Msg = ({ m }: { m: { ok: boolean; text: string } | null }) => (m ? <p className={`text-sm ${m.ok ? 'text-sea-400' : 'text-danger-500'}`}>{m.text}</p> : null);

export function AddOwnerChannel({ guildId }: { guildId: string }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'text' | 'voice'>('text');
  const { pending, message, run } = useRun();
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <select aria-label="Kanal-Art" value={kind} onChange={(e) => setKind(e.target.value as 'text' | 'voice')} className="input w-auto">
          <option value="text"># Text</option>
          <option value="voice">🔊 Sprache</option>
        </select>
        <input aria-label="Name des neuen Kanals" value={name} maxLength={90} onChange={(e) => setName(e.target.value)} placeholder="z. B. ideen, finanzen, privat" className="input min-w-0 flex-1" />
        <button type="button" className="btn-ghost" disabled={pending || !name.trim()} onClick={() => run(() => addOwnerChannel(guildId, name, kind))}>
          + Kanal
        </button>
      </div>
      <Msg m={message} />
    </div>
  );
}

export function OwnerSettings({ guildId, allowBots, notifyOwner, autoReplaceAdmin }: { guildId: string; allowBots: boolean; notifyOwner: boolean; autoReplaceAdmin: boolean }) {
  const [bots, setBots] = useState(allowBots);
  const [notify, setNotify] = useState(notifyOwner);
  const [auto, setAuto] = useState(autoReplaceAdmin);
  const { pending, message, run } = useRun();
  return (
    <div className="grid gap-3 text-sm">
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={bots} onChange={(e) => setBots(e.target.checked)} className="mt-1 size-4 accent-coral-500" />
        <span>
          <b>Andere Bots dürfen mitlesen</b> (z. B. Log- oder Musik-Bots). Aus: nur du und Moin_Julia.
        </span>
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-1 size-4 accent-coral-500" />
        <span>
          <b>Mir eine DM schicken</b>, wenn jemand an den Rechten dreht (mit Namen laut Audit-Log).
        </span>
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="mt-1 size-4 accent-coral-500" />
        <span>
          <b>Neue Admin-Rollen automatisch umstellen</b> – bekommt in Discord eine Rolle „Administrator“ (neu angelegt oder geändert), ersetzt Moin_Julia das sofort durch alle Einzelrechte
          (mit Sicherung). Rollen, die du oben unter „Sicherungen“ bewusst wiederherstellst, bleiben so.
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={pending} onClick={() => run(() => saveOwnerSettings(guildId, bots, notify, auto), 800)}>
          Speichern
        </button>
        <Msg m={message} />
      </div>
    </div>
  );
}

/** „Administrator“ ersetzen – mit ausdrücklicher Bestätigung */
export function ReplaceAdminButton({ guildId, roleId, roleName }: { guildId: string; roleId: string; roleName: string }) {
  const [confirm, setConfirm] = useState(false);
  const { pending, message, run } = useRun();
  if (!confirm)
    return (
      <span className="grid gap-1">
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setConfirm(true)}>
          Administrator ersetzen …
        </button>
        <Msg m={message} />
      </span>
    );
  return (
    <span className="grid gap-2 rounded-xl border border-sun-400/40 bg-sun-400/10 p-3 text-xs">
      <span>
        <b>„{roleName}“</b> bekommt statt „Administrator“ <b>alle Einzelrechte</b> (Server verwalten, Kanäle, Rollen, Bannen …). Im Alltag ändert sich kaum etwas – aber die Rolle sieht den
        Owner-Bereich nicht mehr. Die alten Rechte werden gesichert und lassen sich hier jederzeit zurückholen.
      </span>
      <span className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary px-3 py-1.5 text-xs" disabled={pending} onClick={() => run(() => replaceAdministrator(guildId, roleId))}>
          Ja, umstellen
        </button>
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setConfirm(false)}>
          Abbrechen
        </button>
      </span>
      <Msg m={message} />
    </span>
  );
}

/** Neue Admin-Rolle – mit Häkchen „Zugriff auf alles außer den Owner-Bereich“ */
export function CreateAdminRole({ guildId }: { guildId: string }) {
  const [name, setName] = useState('Admin');
  const [color, setColor] = useState('#ff7a59');
  const [ownerSafe, setOwnerSafe] = useState(true);
  const { pending, message, run } = useRun();
  return (
    <div className="grid gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Name der Admin-Rolle" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className="input min-w-0 flex-1" />
        <input aria-label="Farbe der Rolle" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-ink-700 bg-ink-900" />
      </div>
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={ownerSafe} onChange={(e) => setOwnerSafe(e.target.checked)} className="mt-1 size-4 accent-coral-500" />
        <span>
          <b>Zugriff auf alles außer den Owner-Bereich</b> – die Rolle bekommt alle Einzelrechte statt „Administrator“. Sie kann damit praktisch alles, sieht aber deinen Owner-Bereich nicht.
          {!ownerSafe && <span className="block text-xs text-sun-400">Ohne Häkchen bekommt die Rolle „Administrator“ und sieht auch den Owner-Bereich.</span>}
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={pending || !name.trim()} onClick={() => run(() => createAdminRole(guildId, name, color, ownerSafe))}>
          Admin-Rolle anlegen
        </button>
        <Msg m={message} />
      </div>
      <p className="text-xs text-fog-500">Danach in Discord die Rolle den gewünschten Personen geben. Neue Rollen landen ganz unten – bei Bedarf in den Server-Einstellungen nach oben ziehen (unter Moin_Julia).</p>
    </div>
  );
}
