'use client';

import { useActionState } from 'react';
import type { TeamConfig } from '@moin/shared';
import { saveTeamSettings, sendApplyPanel } from '@/app/g/[guildId]/team/actions';
import type { ActionResult } from '@/app/g/[guildId]/actions';
import type { ChannelOption } from '@/lib/discord';
import { ActionButton } from './ActionButton';
import { ChannelSelect } from './ChannelSelect';
import { ChipPicker, NumberField, RoleSelect, SectionCard } from './FormParts';
import { KeepForm } from './KeepForm';

/** Teams → Einstellungen: Log, Prüfer-Rollen, Probezeit, Panel, DM-Texte */
export function TeamSettingsForm({
  guildId,
  canEdit,
  config,
  channels,
  roles,
}: {
  guildId: string;
  canEdit: boolean;
  config: TeamConfig;
  channels: ChannelOption[];
  roles: { id: string; name: string; color: number }[];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>((_p, form) => saveTeamSettings(guildId, form), null);

  return (
    <KeepForm action={action} className="grid max-w-4xl gap-6">
      <fieldset disabled={!canEdit || pending} className="grid gap-6">
        <SectionCard title="Log & Prüfer" description="Wohin meldet der Bot neue Bewerbungen – und wer darf sie bearbeiten?">
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Log-Kanal (neue Bewerbungen, Entscheidungen, Erinnerungen)</span>
            <ChannelSelect id="logChannelId" name="logChannelId" channels={channels} defaultValue={config.logChannelId} emptyLabel="— kein Log —" className="max-w-md" />
          </label>
          <div className="grid gap-1.5 text-sm">
            <span className="font-semibold">Prüfer-Rollen</span>
            <span className="text-xs text-fog-500">Diese Rollen dürfen im Dashboard Bewerbungen bearbeiten (Admins dürfen das immer).</span>
            <ChipPicker name="reviewerRoleIds" options={roles.map((r) => ({ id: r.id, label: r.name, color: r.color }))} selected={config.reviewerRoleIds} />
          </div>
        </SectionCard>

        <SectionCard title="Probezeit" description="Wird pro Stelle eingeschaltet (Tage > 0).">
          <div className="flex flex-wrap items-end gap-4">
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Rolle während der Probezeit</span>
              <RoleSelect id="probationRoleId" name="probationRoleId" roles={roles} defaultValue={config.probationRoleId} emptyLabel="— keine —" />
            </label>
            <NumberField name="probationReminderDays" label="Erinnern" defaultValue={config.probationReminderDays} min={0} max={60} suffix="Tage vor Ende" />
          </div>
        </SectionCard>

        <SectionCard title="„Jetzt bewerben“-Panel" description="Eine Nachricht in Discord mit Knopf zur Bewerbungsseite.">
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Kanal</span>
            <ChannelSelect id="panelChannelId" name="panelChannelId" channels={channels} defaultValue={config.panelChannelId} emptyLabel="— Kanal wählen —" className="max-w-md" />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Text</span>
            <textarea name="panelText" defaultValue={config.panelText} maxLength={1500} rows={2} className="input" />
          </label>
          <div>
            <ActionButton label="Panel in den Kanal senden" run={() => sendApplyPanel(guildId)} disabled={!canEdit} />
          </div>
        </SectionCard>

        <SectionCard title="Nachrichten an Bewerber:innen (DM)" description="Platzhalter: {user} {position} {server} – bei Absage zusätzlich {reason}.">
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Bei Annahme</span>
            <textarea name="acceptText" defaultValue={config.acceptText} maxLength={1500} rows={3} className="input" />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">Bei Absage</span>
            <textarea name="rejectText" defaultValue={config.rejectText} maxLength={1500} rows={3} className="input" />
          </label>
        </SectionCard>
      </fieldset>

      <div className="flex items-center gap-4">
        <button type="submit" className="btn-primary" disabled={!canEdit || pending}>
          {pending ? 'Speichere …' : 'Speichern'}
        </button>
        {state?.message && <p className={`text-sm ${state.ok ? 'text-sea-400' : 'text-danger-500'}`}>{state.message}</p>}
      </div>
    </KeepForm>
  );
}
