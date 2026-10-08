'use client';

import { KeepForm } from './KeepForm';
import { useActionState } from 'react';
import { LOG_CATEGORIES, LOG_CATEGORY_INFO, type LoggingConfig } from '@moin/shared';
import { saveLoggingSettings } from '@/app/g/[guildId]/logging/actions';
import type { ActionResult } from '@/app/g/[guildId]/actions';
import type { ChannelOption } from '@/lib/discord';
import { ChannelSelect } from './ChannelSelect';
import { Switch } from './Switch';

export function LoggingForm({
  guildId,
  canEdit,
  config,
  channels,
}: {
  guildId: string;
  canEdit: boolean;
  config: LoggingConfig;
  channels: ChannelOption[];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    (_prev, form) => saveLoggingSettings(guildId, form),
    null,
  );
  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5);

  return (
    <KeepForm action={action} className="grid max-w-4xl gap-6">
      <fieldset disabled={!canEdit || pending} className="grid gap-6">
        <section className="card grid gap-3 p-6">
          <label htmlFor="defaultChannelId" className="font-display text-lg font-semibold">
            Standard-Log-Kanal
          </label>
          <p className="text-sm text-fog-500">
            Hierhin geht alles, was keinen eigenen Kanal hat. Tipp: einen Kanal nur für das Team anlegen, z. B. <code>#mod-log</code>.
          </p>
          <ChannelSelect
            id="defaultChannelId"
            name="defaultChannelId"
            channels={channels}
            defaultValue={config.defaultChannelId}
            emptyLabel="— kein Standard-Kanal —"
            className="max-w-md"
            label="Standard-Kanal"
          />
        </section>

        <section className="card p-6">
          <h2 className="font-display text-lg font-semibold">Was wird geloggt?</h2>
          <p className="mt-1 mb-4 text-sm text-fog-500">Jede Kategorie einzeln schalten und bei Bedarf in einen eigenen Kanal leiten.</p>
          <ul className="divide-y divide-ink-700">
            {LOG_CATEGORIES.map((category) => {
              const info = LOG_CATEGORY_INFO[category];
              const entry = config.categories[category];
              return (
                <li key={category} className="grid gap-3 py-4 sm:grid-cols-[1fr_16rem] sm:items-center">
                  <div className="flex items-start gap-3">
                    <Switch id={`cat.${category}.enabled`} name={`cat.${category}.enabled`} defaultChecked={entry.enabled} label={info.name.de} />
                    <div>
                      <label htmlFor={`cat.${category}.enabled`} className="font-semibold">
                        <span aria-hidden>{info.icon}</span> {info.name.de}
                      </label>
                      <p className="text-sm text-fog-500">{info.description.de}</p>
                    </div>
                  </div>
                  <ChannelSelect
                    id={`cat.${category}.channelId`}
                    name={`cat.${category}.channelId`}
                    channels={channels}
                    defaultValue={entry.channelId}
                    emptyLabel="Standard-Kanal"
                    label={`Kanal für ${info.name.de}`}
                  />
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card grid gap-5 p-6">
          <h2 className="font-display text-lg font-semibold">Ausnahmen</h2>
          <div className="flex items-start gap-3">
            <Switch id="ignoreBots" name="ignoreBots" defaultChecked={config.ignoreBots} label="Bots ignorieren" />
            <div>
              <label htmlFor="ignoreBots" className="font-semibold">
                Nachrichten von Bots ignorieren
              </label>
              <p className="text-sm text-fog-500">Empfohlen – sonst landen z. B. gelöschte Bot-Antworten im Log.</p>
            </div>
          </div>
          <div>
            <p className="font-semibold">Diese Kanäle nicht loggen (nur Nachrichten)</p>
            <p className="mb-3 text-sm text-fog-500">Zum Beispiel Spam- oder Bot-Kanäle. Log-Kanäle selbst werden automatisch ausgelassen.</p>
            <div className="flex flex-wrap gap-2">
              {textChannels.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-ink-600 bg-ink-850 px-3 py-1.5 text-sm has-checked:border-coral-500 has-checked:bg-coral-500/15"
                >
                  <input
                    type="checkbox"
                    name="ignoredChannelIds"
                    value={c.id}
                    defaultChecked={config.ignoredChannelIds.includes(c.id)}
                    className="sr-only"
                  />
                  # {c.name}
                </label>
              ))}
              {textChannels.length === 0 && <p className="text-sm text-fog-500">Keine Kanäle gefunden.</p>}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-ink-700 px-5 py-4 text-sm text-fog-500">
          <p className="font-semibold text-fog-300">Rechte, die der Bot braucht</p>
          <p className="mt-1">
            In den Log-Kanälen: <b>Kanal ansehen</b>, <b>Nachrichten senden</b>, <b>Links einbetten</b>, <b>Dateien anhängen</b>. Für die
            Angabe „Durch …“ zusätzlich <b>Audit-Log anzeigen</b>. Im Developer Portal müssen die Intents <b>Server Members</b> und{' '}
            <b>Message Content</b> an sein.
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
