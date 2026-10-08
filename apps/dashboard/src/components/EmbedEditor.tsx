'use client';

import { useState } from 'react';
import { PREVIEW_CONTEXT, renderTemplate, TEMPLATE_VARIABLES, type MessageTemplate, type RenderedEmbed } from '@moin/shared';
import { ImageInput, imageSrc } from './ImageInput';

/**
 * Embed-Builder mit Live-Vorschau im Discord-Look. Der Zustand landet als JSON in einem
 * versteckten Feld (`name`), die Server-Action prüft ihn mit messageTemplateSchema.
 */
export function EmbedEditor({
  guildId,
  name,
  initial,
  imagePreview,
  hint,
}: {
  /** Server, für den Bilder hochgeladen werden */
  guildId: string;
  name: string;
  initial: MessageTemplate;
  /** z. B. Willkommensbild: wird in der Vorschau als großes Bild gezeigt */
  imagePreview?: React.ReactNode;
  hint?: string;
}) {
  const [t, setT] = useState<MessageTemplate>(initial);
  const e = t.embed;
  const set = (patch: Partial<MessageTemplate['embed']>) => setT({ ...t, embed: { ...e, ...patch } });
  const rendered = renderTemplate(t, { ...PREVIEW_CONTEXT });

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <input type="hidden" name={name} value={JSON.stringify(t)} />
      <div className="grid content-start gap-4">
        <label className="grid gap-1.5 text-sm">
          <span className="font-semibold">Text über dem Embed</span>
          <textarea value={t.content} maxLength={2000} rows={2} onChange={(ev) => setT({ ...t, content: ev.target.value })} className="input" />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={e.enabled} onChange={(ev) => set({ enabled: ev.target.checked })} className="size-4 accent-coral-500" />
          Embed anzeigen
        </label>
        {e.enabled && (
          <>
            <div className="grid grid-cols-[auto_1fr] items-end gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">Farbe</span>
                <input type="color" value={e.color} onChange={(ev) => set({ color: ev.target.value })} className="h-10 w-14 cursor-pointer rounded-lg border border-ink-600 bg-ink-850" />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">Titel</span>
                <input value={e.title} maxLength={256} onChange={(ev) => set({ title: ev.target.value })} className="input" />
              </label>
            </div>
            <label className="grid gap-1.5 text-sm">
              <span className="font-semibold">Beschreibung</span>
              <textarea value={e.description} maxLength={4096} rows={4} onChange={(ev) => set({ description: ev.target.value })} className="input" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">Kleines Bild</span>
                <select value={e.thumbnail} onChange={(ev) => set({ thumbnail: ev.target.value as typeof e.thumbnail })} className="input">
                  <option value="none">keins</option>
                  <option value="user">Profilbild des Mitglieds</option>
                  <option value="server">Server-Icon</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-semibold">Fußzeile</span>
                <input value={e.footer} maxLength={2048} onChange={(ev) => set({ footer: ev.target.value })} className="input" />
              </label>
            </div>
            {!imagePreview && <ImageInput guildId={guildId} label="Großes Bild (optional)" value={e.imageUrl} onChange={(imageUrl) => set({ imageUrl })} />}
            <div className="grid gap-2">
              <span className="text-sm font-semibold">Felder</span>
              {e.fields.map((f, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2">
                  <input value={f.name} placeholder="Name" maxLength={256} className="input" onChange={(ev) => set({ fields: e.fields.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)) })} />
                  <input value={f.value} placeholder="Wert" maxLength={1024} className="input" onChange={(ev) => set({ fields: e.fields.map((x, j) => (j === i ? { ...x, value: ev.target.value } : x)) })} />
                  <label className="flex items-center gap-1 text-xs text-fog-500">
                    <input type="checkbox" checked={f.inline} onChange={(ev) => set({ fields: e.fields.map((x, j) => (j === i ? { ...x, inline: ev.target.checked } : x)) })} />
                    nebeneinander
                  </label>
                  <button type="button" className="text-xs text-fog-500 hover:text-danger-500" onClick={() => set({ fields: e.fields.filter((_, j) => j !== i) })}>
                    ✕
                  </button>
                </div>
              ))}
              {e.fields.length < 10 && (
                <button type="button" className="btn-ghost w-fit px-3 py-1.5 text-xs" onClick={() => set({ fields: [...e.fields, { name: 'Feld', value: 'Inhalt', inline: false }] })}>
                  + Feld
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={e.timestamp} onChange={(ev) => set({ timestamp: ev.target.checked })} className="size-4 accent-coral-500" />
              Uhrzeit anzeigen
            </label>
          </>
        )}
        <p className="text-xs text-fog-500">
          Platzhalter:{' '}
          {TEMPLATE_VARIABLES.map((v) => (
            <code key={v.key} title={v.description} className="mr-1">
              {v.key}
            </code>
          ))}
          {hint && <span className="block pt-1">{hint}</span>}
        </p>
      </div>
      <DiscordPreview content={rendered.content} embed={rendered.embed} imagePreview={imagePreview} />
    </div>
  );
}

