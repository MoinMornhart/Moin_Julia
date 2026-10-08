'use client';

import { useActionState, useState } from 'react';
import type { TempVoiceConfig } from '@moin/shared';
import { createHub, saveTempVoiceSettings } from '@/app/g/[guildId]/tempvoice/actions';
import type { ActionResult } from '@/app/g/[guildId]/actions';
import type { ChannelOption } from '@/lib/discord';
import { ActionButton } from './ActionButton';
import { ChannelSelect } from './ChannelSelect';
import { ChipPicker, NumberField, SectionCard, ToggleRow } from './FormParts';
import { KeepForm } from './KeepForm';

type HubRow = TempVoiceConfig['hubs'][number] & { uid: number };

/** Einstellungen „Eigene Sprachkanäle“: Erstell-Kanäle, Bedienfeld, Aufräumen, Besitzer-Rollen */
export function TempVoiceForm({
  guildId,
  canEdit,
  config,
  channels,
  roles,
}: {
  guildId: string;
  canEdit: boolean;
  config: TempVoiceConfig;
  channels: ChannelOption[];
  roles: { id: string; name: string; color: number }[];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>((_p, form) => saveTempVoiceSettings(guildId, form), null);
  const [hubs, setHubs] = useState<HubRow[]>(config.hubs.map((h, i) => ({ ...h, uid: i })));
  const [nextUid, setNextUid] = useState(config.hubs.length);
  const voice = channels.filter((c) => c.type === 2);

  return (
    <KeepForm action={action} className="grid max-w-4xl gap-6">
      <fieldset disabled={!canEdit || pending} className="grid gap-6">
        <SectionCard
          title="Erstell-Kanäle"
          description="Wer einem dieser Sprachkanäle beitritt, bekommt sofort einen eigenen Kanal und wird hineinverschoben."
        >
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-700 bg-ink-850 p-4 text-sm">
            <span className="flex-1 text-fog-300">
              Noch keinen? Der Bot legt die Kategorie „🎙️ Eigene Sprachkanäle“ mit „➕ Kanal erstellen“ für dich an.
            </span>
            <ActionButton label="Automatisch anlegen" run={() => createHub(guildId)} disabled={!canEdit} />
          </div>
          {hubs.length === 0 && <p className="text-sm text-fog-500">Noch kein Erstell-Kanal eingetragen.</p>}
          {hubs.map((h, i) => (
            <div key={h.uid} className="grid gap-3 rounded-xl border border-ink-700 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-semibold">Erstell-Kanal (Sprachkanal)</span>
                  <ChannelSelect id={`hub.${i}.channelId`} name={`hub.${i}.channelId`} channels={channels} types={[2]} defaultValue={h.channelId} emptyLabel="— Sprachkanal wählen —" />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-semibold">Neue Kanäle in Kategorie</span>
                  <ChannelSelect id={`hub.${i}.categoryId`} name={`hub.${i}.categoryId`} channels={channels} types={[4]} defaultValue={h.categoryId} emptyLabel="— wie der Erstell-Kanal —" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-semibold">Name neuer Kanäle</span>
                  <input name={`hub.${i}.nameTemplate`} defaultValue={h.nameTemplate} maxLength={90} className="input" />
                  <span className="text-xs text-fog-500">{'{user}'} = Name der Person, {'{count}'} = laufende Nummer</span>
                </label>
                <NumberField name={`hub.${i}.userLimit`} label="Limit (0 = keins)" defaultValue={h.userLimit} min={0} max={99} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={`hub.${i}.startLocked`} defaultChecked={h.startLocked} className="size-4 accent-coral-500" />
                  Neue Kanäle starten gesperrt (nur Eingeladene kommen rein)
                </label>
                <button type="button" className="text-sm text-fog-500 hover:text-danger-500" onClick={() => setHubs(hubs.filter((x) => x.uid !== h.uid))}>
                  Entfernen
                </button>
              </div>
            </div>
          ))}
          {hubs.length < 5 && (
            <button
              type="button"
              className="btn-ghost w-fit"
              disabled={!voice.length}
              onClick={() => {
                setHubs([...hubs, { uid: nextUid, channelId: voice[0]?.id ?? '', categoryId: null, nameTemplate: '🔊 {user}s Kanal', userLimit: 0, startLocked: false }]);
                setNextUid(nextUid + 1);
              }}
            >
              + Erstell-Kanal
            </button>
          )}
        </SectionCard>

        <SectionCard title="Bedienfeld & Aufräumen" description="So steuern Leute ihren Kanal – und so verschwinden leere Kanäle.">
          <ToggleRow
            name="panel"
            label="Bedienfeld in den Kanal senden"
            description="Knöpfe für Name, Limit, Sperren, Verstecken, Einladen, Rauswerfen, Übergeben und Übernehmen – im Text-Chat des Sprachkanals."
            defaultChecked={config.panel}
          />
          <NumberField name="deleteAfterSec" label="Leere Kanäle löschen nach" defaultValue={config.deleteAfterSec} min={0} max={300} suffix="Sekunden" />
        </SectionCard>

        <SectionCard title="Besitzer-Rollen" description="Rollen, die man bekommt, solange man einen eigenen Kanal besitzt – und automatisch wieder verliert.">
          <ChipPicker name="ownerRoleIds" options={roles.map((r) => ({ id: r.id, label: r.name, color: r.color }))} selected={config.ownerRoleIds} />
        </SectionCard>

        <section className="rounded-2xl border border-ink-700 px-5 py-4 text-sm text-fog-500">
          <p className="font-semibold text-fog-300">Rechte, die der Bot braucht</p>
          <p className="mt-1">
            <b>Kanäle verwalten</b>, <b>Mitglieder verschieben</b> und – für Besitzer-Rollen – <b>Rollen verwalten</b> (Bot-Rolle über diesen Rollen).
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
