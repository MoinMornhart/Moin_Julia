import { z } from 'zod';

/**
 * Hochgeladene Bilder stehen in Einstellungen als `upload:<id>` statt als https-Link.
 * Der Bot hängt sie beim Senden als Datei an, das Dashboard zeigt sie über /api/uploads/<id>.
 */
export const UPLOAD_PREFIX = 'upload:';
export const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
/** Gesamtgröße aller Uploads pro Server */
export const UPLOAD_GUILD_QUOTA_BYTES = 100 * 1024 * 1024;
export const UPLOAD_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' } as const;
export type UploadMime = keyof typeof UPLOAD_TYPES;

export const uploadRefSchema = z.string().regex(/^upload:[a-z0-9]{20,40}$/);
/** Bildquelle in Einstellungen: leer, https-Link oder hochgeladenes Bild */
export const imageSourceSchema = z.union([z.literal(''), z.string().url().startsWith('https://'), uploadRefSchema]);

export function uploadIdOf(value: string | null | undefined): string | null {
  return value && uploadRefSchema.safeParse(value).success ? value.slice(UPLOAD_PREFIX.length) : null;
}

/** Bildtyp an den ersten Bytes erkennen (nicht der Dateiendung oder Browser-Angabe vertrauen). */
export function sniffImageType(bytes: Uint8Array): UploadMime | null {
  const at = (i: number, ...sig: number[]) => sig.every((b, k) => bytes[i + k] === b);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
  return null;
}
