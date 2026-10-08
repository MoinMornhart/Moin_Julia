'use client';

import { useActionState } from 'react';
import type { SchutzConfig } from '@moin/shared';
import { endRaid, postVerifyPanel, saveSchutzSettings } from '@/app/g/[guildId]/schutz/actions';
import type { ActionResult } from '@/app/g/[guildId]/actions';
import type { ChannelOption } from '@/lib/discord';
import { ActionButton } from './ActionButton';
import { ChannelSelect } from './ChannelSelect';
import { ChipPicker, NumberField, RoleSelect, SectionCard, ToggleRow } from './FormParts';

const WATCH_LABELS: Record<keyof SchutzConfig['antiNuke']['watch'], string> = {
  channelDelete: 'Kanäle löschen',
  roleDelete: 'Rollen löschen',
  ban: 'Bannen',
  kick: 'Kicken',
  webhookCreate: 'Webhooks erstellen',
  adminGrant: 'Admin-Rechte vergeben (sofort)',
};

export function SchutzForm({
  guildId,
  canEdit,
  config,
  channels,
  roles,
  raidUntil,
}: {
  guildId: string;
  canEdit: boolean;
  config: SchutzConfig;
  channels: ChannelOption[];
  roles: { id: string; name: string; color: number }[];
  raidUntil: string | null;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>((_p, form) => saveSchutzSettings(guildId, form), null);
  const { antiRaid, antiNuke, verification, accountAge } = config;

  return (
    <form action={action} className="grid max-w-4xl gap-6">
      {raidUntil && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-danger-500/60 bg-danger-500/10 p-5">
          <div>
            <p className="font-display text-lg font-semibold">🚨 Raid-Modus aktiv</p>
            <p className="text-sm text-fog-300">
              Einladungen sind pausiert bis {new Date(raidUntil).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })} Uhr.
            </p>
          </div>
          <ActionButton label="Raid-Modus jetzt beenden" run={() => endRaid(guildId)} disabled={!canEdit} />
        </div>
      )}

      <fieldset disabled={!canEdit || pending} className="grid gap-6">
        <SectionCard title="Alarme" description="Wohin meldet der Bot Raids, Nuke-Versuche und verdächtige Accounts?">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="font-semibold">Alarm-Kanal</span>
              <ChannelSelect id="alertChannelId" name="alertChannelId" channels={channels} defaultValue={config.alertChannelId} emptyLabel="— kein Alarm-Kanal —" />
            </label>
            <label className="grid gap-1.5">
              <span className="font-semibold">Rolle anpingen</span>
              <RoleSelect id="alertRoleId" name="alertRoleId" roles={roles} defaultValue={config.alertRoleId} emptyLabel="— niemanden —" />
            </label>
          </div>
        </SectionCard>

        <SectionCard title="Anti-Raid" description="Erkennt Beitritts-Wellen und pausiert dann automatisch alle Einladungen.">
          <ToggleRow name="antiRaid.enabled" label="Anti-Raid aktiv" defaultChecked={antiRaid.enabled}>
            <div className="flex flex-wrap gap-4">
              <NumberField name="antiRaid.joins" label="Ab" defaultValue={antiRaid.joins} min={3} max={100} suffix="Beitritten" />
              <NumberField name="antiRaid.seconds" label="in" defaultValue={antiRaid.seconds} min={3} max={300} suffix="Sekunden" />
              <NumberField name="antiRaid.durationMin" label="Raid-Modus für" defaultValue={antiRaid.durationMin} min={1} max={1440} suffix="Minuten" />
              <label className="grid gap-1 text-sm">
                <span className="text-fog-300">Maßnahme</span>
                <select name="antiRaid.action" defaultValue={antiRaid.action} className="input w-72">
                  <option value="pause">Einladungen pausieren</option>
                  <option value="pause_kick">Pausieren + Neue während des Raids kicken</option>
                </select>
              </label>
            </div>
          </ToggleRow>
        </SectionCard>

        <SectionCard
          title="Anti-Nuke"
          description="Schützt vor Admins oder gekaperten Accounts, die in kurzer Zeit den Server zerlegen. Der Owner ist immer ausgenommen."
        >
          <ToggleRow name="antiNuke.enabled" label="Anti-Nuke aktiv" defaultChecked={antiNuke.enabled}>
            <div className="grid gap-5">
              <div className="flex flex-wrap gap-4">
                <NumberField name="antiNuke.threshold" label="Ab" defaultValue={antiNuke.threshold} min={1} max={50} suffix="gleichen Aktionen" />
                <NumberField name="antiNuke.seconds" label="in" defaultValue={antiNuke.seconds} min={3} max={600} suffix="Sekunden" />
                <label className="grid gap-1 text-sm">
                  <span className="text-fog-300">Maßnahme</span>
                  <select name="antiNuke.punishment" defaultValue={antiNuke.punishment} className="input w-56">
                    <option value="strip_roles">Alle Rollen entziehen</option>
                    <option value="kick">Kicken</option>
                    <option value="ban">Bannen</option>
                  </select>
                </label>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-fog-300">Beobachten</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(WATCH_LABELS) as (keyof typeof WATCH_LABELS)[]).map((key) => (
                    <ToggleRow key={key} name={`watch.${key}`} label={WATCH_LABELS[key]} defaultChecked={antiNuke.watch[key]} />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-fog-300">Ausgenommene Rollen</p>
                <ChipPicker name="antiNuke.whitelistRoleIds" options={roles.map((r) => ({ id: r.id, label: r.name, color: r.color }))} selected={antiNuke.whitelistRoleIds} />
              </div>
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold text-fog-300">Ausgenommene User-IDs (z. B. andere Bots), durch Komma getrennt</span>
                <input name="antiNuke.whitelistUserIds" defaultValue={antiNuke.whitelistUserIds.join(', ')} className="input font-mono" />
              </label>
            </div>
          </ToggleRow>
        </SectionCard>

        <SectionCard title="Verifizierung" description="Neue Mitglieder klicken einen Button (optional mit Rechenaufgabe) und bekommen dann die Mitglieder-Rolle.">
          <ToggleRow name="verification.enabled" label="Verifizierung aktiv" defaultChecked={verification.enabled}>
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-semibold">Rolle nach Verifizierung</span>
                  <RoleSelect id="verification.roleId" name="verification.roleId" roles={roles} defaultValue={verification.roleId} emptyLabel="— Rolle wählen —" />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-semibold">Kanal für das Panel</span>
                  <ChannelSelect id="verification.channelId" name="verification.channelId" channels={channels} defaultValue={verification.channelId} emptyLabel="— Kanal wählen —" />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-semibold">Art</span>
                  <select name="verification.mode" defaultValue={verification.mode} className="input">
                    <option value="button">Nur Button</option>
                    <option value="captcha">Button + Rechenaufgabe</option>
                  </select>
                </label>
              </div>
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">Titel</span>
                <input name="verification.title" defaultValue={verification.title} maxLength={100} className="input" />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">Text</span>
                <textarea name="verification.message" defaultValue={verification.message} maxLength={1500} rows={3} className="input" />
              </label>
              <p className="text-sm text-fog-500">
                Tipp: Gib <b>@everyone</b> in allen Kanälen außer dem Verifizierungs-Kanal kein „Kanal ansehen“-Recht, sondern nur der Mitglieder-Rolle.
              </p>
              <div>
                <ActionButton label="Panel jetzt in den Kanal senden" run={() => postVerifyPanel(guildId)} disabled={!canEdit} />
              </div>
            </div>
          </ToggleRow>
        </SectionCard>

        <SectionCard title="Account-Alter" description="Sehr neue Accounts sind oft Spam- oder Raid-Accounts.">
          <ToggleRow name="accountAge.enabled" label="Account-Alter prüfen" defaultChecked={accountAge.enabled}>
            <div className="flex flex-wrap gap-4">
              <NumberField name="accountAge.minDays" label="Mindestalter" defaultValue={accountAge.minDays} min={1} max={365} suffix="Tage" />
              <label className="grid gap-1 text-sm">
                <span className="text-fog-300">Maßnahme</span>
                <select name="accountAge.action" defaultValue={accountAge.action} className="input w-64">
                  <option value="alert">Nur im Alarm-Kanal melden</option>
                  <option value="timeout">Timeout (1 Tag) + melden</option>
                  <option value="kick">Kicken (mit freundlicher DM) + melden</option>
                </select>
              </label>
            </div>
          </ToggleRow>
        </SectionCard>

        <section className="rounded-2xl border border-ink-700 px-5 py-4 text-sm text-fog-500">
          <p className="font-semibold text-fog-300">Rechte, die der Bot braucht</p>
          <p className="mt-1">
            <b>Server verwalten</b> (Einladungen pausieren), <b>Audit-Log anzeigen</b> (Anti-Nuke), <b>Rollen verwalten</b>, <b>Mitglieder kicken/bannen</b>,{' '}
            <b>Mitglieder im Timeout</b>. Wichtig: Die Bot-Rolle muss <b>ganz oben</b> stehen, sonst kann er Angreifern keine Rollen entziehen.
          </p>
        </section>
      </fieldset>

      <div className="flex items-center gap-4">
        <button type="submit" className="btn-primary" disabled={!canEdit || pending}>
          {pending ? 'Speichere …' : 'Speichern'}
        </button>
        {state?.message && <p className={`text-sm ${state.ok ? 'text-sea-400' : 'text-danger-500'}`}>{state.message}</p>}
      </div>
    </form>
  );
}
