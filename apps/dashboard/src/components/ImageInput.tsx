'use client';

import { useRef, useState } from 'react';
import { UPLOAD_MAX_BYTES, UPLOAD_PREFIX, uploadIdOf } from '@moin/shared';

/** Vorschau-Adresse für eine Bildquelle (hochgeladen oder https) */
export function imageSrc(value: string): string | null {
  const id = uploadIdOf(value);
  if (id) return `/api/uploads/${id}`;
  return value.startsWith('https://') ? value : null;
}

/**
 * Bild auswählen: vom PC hochladen oder https-Link einfügen.
 * Hochgeladene Bilder werden als „upload:<id>“ gespeichert; der Bot hängt sie beim Senden selbst an.
 */
export function ImageInput({
  guildId,
  value,
  onChange,
  name,
  label,
  disabled = false,
}: {
  guildId: string;
  value: string;
  onChange: (value: string) => void;
  /** Name für ein verstecktes Formularfeld (bei klassischen Formularen) */
  name?: string;
  label: string;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploaded = value.startsWith(UPLOAD_PREFIX);
  const src = imageSrc(value);

  async function upload(file: File) {
    setError(null);
    if (file.size > UPLOAD_MAX_BYTES) {
      setError('Das Bild ist zu groß (max. 8 MB).');
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set('guildId', guildId);
      body.set('file', file);
      const res = await fetch('/api/uploads', { method: 'POST', body });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; ref?: string; error?: string };
      if (data.ok && data.ref) onChange(data.ref);
      else setError(data.error ?? 'Hochladen fehlgeschlagen.');
    } catch {
      setError('Hochladen fehlgeschlagen – Verbindung prüfen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      {name && <input type="hidden" name={name} value={value} />}
      <div className="flex flex-wrap items-center gap-2">
        {uploaded ? (
          <span className="input flex min-w-44 flex-1 items-center whitespace-nowrap text-fog-300">📷 Eigenes Bild hochgeladen</span>
        ) : (
          <input
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value.trim())}
            placeholder="https://… oder vom PC hochladen"
            className="input min-w-0 flex-1"
            aria-label={`${label} – Link`}
          />
        )}
        <button type="button" className="btn-ghost" disabled={disabled || busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Lädt hoch …' : '📁 Vom PC hochladen'}
        </button>
        {value && (
          <button type="button" className="btn-ghost" disabled={disabled} onClick={() => onChange('')}>
            Entfernen
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          data-testid="image-upload"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void upload(file);
          }}
        />
      </div>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- Vorschau eigener bzw. verlinkter Bilder
        <img src={src} alt="Vorschau" className="max-h-32 w-fit rounded-lg border border-ink-700 object-contain" />
      )}
      {error && <span className="text-danger-500">{error}</span>}
      <span className="text-xs text-fog-500">PNG, JPG, GIF oder WebP bis 8 MB. Klappt auch, wenn dein Dashboard nicht öffentlich erreichbar ist.</span>
    </div>
  );
}
