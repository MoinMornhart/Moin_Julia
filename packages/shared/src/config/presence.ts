import { z } from 'zod';

/**
 * Status und Aktivität des Bots (System → Bot-Profil).
 * Discord erlaubt das nur über die Gateway-Verbindung – deshalb setzt der Bot es selbst.
 */
export const BOT_STATUSES = ['online', 'idle', 'dnd', 'invisible'] as const;
export const ACTIVITY_TYPES = ['none', 'custom', 'playing', 'listening', 'watching', 'competing'] as const;

export const STATUS_LABELS: Record<(typeof BOT_STATUSES)[number], string> = {
  online: '🟢 Online',
  idle: '🌙 Abwesend',
  dnd: '⛔ Bitte nicht stören',
  invisible: '⚫ Unsichtbar',
};
export const ACTIVITY_LABELS: Record<(typeof ACTIVITY_TYPES)[number], string> = {
  none: 'Keine Aktivität',
  custom: 'Eigener Status (nur Text)',
  playing: 'Spielt …',
  listening: 'Hört …',
  watching: 'Schaut …',
  competing: 'Tritt an in …',
};

export const presenceSchema = z.object({
  status: z.enum(BOT_STATUSES).default('online'),
  type: z.enum(ACTIVITY_TYPES).default('custom'),
  /** {version} und {server} (Anzahl Server) werden ersetzt */
  text: z.string().trim().max(128).default('Moin! · v{version}'),
});
export type BotPresence = z.infer<typeof presenceSchema>;

export function parsePresence(raw: string | null | undefined): BotPresence {
  try {
    return presenceSchema.parse(raw ? JSON.parse(raw) : {});
  } catch {
    return presenceSchema.parse({});
  }
}

export function presenceText(p: BotPresence, ctx: { version: string; servers: number }): string {
  return p.text.replaceAll('{version}', ctx.version).replaceAll('{server}', String(ctx.servers)).slice(0, 128);
}
