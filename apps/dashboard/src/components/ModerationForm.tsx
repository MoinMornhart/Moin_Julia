'use client';

import { KeepForm } from './KeepForm';
import { useActionState, useState } from 'react';
import type { AutomodAction, EscalationStep, ModerationConfig } from '@moin/shared';
import { saveModerationSettings } from '@/app/g/[guildId]/moderation/actions';
import type { ActionResult } from '@/app/g/[guildId]/actions';
import type { ChannelOption } from '@/lib/discord';
import { ChannelSelect } from './ChannelSelect';
import { ChipPicker, NumberField, SectionCard, ToggleRow } from './FormParts';

const ACTION_LABELS: Record<AutomodAction, string> = {
  delete: 'Nur löschen + Hinweis',
  delete_warn: 'Löschen + Verwarnung',
  delete_timeout: 'Löschen + Timeout',
};

const ESCALATION_LABELS = { timeout: 'Timeout', kick: 'Kick', ban: 'Bann' } as const;

export function ModerationForm({
  guildId,
  canEdit,
  config,
  channels,
  roles,
}: {
  guildId: string;
  canEdit: boolean;
  config: ModerationConfig;
  channels: ChannelOption[];
  roles: { id: string; name: string; color: number }[];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>((_p, form) => saveModerationSettings(guildId, form), null);
  const [steps, setSteps] = useState<(EscalationStep & { uid: number })[]>(() => config.escalation.map((s, uid) => ({ ...s, uid })));
  const [nextUid, setNextUid] = useState(config.escalation.length);
  const { automod } = config;
  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5).map((c) => ({ id: c.id, label: `# ${c.name}` }));

  return (
    <KeepForm action={action} className="grid max-w-4xl gap-6">
      <fieldset disabled={!canEdit || pending} className="grid gap-6">
        <SectionCard title="Allgemein">
          <div className="grid gap-2">
            <label htmlFor="modLogChannelId" className="font-semibold">
              Mod-Log-Kanal
            </label>
            <p className="text-sm text-fog-500">Jede Aktion erscheint hier als Fall-Karte mit Nummer. Auch die Alarme der Discord-AutoMod-Regeln landen hier.</p>
            <ChannelSelect id="modLogChannelId" name="modLogChannelId" channels={channels} defaultValue={config.modLogChannelId} emptyLabel="— kein Mod-Log —" className="max-w-md" />
          </div>
          <ToggleRow name="dmUsers" label="Betroffene per DM informieren" description="Mit Server-Name und Grund – bei Kick und Bann vor der Aktion." defaultChecked={config.dmUsers} />
          <ToggleRow name="requireReason" label="Grund ist Pflicht" description="Ohne Grund lehnt der Bot /warn, /kick usw. ab." defaultChecked={config.requireReason} />
          <NumberField name="warnExpiryDays" label="Verwarnungen verfallen nach (leer = nie)" defaultValue={config.warnExpiryDays} min={1} max={365} suffix="Tagen" placeholder="nie" />
        </SectionCard>

        <SectionCard
          title="Warn-Eskalation"
          description="Erreicht ein Mitglied genau so viele aktive Verwarnungen, handelt der Bot automatisch. Höchstens 5 Stufen."
        >
          <ul className="grid gap-3">
            {steps.map((step, i) => (
              <li key={step.uid} className="flex flex-wrap items-end gap-3 rounded-xl border border-ink-700 bg-ink-850 p-3">
                <label className="grid gap-1 text-sm">
                  <span className="text-fog-300">Bei</span>
                  <input type="number" name={`esc.${i}.warns`} defaultValue={step.warns} min={1} max={50} className="input w-20 tabular-nums" />
                </label>
                <span className="pb-3 text-sm text-fog-500">Verwarnungen →</span>
                <label className="grid gap-1 text-sm">
                  <span className="text-fog-300">Aktion</span>
                  <select
                    name={`esc.${i}.action`}
                    defaultValue={step.action}
                    className="input w-36"
                    onChange={(e) => setSteps(steps.map((s, j) => (j === i ? { ...s, action: e.target.value as EscalationStep['action'] } : s)))}
                  >
                    {Object.entries(ESCALATION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {step.action === 'timeout' && (
                  <NumberField name={`esc.${i}.duration`} label="Dauer" defaultValue={step.durationMin ?? 60} min={1} max={40320} suffix="Min." />
                )}
                <button type="button" className="btn-ghost ml-auto px-3 py-2 text-xs" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
          {steps.length < 5 && (
            <button
              type="button"
              className="btn-ghost w-fit"
              onClick={() => {
                setSteps([...steps, { warns: (steps.at(-1)?.warns ?? 0) + 2, action: 'timeout', durationMin: 60, uid: nextUid }]);
                setNextUid(nextUid + 1);
              }}
            >
              + Stufe hinzufügen
            </button>
          )}
        </SectionCard>

        <SectionCard
          title="Automod – Discord-Regeln"
          description="Diese Filter legt der Bot als Discord-eigene AutoMod-Regeln an. Sie wirken sofort beim Senden, auch wenn der Bot gerade offline ist."
        >
          <ToggleRow name="badWords.enabled" label="Schimpfwörter blockieren" defaultChecked={automod.badWords.enabled}>
            <textarea
              name="badWords.words"
              defaultValue={automod.badWords.words.join('\n')}
              rows={4}
              placeholder={'ein Wort pro Zeile\nWildcards: *wort* findet es auch in anderen Wörtern'}
              className="input font-mono text-xs"
            />
          </ToggleRow>
          <ToggleRow name="links.enabled" label="Links blockieren" description="Erlaubte Domains bleiben durchlässig." defaultChecked={automod.links.enabled}>
            <textarea
              name="links.allowDomains"
              defaultValue={automod.links.allowDomains.join('\n')}
              rows={3}
              placeholder={'youtube.com\ntwitch.tv\nkick.com'}
              className="input font-mono text-xs"
            />
          </ToggleRow>
          <ToggleRow name="invites.enabled" label="Discord-Einladungen blockieren" description="discord.gg/… und discord.com/invite/…" defaultChecked={automod.invites.enabled} />
          <ToggleRow name="mentionSpam.enabled" label="Massen-Erwähnungen blockieren" defaultChecked={automod.mentionSpam.enabled}>
            <NumberField name="mentionSpam.limit" label="Höchstens Erwähnungen pro Nachricht" defaultValue={automod.mentionSpam.limit} min={2} max={50} />
          </ToggleRow>
          <ToggleRow
            name="warnOnNativeHit"
            label="Treffer zählen als Verwarnung"
            description="Jede blockierte Nachricht erzeugt eine Verwarnung – damit greift auch die Eskalation."
            defaultChecked={automod.warnOnNativeHit}
          />
        </SectionCard>

        <SectionCard title="Automod – Bot-Prüfungen" description="Diese Prüfungen macht der Bot selbst. Mitglieder mit „Nachrichten verwalten“ sind immer ausgenommen.">
          <ToggleRow name="spam.enabled" label="Spam (zu viele Nachrichten in kurzer Zeit)" defaultChecked={automod.spam.enabled}>
            <div className="flex flex-wrap gap-4">
              <NumberField name="spam.maxMessages" label="Mehr als" defaultValue={automod.spam.maxMessages} min={3} max={30} suffix="Nachrichten" />
              <NumberField name="spam.perSeconds" label="in" defaultValue={automod.spam.perSeconds} min={2} max={60} suffix="Sekunden" />
              <ActionSelect name="spam.action" value={automod.spam.action} />
              <NumberField name="spam.timeoutMin" label="Timeout-Dauer" defaultValue={automod.spam.timeoutMin} min={1} max={1440} suffix="Min." />
            </div>
          </ToggleRow>
          <ToggleRow name="caps.enabled" label="Caps-Lock" defaultChecked={automod.caps.enabled}>
            <div className="flex flex-wrap gap-4">
              <NumberField name="caps.minLength" label="Ab Buchstaben" defaultValue={automod.caps.minLength} min={5} max={200} />
              <NumberField name="caps.percent" label="Anteil Großbuchstaben" defaultValue={automod.caps.percent} min={50} max={100} suffix="%" />
              <ActionSelect name="caps.action" value={automod.caps.action} />
            </div>
          </ToggleRow>
        </SectionCard>

        <SectionCard title="Ausnahmen" description="Gelten für alle Automod-Filter.">
          <div>
            <p className="mb-2 font-semibold">Rollen</p>
            <ChipPicker name="exemptRoleIds" options={roles.map((r) => ({ id: r.id, label: r.name, color: r.color }))} selected={automod.exemptRoleIds} />
          </div>
          <div>
            <p className="mb-2 font-semibold">Kanäle</p>
            <ChipPicker name="exemptChannelIds" options={textChannels} selected={automod.exemptChannelIds} />
          </div>
        </SectionCard>

        <section className="rounded-2xl border border-ink-700 px-5 py-4 text-sm text-fog-500">
          <p className="font-semibold text-fog-300">Rechte, die der Bot braucht</p>
          <p className="mt-1">
            <b>Mitglieder im Timeout</b>, <b>Mitglieder kicken</b>, <b>Mitglieder bannen</b>, <b>Nachrichten verwalten</b> und für die AutoMod-Regeln <b>Server verwalten</b>.
            Die Bot-Rolle muss <b>über</b> den Rollen der Mitglieder stehen, die moderiert werden sollen.
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

function ActionSelect({ name, value }: { name: string; value: AutomodAction }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-fog-300">Aktion</span>
      <select name={name} defaultValue={value} className="input w-52">
        {Object.entries(ACTION_LABELS).map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

