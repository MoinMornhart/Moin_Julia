'use client';

import { useActionState } from 'react';
import type { TicketsConfig } from '@moin/shared';
import { saveTicketsSettings } from '@/app/g/[guildId]/tickets/actions';
import type { ActionResult } from '@/app/g/[guildId]/actions';
import type { ChannelOption } from '@/lib/discord';
import { ChannelSelect } from './ChannelSelect';
import { ChipPicker, NumberField, SectionCard, ToggleRow } from './FormParts';
import { KeepForm } from './KeepForm';

/** Ticket-Einstellungen: Team, Kanäle, Limits, Abschluss (Transcript, Bewertung), automatisches Schließen */
export function TicketsForm({
  guildId,
  canEdit,
  config,
  channels,
  roles,
}: {
  guildId: string;
  canEdit: boolean;
  config: TicketsConfig;
  channels: ChannelOption[];
  roles: { id: string; name: string; color: number }[];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>((_p, form) => saveTicketsSettings(guildId, form), null);

  return (
    <KeepForm action={action} className="grid max-w-4xl gap-6">
      <fieldset disabled={!canEdit || pending} className="grid gap-6">
        <SectionCard title="Team" description="Diese Rollen sehen alle Tickets, können sie übernehmen und schließen. Wer „Server verwalten“ hat, darf das immer.">
          <ChipPicker name="teamRoleIds" options={roles.map((r) => ({ id: r.id, label: r.name, color: r.color }))} selected={config.teamRoleIds} />
          <ToggleRow name="pingTeam" label="Team beim Öffnen anpingen" defaultChecked={config.pingTeam} />
        </SectionCard>

        <SectionCard title="Kanäle" description="Wo entstehen Ticket-Kanäle und wohin gehen Log und Transcripts?">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Kategorie für Tickets</span>
              <ChannelSelect id="categoryId" name="categoryId" channels={channels} types={[4]} defaultValue={config.categoryId} emptyLabel="— ohne Kategorie —" />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Log-Kanal (Öffnen, Schließen, Transcripts)</span>
              <ChannelSelect id="logChannelId" name="logChannelId" channels={channels} defaultValue={config.logChannelId} emptyLabel="— kein Log —" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Kanalname</span>
              <input name="nameTemplate" defaultValue={config.nameTemplate} maxLength={90} className="input" />
              <span className="text-xs text-fog-500">{'{nr}'} = Ticket-Nummer, {'{user}'} = Name</span>
            </label>
            <NumberField name="maxOpenPerUser" label="Offene Tickets pro Person" defaultValue={config.maxOpenPerUser} min={1} max={10} />
          </div>
        </SectionCard>

        <SectionCard title="Begrüßung im Ticket" description="Steht oben im neuen Ticket, darunter die Antworten aus dem Formular.">
          <textarea name="welcomeText" defaultValue={config.welcomeText} maxLength={1000} rows={3} className="input" />
          <span className="text-xs text-fog-500">{'{user}'} = Person, {'{nr}'} = Ticket-Nummer</span>
        </SectionCard>

        <SectionCard title="Schließen" description="Was passiert, wenn ein Ticket geschlossen wird?">
          <ToggleRow name="transcriptDm" label="Transcript per DM an die Person" description="Der Verlauf als HTML-Datei – im Log-Kanal liegt er immer." defaultChecked={config.transcriptDm} />
          <ToggleRow name="feedback" label="Um Bewertung bitten (1–5 Sterne)" defaultChecked={config.feedback} />
          <NumberField name="deleteAfterSec" label="Kanal löschen nach" defaultValue={config.deleteAfterSec} min={0} max={300} suffix="Sekunden" />
          <ToggleRow name="autoClose.enabled" label="Inaktive Tickets automatisch schließen" defaultChecked={config.autoClose.enabled}>
            <NumberField name="autoClose.hours" label="Ohne neue Nachricht seit" defaultValue={config.autoClose.hours} min={1} max={720} suffix="Stunden" />
          </ToggleRow>
        </SectionCard>

        <section className="rounded-2xl border border-ink-700 px-5 py-4 text-sm text-fog-500">
          <p className="font-semibold text-fog-300">Befehle im Ticket</p>
          <p className="mt-1">
            <code>/ticket close [grund]</code> · <code>/ticket add @mitglied</code> · <code>/ticket remove @mitglied</code> – dazu die Knöpfe „Übernehmen“ und „Schließen“.
          </p>
        </section>
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
