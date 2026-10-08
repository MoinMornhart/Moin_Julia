'use client';

import { KeepForm } from './KeepForm';
import { useActionState, useState } from 'react';
import type { CardStyle, WillkommenConfig } from '@moin/shared';
import { saveWillkommenSettings } from '@/app/g/[guildId]/willkommen/actions';
import type { ActionResult } from '@/app/g/[guildId]/actions';
import type { ChannelOption } from '@/lib/discord';
import { ChannelSelect } from './ChannelSelect';
import { EmbedEditor } from './EmbedEditor';
import { ImageInput, imageSrc } from './ImageInput';
import { ChipPicker, SectionCard, ToggleRow } from './FormParts';

/** Farben wie im Bot (apps/bot/src/modules/willkommen/card.ts) */
const CARD_STYLES: Record<CardStyle, { label: string; from: string; to: string; accent: string; text: string; sub: string }> = {
  hafen: { label: 'Hafen bei Nacht', from: '#0d1326', to: '#1b2a5c', accent: '#ff7a59', text: '#eef1fb', sub: '#9aa4c7' },
  koralle: { label: 'Koralle', from: '#ff7a59', to: '#e9603f', accent: '#ffffff', text: '#ffffff', sub: '#fff1ec' },
  mint: { label: 'Mint', from: '#0f3b3a', to: '#2fd1b8', accent: '#ffffff', text: '#ffffff', sub: '#e0fbf6' },
  nacht: { label: 'Schwarz & Gold', from: '#05060a', to: '#1a1f2e', accent: '#ffc857', text: '#ffffff', sub: '#b9bfd3' },
};

function CardPreview({ style, headline, subline, background }: { style: CardStyle; headline: string; subline: string; background: string | null }) {
  const s = CARD_STYLES[style];
  return (
    <div
      className="relative flex aspect-[1024/400] w-full items-center gap-[5%] overflow-hidden rounded-md px-[8%]"
      style={{
        background: background
          ? `linear-gradient(rgba(6,9,20,.55), rgba(6,9,20,.55)), center / cover no-repeat url("${background.replace(/["\\\n]/g, '')}")`
          : `linear-gradient(135deg, ${s.from}, ${s.to})`,
      }}
      aria-label="Vorschau Willkommensbild"
    >
      <span
        className="grid aspect-square w-[22%] shrink-0 place-items-center rounded-full font-display text-[clamp(1rem,4vw,2.4rem)] font-extrabold"
        style={{ background: '#34416f', color: '#eef1fb', boxShadow: `0 0 0 4px ${s.accent}` }}
      >
        A
      </span>
      <div className="min-w-0 leading-tight">
        <p className="font-display text-[clamp(0.55rem,1.4vw,0.85rem)] font-extrabold tracking-[0.2em] uppercase" style={{ color: s.accent }}>
          {headline || 'WILLKOMMEN'}
        </p>
        <p className="font-display text-[clamp(1rem,3.4vw,2.2rem)] font-extrabold" style={{ color: s.text }}>
          Anna
        </p>
        <p className="text-[clamp(0.55rem,1.4vw,0.9rem)] font-semibold" style={{ color: s.sub }}>
          {(subline || '').replace('{memberCount}', '1.284')}
        </p>
      </div>
    </div>
  );
}

