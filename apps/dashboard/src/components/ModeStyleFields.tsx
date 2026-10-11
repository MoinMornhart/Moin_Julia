'use client';

import { useState } from 'react';
import { STYLE_ADDRESS, STYLE_EMOJIS, STYLE_FLIRTY, STYLE_LABELS, STYLE_LANGUAGES, STYLE_TONES, type ModeStyle } from '@moin/shared';

/** Anrede, Emojis, Tonfall, Sprache, Flirt-Ton, Begrüßung – für einen Modus oder die Standard-Julia */
export function ModeStyleFields({ value, onChange, label }: { value: ModeStyle; onChange: (style: ModeStyle) => void; label: string }) {
  const set = (patch: Partial<ModeStyle>) => onChange({ ...value, ...patch });
  const select = <K extends 'address' | 'emojis' | 'tone' | 'language' | 'flirty'>(key: K, title: string, options: readonly ModeStyle[K][]) => (
    <label className="grid gap-1.5">
      <span className="text-fog-300">{title}</span>
      <select aria-label={`${title} (${label})`} value={value[key]} onChange={(e) => set({ [key]: e.target.value } as Partial<ModeStyle>)} className="input">
        {options.map((o) => (
          <option key={o} value={o}>
            {(STYLE_LABELS[key] as Record<string, string>)[o]}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {select('address', 'Anrede', STYLE_ADDRESS)}
        {select('emojis', 'Emojis', STYLE_EMOJIS)}
        {select('tone', 'Tonfall', STYLE_TONES)}
        {select('language', 'Sprache', STYLE_LANGUAGES)}
        {select('flirty', 'Flirt-Ton', STYLE_FLIRTY)}
      </div>
      <label className="grid gap-1.5">
        <span className="text-fog-300">Begrüßung beim Umschalten (optional)</span>
        <input aria-label={`Begrüßung (${label})`} value={value.greeting} maxLength={300} onChange={(e) => set({ greeting: e.target.value })} placeholder="z. B. Ahoi, Landratten! Käpt’n Rainer übernimmt das Ruder." className="input" />
      </label>
    </div>
  );
}

/** Für das Julia-Formular: Stil der Standard-Julia als verstecktes JSON-Feld „defaultStyle“ */
export function DefaultStyleField({ initial }: { initial: ModeStyle }) {
  const [style, setStyle] = useState(initial);
  return (
    <>
      <input type="hidden" name="defaultStyle" value={JSON.stringify(style)} />
      <ModeStyleFields value={style} onChange={setStyle} label="Standard-Julia" />
    </>
  );
}
