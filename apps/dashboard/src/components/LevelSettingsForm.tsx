'use client';

import { useActionState, useState } from 'react';
import { CARD_STYLES as STYLE_IDS, LEVEL_PLACEHOLDERS, LEVEL_UP_MODE_LABELS, LEVEL_UP_MODES, type CardStyle, type LevelConfig } from '@moin/shared';
import { saveLevelSettings } from '@/app/g/[guildId]/level/actions';
import type { ActionResult } from '@/app/g/[guildId]/actions';
import type { ChannelOption } from '@/lib/discord';
import { ChannelSelect } from './ChannelSelect';
import { ChipPicker, NumberField, SectionCard, ToggleRow } from './FormParts';
import { KeepForm } from './KeepForm';
import { CARD_STYLES } from './WillkommenForm';

/** Vorschau der Rangkarte (/rang) in HTML – Farben wie im Bot */
function RankPreview({ style }: { style: CardStyle }) {
  const s = CARD_STYLES[style];
  return (
    <div className="flex items-center gap-4 rounded-2xl p-4 sm:gap-5 sm:p-5" style={{ background: `linear-gradient(135deg, ${s.from}, ${s.to})` }}>
      <span className="grid size-16 shrink-0 place-items-center rounded-full font-display text-2xl font-bold sm:size-20" style={{ background: '#34416f', color: '#eef1fb', boxShadow: `0 0 0 4px ${s.accent}` }}>
        K
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="truncate font-display text-lg font-bold sm:text-xl" style={{ color: s.text }}>
            Kapitänin Julia
          </span>
          <span className="font-display text-lg font-bold sm:text-xl" style={{ color: s.accent }}>
            <span className="mr-2 text-sm font-semibold" style={{ color: s.sub }}>
              Platz #3
            </span>
            Level 12
          </span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.14)' }}>
          <div className="h-full w-[64%] rounded-full" style={{ background: s.accent }} />
        </div>
        <p className="mt-1.5 text-xs" style={{ color: s.sub }}>
          640 / 1.000 XP
        </p>
      </div>
    </div>
  );
}

export function LevelSettingsForm({
  guildId,
  canEdit,
  config,
  channels,
  roles,
}: {
  guildId: string;
  canEdit: boolean;
  config: LevelConfig;
  channels: ChannelOption[];
  roles: { id: string; name: string; color: number }[];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>((_p, form) => saveLevelSettings(guildId, form), null);
  const [mode, setMode] = useState(config.levelUpMode);
  const [style, setStyle] = useState<CardStyle>(config.cardStyle);

  return (
    <KeepForm action={action} className="grid max-w-4xl gap-6">
      <fieldset disabled={!canEdit || pending} className="grid gap-6">
        <SectionCard title="XP sammeln" description="Kurve wie bei MEE6: Level 1 = 100 XP, Level 5 ≈ 1.150 XP, Level 10 ≈ 4.675 XP.">
          <ToggleRow name="textXp" label="XP für Nachrichten" description="Pro Nachricht zufällig zwischen Minimum und Maximum – höchstens einmal pro Abklingzeit." defaultChecked={config.textXp}>
            <div className="flex flex-wrap gap-4">
              <NumberField name="textXpMin" label="Minimum" defaultValue={config.textXpMin} min={0} max={500} suffix="XP" />
              <NumberField name="textXpMax" label="Maximum" defaultValue={config.textXpMax} min={0} max={500} suffix="XP" />
              <NumberField name="cooldownSeconds" label="Abklingzeit" defaultValue={config.cooldownSeconds} min={0} max={3600} suffix="Sekunden" />
            </div>
          </ToggleRow>
          <ToggleRow name="voiceXp" label="XP im Sprachkanal" description="Jede Minute im Sprachkanal (nicht im AFK-Kanal)." defaultChecked={config.voiceXp}>
            <div className="grid gap-3">
              <NumberField name="voiceXpPerMinute" label="Pro Minute" defaultValue={config.voiceXpPerMinute} min={0} max={100} suffix="XP" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="voiceNeedsCompany" defaultChecked={config.voiceNeedsCompany} className="size-4 accent-coral-500" />
                Nur mit Gesellschaft (mindestens 2 Personen, nicht taub gestellt) – gegen AFK-Farmen
              </label>
            </div>
          </ToggleRow>
        </SectionCard>

        <SectionCard title="Ausnahmen" description="Hier gibt es keine XP. Kategorien zählen für alle Kanäle darin.">
          <div className="grid gap-1.5 text-sm">
            <span className="font-semibold">Kanäle und Kategorien</span>
            <ChipPicker
              name="ignoredChannelIds"
              options={channels.filter((c) => [0, 2, 4, 5, 13, 15].includes(c.type)).map((c) => ({ id: c.id, label: `${c.type === 4 ? '📁' : c.type === 2 || c.type === 13 ? '🔊' : '#'} ${c.name}` }))}
              selected={config.ignoredChannelIds}
            />
          </div>
          <div className="grid gap-1.5 text-sm">
            <span className="font-semibold">Rollen</span>
            <ChipPicker name="ignoredRoleIds" options={roles.map((r) => ({ id: r.id, label: r.name, color: r.color }))} selected={config.ignoredRoleIds} />
          </div>
        </SectionCard>

        <SectionCard title="Level-up-Meldung" description={`Platzhalter: ${LEVEL_PLACEHOLDERS.join(' ')}`}>
          <div className="flex flex-wrap items-end gap-4">
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Wo?</span>
              <select name="levelUpMode" value={mode} onChange={(e) => setMode(e.target.value as LevelConfig['levelUpMode'])} className="input">
                {LEVEL_UP_MODES.map((m) => (
                  <option key={m} value={m}>
                    {LEVEL_UP_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            {mode === 'channel' && (
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">Kanal</span>
                <ChannelSelect id="levelUpChannelId" name="levelUpChannelId" channels={channels} defaultValue={config.levelUpChannelId || null} emptyLabel="— Kanal wählen —" className="max-w-xs" />
              </label>
            )}
          </div>
          {mode !== 'off' && (
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Text</span>
              <textarea name="levelUpText" defaultValue={config.levelUpText} maxLength={1000} rows={2} className="input" />
            </label>
          )}
        </SectionCard>

        <SectionCard title="Rangkarte & Bestenliste" description="/rang zeigt diese Karte, /bestenliste die Top 10.">
          <div className="flex flex-wrap gap-2">
            {STYLE_IDS.map((id) => (
              <label key={id} className="flex cursor-pointer items-center gap-2 rounded-full border border-ink-600 px-3 py-1.5 text-sm has-checked:border-coral-500 has-checked:bg-coral-500/15">
                <input type="radio" name="cardStyle" value={id} checked={style === id} onChange={() => setStyle(id)} className="sr-only" />
                <span className="size-3 rounded-full" style={{ background: `linear-gradient(135deg, ${CARD_STYLES[id].from}, ${CARD_STYLES[id].to})` }} />
                {CARD_STYLES[id].label}
              </label>
            ))}
          </div>
          <RankPreview style={style} />
          <ToggleRow
            name="publicLeaderboard"
            label="Öffentliche Rangliste"
            description="Jeder mit dem Link sieht die Top 100 (Name, Bild, Level) – ohne Anmeldung. Aus: nur im Dashboard."
            defaultChecked={config.publicLeaderboard}
          />
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