/** Discord-Nachricht nachgebaut (Dunkelmodus), nur für die Vorschau */
export function DiscordPreview({ content, embed, imagePreview, children }: { content: string; embed: RenderedEmbed | null; imagePreview?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[#313338] p-4 text-[15px] leading-snug text-[#dbdee1] xl:sticky xl:top-4" aria-label="Vorschau in Discord">
      <p className="mb-2 text-[11px] font-semibold tracking-wider text-[#949ba4] uppercase">Vorschau</p>
      <div className="flex gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-coral-500 font-bold text-ink-950">MJ</span>
        <div className="min-w-0 flex-1">
          <p>
            <span className="font-semibold text-coral-400">Moin_Julia</span>
            <span className="ml-1 rounded bg-[#5865f2] px-1 text-[10px] font-semibold text-white">APP</span>
            <span className="ml-2 text-xs text-[#949ba4]">Heute um 21:42 Uhr</span>
          </p>
          {content && <p className="whitespace-pre-wrap break-words">{formatMarkdown(content)}</p>}
          {(embed || imagePreview) && (
            <div className="mt-1.5 max-w-[432px] rounded border-l-4 bg-[#2b2d31] px-4 py-3" style={{ borderColor: embed ? `#${embed.color.toString(16).padStart(6, '0')}` : '#ff7a59' }}>
              <div className="flex gap-3">
                <div className="min-w-0 flex-1">
                  {embed?.title && <p className="mb-1 font-bold text-[#f2f3f5]">{formatMarkdown(embed.title)}</p>}
                  {embed?.description && <p className="text-sm whitespace-pre-wrap break-words">{formatMarkdown(embed.description)}</p>}
                  {embed?.fields && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                      {embed.fields.map((f, i) => (
                        <div key={i} className={f.inline ? 'min-w-[30%] flex-1' : 'w-full'}>
                          <p className="text-sm font-semibold text-[#f2f3f5]">{f.name}</p>
                          <p className="text-sm">{formatMarkdown(f.value)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {embed?.thumbnail && <span className="grid size-16 shrink-0 place-items-center rounded bg-[#34416f] text-xl font-bold">A</span>}
              </div>
              {imagePreview && <div className="mt-3">{imagePreview}</div>}
              {!imagePreview && embed?.image && (
                // eslint-disable-next-line @next/next/no-img-element -- Vorschau eigener bzw. verlinkter Bilder
                <img src={imageSrc(embed.image.url) ?? ''} alt="Bild im Embed" className="mt-3 max-h-72 rounded object-contain" />
              )}
              {(embed?.footer || embed?.timestamp) && (
                <p className="mt-2 text-xs text-[#b5bac1]">{[embed.footer?.text, embed.timestamp ? 'Heute um 21:42 Uhr' : null].filter(Boolean).join(' • ')}</p>
              )}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

/** Erwähnungen und **fett** grob wie in Discord darstellen */
function formatMarkdown(text: string): React.ReactNode[] {
  return text.split(/(<@\d+>|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (/^<@\d+>$/.test(part)) {
      return (
        <span key={i} className="rounded bg-[#5865f2]/30 px-0.5 text-[#c9cdfb]">
          @{PREVIEW_CONTEXT.userName}
        </span>
      );
    }
    if (/^\*\*[^*]+\*\*$/.test(part)) return <b key={i}>{part.slice(2, -2)}</b>;
    return part;
  });
}
