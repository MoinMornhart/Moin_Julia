'use client';

import { useState, useTransition } from 'react';
import type { JuliaRoyal } from '@moin/shared';
import { addRoyalRuler, removeRoyalRuler, saveRoyalSettings } from '@/app/g/[guildId]/julia/actions';
import type { ActionResult } from '@/app/g/[guildId]/actions';
import { SectionCard, ToggleRow } from './FormParts';

/**
 * 👑 Herrscher – gilt für alle Server dieser Instanz. Ändern darf das NUR der Instanz-Admin;
 * alle anderen sehen nur, wer Herrscher ist.
 */
export function RoyalSettings({ guildId, isAdmin, royal, ownerLabel }: { guildId: string; isAdmin: boolean; royal: JuliaRoyal; ownerLabel: string }) {
  const [message, setMessage] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [formKey, setFormKey] = useState(0);
  const run = (fn: () => Promise<ActionResult>, reset = false) =>
    start(async () => {
      const r = await fn();
      setMessage(r);
      if (r.ok && reset) setFormKey((k) => k + 1);
    });

  return (
    <SectionCard
      title="👑 Herrscher"
      description="Julia verehrt ihre Herrscher (Verneigung, Titel, Schmeichelei – nie sexuell), steht loyal zu ihnen und verteidigt sie mit Humor, ohne andere zu beleidigen. Anweisungen zu ihrem Verhalten nimmt sie nur von Herrschern an. Ihre Grundregeln gelten für alle."
    >
      <ul className="grid gap-2 text-sm" aria-label="Herrscher">
        <li className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 px-4 py-2.5">
          <span className="min-w-0 flex-1 break-words">
            <b>{ownerLabel}</b> · „{royal.ownerTitle}“ <span className="text-fog-500">(Instanz-Admin – immer, lässt sich nicht abschalten)</span>
          </span>
        </li>
        {royal.rulers.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 px-4 py-2.5">
            <span className="min-w-0 flex-1 break-words">
              <b>{r.name || r.id}</b> · „{r.title}“
            </span>
            {isAdmin && (
              <button type="button" className="text-xs text-fog-500 hover:text-danger-500" disabled={pending} onClick={() => run(() => removeRoyalRuler(guildId, r.id))}>
                {r.name || r.id} absetzen
              </button>
            )}
          </li>
        ))}
      </ul>
      {isAdmin ? (
        <>
          <form action={(form) => run(() => saveRoyalSettings(guildId, form))} className="grid gap-3 text-sm">
            <fieldset disabled={pending} className="grid gap-3">
              <label className="grid gap-1.5">
                <span className="font-semibold">Dein Titel</span>
                <input name="ownerTitle" defaultValue={royal.ownerTitle} minLength={2} maxLength={40} className="input max-w-xs" />
              </label>
              <ToggleRow name="enabled" label="Ernannte Herrscher verehren (du selbst bist es immer)" defaultChecked={royal.enabled} />
              <ToggleRow name="onlyRulers" label="Julia dient nur den Herrschern – allen anderen antwortet sie nicht" defaultChecked={royal.onlyRulers} />
            </fieldset>
            <div>
              <button type="submit" className="btn-primary" disabled={pending}>
                Herrscher-Einstellungen speichern
              </button>
            </div>
          </form>
          <form key={formKey} action={(form) => run(() => addRoyalRuler(guildId, form), true)} className="grid gap-2 border-t border-ink-700 pt-4 text-sm">
            <p className="font-semibold">Jemanden ernennen</p>
            <p className="text-xs text-fog-500">
              Am einfachsten in Discord: <code>/julia herrscher</code> oder „@Julia ernenne @Max zum König“. Hier geht es mit der Discord-ID.
            </p>
            <fieldset disabled={pending} className="grid gap-2 sm:grid-cols-3">
              <input name="rulerId" aria-label="Discord-ID" placeholder="Discord-ID" inputMode="numeric" className="input font-mono" />
              <input name="rulerName" aria-label="Name" placeholder="Name (wie Julia ihn nennt)" maxLength={40} className="input" />
              <input name="rulerTitle" aria-label="Titel" placeholder="Titel, z. B. König" maxLength={40} className="input" />
            </fieldset>
            <div>
              <button type="submit" className="btn-ghost" disabled={pending}>
                👑 Ernennen
              </button>
            </div>
          </form>
        </>
      ) : (
        <p className="rounded-lg border border-ink-700 px-3 py-2 text-xs text-fog-300">Wer Herrscher ist, bestimmt nur der Instanz-Admin (wer Moin_Julia installiert hat).</p>
      )}
      {message?.message && <p className={`text-sm ${message.ok ? 'text-sea-400' : 'text-danger-500'}`}>{message.message}</p>}
    </SectionCard>
  );
}
