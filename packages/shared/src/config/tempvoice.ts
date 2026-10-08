import { z } from 'zod';

const snowflake = z.string().regex(/^\d{15,22}$/);

/**
 * Eigene Sprachkanäle („Join to Create“, bei GalaxyBot „Custom Voice“):
 * Wer einem Erstell-Kanal beitritt, bekommt einen eigenen Sprachkanal mit Bedienfeld.
 * Leere Kanäle löscht der Bot automatisch.
 */
export const tempVoiceHubSchema = z.object({
  /** Sprachkanal „➕ Kanal erstellen“ */
  channelId: snowflake,
  /** Kategorie für die neuen Kanäle (leer = dieselbe wie der Erstell-Kanal) */
  categoryId: snowflake.nullable().default(null),
  /** {user} = Anzeigename, {count} = laufende Nummer */
  nameTemplate: z.string().trim().min(1).max(90).default('🔊 {user}s Kanal'),
  /** 0 = unbegrenzt */
  userLimit: z.number().int().min(0).max(99).default(0),
  /** Neue Kanäle gleich gesperrt (nur Eingeladene kommen rein) */
  startLocked: z.boolean().default(false),
});

export const tempVoiceConfigSchema = z.object({
  hubs: z.array(tempVoiceHubSchema).max(5).default([]),
  /** Bedienfeld in den Text-Chat des neuen Kanals senden */
  panel: z.boolean().default(true),
  /** Wie lange ein leerer Kanal bleibt, bevor er gelöscht wird (Sekunden) */
  deleteAfterSec: z.number().int().min(0).max(300).default(10),
  /** Rollen, die man bekommt, solange man einen eigenen Kanal besitzt – und wieder verliert */
  ownerRoleIds: z.array(snowflake).max(5).default([]),
});

export type TempVoiceHub = z.infer<typeof tempVoiceHubSchema>;
export type TempVoiceConfig = z.infer<typeof tempVoiceConfigSchema>;

export function parseTempVoiceConfig(raw: unknown): TempVoiceConfig {
  const parsed = tempVoiceConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : tempVoiceConfigSchema.parse({});
}

/** Kanalname aus der Vorlage – Discord erlaubt höchstens 100 Zeichen */
export function tempVoiceName(template: string, ctx: { user: string; count: number }): string {
  const name = template.replaceAll('{user}', ctx.user).replaceAll('{count}', String(ctx.count)).trim();
  return (name || `🔊 ${ctx.user}`).slice(0, 100);
}