export function WillkommenForm({
  guildId,
  canEdit,
  config,
  channels,
  roles,
}: {
  guildId: string;
  canEdit: boolean;
  config: WillkommenConfig;
  channels: ChannelOption[];
  roles: { id: string; name: string; color: number }[];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>((_p, form) => saveWillkommenSettings(guildId, form), null);
  const [card, setCard] = useState(config.welcome.card);
  const roleOptions = roles.map((r) => ({ id: r.id, label: r.name, color: r.color }));

  return (
    <KeepForm action={action} className="grid max-w-6xl gap-6">
      <fieldset disabled={!canEdit || pending} className="grid gap-6">
        <SectionCard title="Willkommensnachricht" description="Wird gesendet, sobald jemand dem Server beitritt.">
          <ToggleRow name="welcome.enabled" label="Willkommensnachricht senden" defaultChecked={config.welcome.enabled} />
          <label className="grid max-w-md gap-1.5 text-sm">
            <span className="font-semibold">Kanal</span>
            <ChannelSelect id="welcome.channelId" name="welcome.channelId" channels={channels} defaultValue={config.welcome.channelId} emptyLabel="— Kanal wählen —" />
          </label>
          <div className="grid gap-4 rounded-xl border border-ink-700 p-4">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                name="card.enabled"
                checked={card.enabled}
                onChange={(e) => setCard({ ...card, enabled: e.target.checked })}
                className="size-4 accent-coral-500"
              />
              Willkommensbild mit Profilbild anhängen
            </label>
            {card.enabled && (
              <div className="grid items-start gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  <span className="font-semibold">Stil</span>
                  <select name="card.style" value={card.style} onChange={(e) => setCard({ ...card, style: e.target.value as CardStyle })} className="input">
                    {Object.entries(CARD_STYLES).map(([key, s]) => (
                      <option key={key} value={key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <ImageInput
                  guildId={guildId}
                  name="card.backgroundUrl"
                  label="Eigenes Hintergrundbild (optional, wird abgedunkelt)"
                  value={card.backgroundUrl}
                  onChange={(backgroundUrl) => setCard({ ...card, backgroundUrl })}
                />
                <label className="grid gap-1.5 text-sm">
                  <span className="font-semibold">Überschrift</span>
                  <input name="card.headline" value={card.headline} maxLength={40} onChange={(e) => setCard({ ...card, headline: e.target.value })} className="input" />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-semibold">Unterzeile</span>
                  <input name="card.subline" value={card.subline} maxLength={60} onChange={(e) => setCard({ ...card, subline: e.target.value })} className="input" />
                </label>
              </div>
            )}
            {!card.enabled && (
              <>
                <input type="hidden" name="card.style" value={card.style} />
                <input type="hidden" name="card.headline" value={card.headline} />
                <input type="hidden" name="card.subline" value={card.subline} />
                <input type="hidden" name="card.backgroundUrl" value={card.backgroundUrl} />
              </>
            )}
          </div>
          <EmbedEditor
            guildId={guildId}
            name="welcome.template"
            initial={config.welcome.template}
            imagePreview={card.enabled ? <CardPreview style={card.style} headline={card.headline} subline={card.subline} background={imageSrc(card.backgroundUrl)} /> : undefined}
            hint="Das Willkommensbild erscheint unten im Embed."
          />
        </SectionCard>

        <SectionCard title="Abschiedsnachricht" description="Wenn jemand den Server verlässt (Bots ausgenommen).">
          <ToggleRow name="leave.enabled" label="Abschiedsnachricht senden" defaultChecked={config.leave.enabled} />
          <label className="grid max-w-md gap-1.5 text-sm">
            <span className="font-semibold">Kanal</span>
            <ChannelSelect id="leave.channelId" name="leave.channelId" channels={channels} defaultValue={config.leave.channelId} emptyLabel="— Kanal wählen —" />
          </label>
          <EmbedEditor guildId={guildId} name="leave.template" initial={config.leave.template} />
        </SectionCard>

        <SectionCard title="Private Nachricht" description="Optional zusätzlich eine DM an neue Mitglieder (nicht jeder hat DMs offen).">
          <ToggleRow name="dm.enabled" label="DM senden" defaultChecked={config.dm.enabled} />
          <EmbedEditor guildId={guildId} name="dm.template" initial={config.dm.template} />
        </SectionCard>

        <SectionCard title="Auto-Rollen" description="Rollen, die beim Beitritt automatisch vergeben werden.">
          <div>
            <p className="mb-2 font-semibold">Für Menschen</p>
            <ChipPicker name="autoRoles.humans" options={roleOptions} selected={config.autoRoles.humans} empty="Keine Rollen gefunden." />
          </div>
          <div>
            <p className="mb-2 font-semibold">Für Bots</p>
            <ChipPicker name="autoRoles.bots" options={roleOptions} selected={config.autoRoles.bots} empty="Keine Rollen gefunden." />
          </div>
          <p className="text-sm text-fog-500">
            Nutzt du die Verifizierung (Server-Schutz), vergib die Mitglieder-Rolle dort statt hier – sonst ist die Verifizierung wirkungslos.
          </p>
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
