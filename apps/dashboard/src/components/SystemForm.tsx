'use client';

import { KeepForm } from './KeepForm';
import { useActionState } from 'react';
import { saveSystemSettings, type SystemResult } from '@/app/system/actions';
import { SectionCard } from './FormParts';

interface Current {
  discordClientId: string;
  dashboardUrl: string;
  discordToken: string | null;
  discordClientSecret: string | null;
}

function Text({ name, label, defaultValue, placeholder }: { name: string; label: string; defaultValue: string; placeholder?: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="font-semibold">{label}</span>
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} spellCheck={false} autoComplete="off" className="input font-mono" />
    </label>
  );
}

/** Geheimnis: zeigt nur die letzten 4 Zeichen; leer lassen = unverändert. */
function Secret({ name, label, current, clearable = false }: { name: string; label: string; current: string | null; clearable?: boolean }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={name} className="font-semibold">
        {label} <span className="ml-2 font-mono text-xs font-normal text-fog-500">{current ?? 'nicht gesetzt'}</span>
      </label>
      <input id={name} name={name} type="password" placeholder="leer lassen = unverändert" autoComplete="new-password" className="input font-mono" />
      {clearable && current && (
        <label className="flex items-center gap-2 text-xs text-fog-500">
          <input type="checkbox" name={`${name}.clear`} /> entfernen
        </label>
      )}
    </div>
  );
}

export function SystemForm({ current }: { current: Current }) {
  const [state, action, pending] = useActionState<SystemResult | null, FormData>((_p, form) => saveSystemSettings(form), null);
  return (
    <KeepForm action={action} className="grid gap-6">
      <fieldset disabled={pending} className="grid gap-6">
        <SectionCard title="Discord" description="Änderungen werden vor dem Speichern bei Discord geprüft. Danach startet der Bot neu.">
          <Text name="discordClientId" label="Application ID" defaultValue={current.discordClientId} />
          <Secret name="discordToken" label="Bot-Token" current={current.discordToken} />
          <Secret name="discordClientSecret" label="Client Secret" current={current.discordClientSecret} />
        </SectionCard>
        <SectionCard
          title="Adresse"
          description={
            <>
              Ändert sich die Adresse (z. B. auf eine Domain), muss im Developer Portal unter OAuth2 → Redirects auch{' '}
              <code>&lt;Adresse&gt;/api/auth/callback</code> eingetragen sein.
            </>
          }
        >
          <Text name="dashboardUrl" label="Dashboard-URL" defaultValue={current.dashboardUrl} placeholder="https://bot.deine-domain.de" />
        </SectionCard>
      </fieldset>
      <div className="grid gap-2">
        <button type="submit" className="btn-primary w-fit" disabled={pending}>
          {pending ? 'Prüfe und speichere …' : 'Speichern'}
        </button>
        {state?.messages.map((m) => (
          <p key={m} className={`text-sm ${state.ok ? 'text-sea-400' : 'text-danger-500'}`}>
            {m}
          </p>
        ))}
      </div>
    </KeepForm>
  );
}
