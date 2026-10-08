'use client';

import { useActionState } from 'react';
import type { CommunityConfig } from '@moin/shared';
import { resetCounting, saveCommunitySettings } from '@/app/g/[guildId]/community/actions';
import type { ActionResult } from '@/app/g/[guildId]/actions';
import type { ChannelOption } from '@/lib/discord';
import { ActionButton } from './ActionButton';
import { ChannelSelect } from './ChannelSelect';
import { ChipPicker, NumberField, RoleSelect, SectionCard, ToggleRow } from './FormParts';
import { KeepForm } from './KeepForm';

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 accent-coral-500" />
      {label}
    </label>
  );
}

/** Community → Einstellungen: jede Funktion einzeln an/aus */
export function CommunityForm({
  guildId,
  canEdit,
  config,
  channels,
  roles,
  counting,
}: {
  guildId: string;
  canEdit: boolean;
  config: CommunityConfig;
  channels: ChannelOption[];
  roles: { id: string; name: string; color: number }[];
  counting: { current: number; record: number };
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>((_p, form) => saveCommunitySettings(guildId, form), null);
  const roleChips = roles.map((r) => ({ id: r.id, label: r.name, color: r.color }));
  const channelPick = (name: string, value: string, label = 'Kanal') => <ChannelSelect id={name} name={name} channels={channels} defaultValue={value || null} emptyLabel="— Kanal wählen —" className="max-w-md" label={label} />;

  return (
    <KeepForm action={action} className="grid max-w-4xl gap-6">
      <fieldset disabled={!canEdit || pending} className="grid gap-6">
        <SectionCard title="🎂 Geburtstage" description="Mitglieder tragen sich mit /geburtstag setzen ein (Jahr freiwillig). Platzhalter: {user} {name} {age} {server}">
          <ToggleRow name="birthdays.enabled" label="Geburtstage an" defaultChecked={config.birthdays.enabled}>
            <div className="grid gap-4">
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">Glückwünsche in</span>
                {channelPick('birthdays.channelId', config.birthdays.channelId)}
              </label>
              <div className="flex flex-wrap items-end gap-4">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-semibold">Geburtstagsrolle (für den ganzen Tag)</span>
                  <RoleSelect id="birthdays.roleId" name="birthdays.roleId" roles={roles} defaultValue={config.birthdays.roleId || null} emptyLabel="— keine —" />
                </label>
                <NumberField name="birthdays.hour" label="Uhrzeit" defaultValue={config.birthdays.hour} min={0} max={23} suffix="Uhr" />
              </div>
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">Text</span>
                <textarea name="birthdays.text" defaultValue={config.birthdays.text} maxLength={1000} rows={2} className="input" />
              </label>
            </div>
          </ToggleRow>
        </SectionCard>

        <SectionCard title="🔢 Zähl-Kanal" description={`Alle zählen gemeinsam hoch – jede Nachricht muss die nächste Zahl sein. Stand: ${counting.current} · Rekord: ${counting.record}`}>
          <ToggleRow name="counting.enabled" label="Zählen an" defaultChecked={config.counting.enabled}>
            <div className="grid gap-3">
              {channelPick('counting.channelId', config.counting.channelId, 'Zähl-Kanal')}
              <Check name="counting.resetOnFail" label="Bei Fehler wieder bei 1 anfangen" defaultChecked={config.counting.resetOnFail} />
              <Check name="counting.allowDouble" label="Dieselbe Person darf zweimal hintereinander zählen" defaultChecked={config.counting.allowDouble} />
              <Check name="counting.deleteWrong" label="Falsche Nachrichten und Text ohne Zahl löschen (statt ❌)" defaultChecked={config.counting.deleteWrong} />
              <div>
                <ActionButton label="Zähler auf 0 setzen" run={() => resetCounting(guildId)} disabled={!canEdit} />
              </div>
            </div>
          </ToggleRow>
        </SectionCard>

        <SectionCard title="💡 Vorschläge" description="Mitglieder schlagen mit /vorschlag etwas vor, alle stimmen mit 👍/👎 ab. Entschieden wird im Reiter „Vorschläge“.">
          <ToggleRow name="suggestions.enabled" label="Vorschläge an" defaultChecked={config.suggestions.enabled}>
            <div className="grid gap-3">
              {channelPick('suggestions.channelId', config.suggestions.channelId, 'Vorschlags-Kanal')}
              <Check name="suggestions.threads" label="Zu jedem Vorschlag einen Thread zum Diskutieren" defaultChecked={config.suggestions.threads} />
              <div className="grid gap-1.5 text-sm">
                <span className="font-semibold">Diese Rollen dürfen entscheiden (Admins immer)</span>
                <ChipPicker name="suggestions.staffRoleIds" options={roleChips} selected={config.suggestions.staffRoleIds} />
              </div>
            </div>
          </ToggleRow>
        </SectionCard>

        <SectionCard title="⭐ Starboard" description="Nachrichten mit genug Reaktionen landen im Starboard-Kanal – die Highlights des Servers.">
          <ToggleRow name="starboard.enabled" label="Starboard an" defaultChecked={config.starboard.enabled}>
            <div className="grid gap-4">
              {channelPick('starboard.channelId', config.starboard.channelId, 'Starboard-Kanal')}
              <div className="flex flex-wrap items-end gap-4">
                <label className="grid gap-1 text-sm">
                  <span className="text-fog-300">Emoji</span>
                  <input name="starboard.emoji" defaultValue={config.starboard.emoji} maxLength={60} className="input w-28 text-center" />
                </label>
                <NumberField name="starboard.threshold" label="Ab" defaultValue={config.starboard.threshold} min={1} max={100} suffix="Reaktionen" />
              </div>
              <Check name="starboard.selfStar" label="Eigene Reaktion zählt mit" defaultChecked={config.starboard.selfStar} />
              <div className="grid gap-1.5 text-sm">
                <span className="font-semibold">Diese Kanäle nicht ins Starboard</span>
                <ChipPicker
                  name="starboard.ignoredChannelIds"
                  options={channels.filter((c) => c.type === 0 || c.type === 5).map((c) => ({ id: c.id, label: `# ${c.name}` }))}
                  selected={config.starboard.ignoredChannelIds}
                />
              </div>
            </div>
          </ToggleRow>
        </SectionCard>

        <SectionCard title="🎉 Giveaways & 📊 Umfragen" description="Starten mit /giveaway start und /umfrage (oder Giveaways hier im Dashboard). Erlaubt für „Server verwalten“ und diese Rollen.">
          <ChipPicker name="managerRoleIds" options={roleChips} selected={config.managerRoleIds} />
          <p className="text-xs text-fog-500">/erinnerung kann jedes Mitglied nutzen – die Erinnerung kommt per DM.</p>
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
