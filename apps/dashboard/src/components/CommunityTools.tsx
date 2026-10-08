'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useState, useTransition } from 'react';
import type { SuggestionStatus } from '@moin/shared';
import { createGiveaway, decideSuggestion } from '@/app/g/[guildId]/community/actions';
import type { ActionResult } from '@/app/g/[guildId]/actions';
import type { ChannelOption } from '@/lib/discord';
import { ChannelSelect } from './ChannelSelect';
import { RoleSelect } from './FormParts';
import { KeepForm } from './KeepForm';

/** Entscheidung über einen Vorschlag – mit optionaler Begründung (geht per DM an die Person) */
export function SuggestionDecision({ guildId, suggestionId, status, reason }: { guildId: string; suggestionId: string; status: SuggestionStatus; reason: string | null }) {
  const router = useRouter();
  const [text, setText] = useState(reason ?? '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const decide = (next: SuggestionStatus) =>
    start(async () => {
      const r = await decideSuggestion(guildId, suggestionId, next, text);
      setMessage({ ok: r.ok, text: r.message ?? '' });
      if (r.ok) router.refresh();
    });
  return (
    <div className="grid gap-2">
      <input aria-label="Begründung (optional)" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Begründung (optional, geht per DM an die Person)" className="input" />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending || status === 'accepted'} className="btn-ghost py-1.5 text-sea-400" onClick={() => decide('accepted')}>
          ✅ Annehmen
        </button>
        <button type="button" disabled={pending || status === 'considered'} className="btn-ghost py-1.5 text-sun-400" onClick={() => decide('considered')}>
          🤔 Überlegen
        </button>
        <button type="button" disabled={pending || status === 'denied'} className="btn-ghost py-1.5 text-danger-500" onClick={() => decide('denied')}>
          ❌ Ablehnen
        </button>
        {status !== 'open' && (
          <button type="button" disabled={pending} className="text-xs text-fog-500 underline" onClick={() => decide('open')}>
            wieder öffnen
          </button>
        )}
        {message && <span className={`text-xs ${message.ok ? 'text-sea-400' : 'text-danger-500'}`}>{message.text}</span>}
      </div>
    </div>
  );
}

/** Neues Giveaway aus dem Dashboard */
export function GiveawayForm({ guildId, channels, roles }: { guildId: string; channels: ChannelOption[]; roles: { id: string; name: string }[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async (_p, form) => {
    const r = await createGiveaway(guildId, form);
    if (r.ok) setTimeout(() => router.refresh(), 2500);
    return r;
  }, null);
  return (
    <KeepForm action={action} className="card grid gap-4 p-6">
      <p className="font-display text-lg font-semibold">Neues Giveaway</p>
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-semibold">Preis</span>
          <input name="prize" maxLength={200} required placeholder="z. B. Discord Nitro (1 Monat)" className="input" />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">Kanal</span>
          <ChannelSelect id="giveaway-channel" name="channelId" channels={channels} defaultValue={null} emptyLabel="— Kanal wählen —" />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">Dauer</span>
          <input name="duration" defaultValue="1d" maxLength={20} placeholder="30m, 2h, 3d" className="input" />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">Gewinner</span>
          <input name="winners" type="number" min={1} max={20} defaultValue={1} className="input w-28" />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">Nur für Rolle (optional)</span>
          <RoleSelect id="giveaway-role" name="roleId" roles={roles} defaultValue={null} emptyLabel="— alle dürfen —" />
        </label>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Starte …' : '🎉 Giveaway starten'}
        </button>
        {state?.message && <p className={`text-sm ${state.ok ? 'text-sea-400' : 'text-danger-500'}`}>{state.message}</p>}
      </div>
    </KeepForm>
  );
}
