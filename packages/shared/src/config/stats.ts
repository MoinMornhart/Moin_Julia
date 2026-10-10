import { z } from 'zod';

/**
 * Server-Statistiken: Tageswerte (Beitritte, Austritte, Nachrichten, Sprachminuten, Mitgliederzahl)
 * pro Server, Kanal und Mitglied – plus Statistik-Kanäle, deren Name sich selbst aktualisiert.
 */

const snowflake = z.string().regex(/^\d{15,22}$/);

export const STAT_PLACEHOLDERS = ['{members}', '{humans}', '{bots}', '{boosts}', '{channels}', '{roles}', '{voice}'] as const;
export const STAT_PLACEHOLDER_LABELS: Record<(typeof STAT_PLACEHOLDERS)[number], string> = {
  '{members}': 'alle Mitglieder',
  '{humans}': 'ohne Bots',
  '{bots}': 'Bots',
  '{boosts}': 'Server-Boosts',
  '{channels}': 'Kanäle',
  '{roles}': 'Rollen',
  '{voice}': 'gerade im Sprachkanal',
};

export const statChannelSchema = z.object({
  channelId: snowflake,
  template: z.string().trim().min(1).max(90),
});

export const statsConfigSchema = z.object({
  statChannels: z.array(statChannelSchema).max(10).default([]),
  /** Tageswerte pro Mitglied und Kanal so lange aufbewahren */
  retentionDays: z.number().int().min(30).max(730).default(180),
  ignoredChannelIds: z.array(snowflake).max(50).default([]),
});
export type StatsConfig = z.infer<typeof statsConfigSchema>;

export function parseStatsConfig(raw: unknown): StatsConfig {
  const parsed = statsConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : statsConfigSchema.parse({});
}

export interface StatValues {
  members: number;
  humans: number;
  bots: number;
  boosts: number;
  channels: number;
  roles: number;
  voice: number;
}

/** Kanalname aus Vorlage – Zahlen mit Tausenderpunkt, höchstens 100 Zeichen (Discord-Grenze) */
export function fillStatTemplate(template: string, v: StatValues): string {
  const n = (x: number) => x.toLocaleString('de-DE');
  return template
    .replaceAll('{members}', n(v.members))
    .replaceAll('{humans}', n(v.humans))
    .replaceAll('{bots}', n(v.bots))
    .replaceAll('{boosts}', n(v.boosts))
    .replaceAll('{channels}', n(v.channels))
    .replaceAll('{roles}', n(v.roles))
    .replaceAll('{voice}', n(v.voice))
    .slice(0, 100);
}

/** „2026-10-08“ in deutscher Zeit */
export function statDay(date: Date): string {
  const p = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (t: string) => p.find((x) => x.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Die letzten n Tage (älteste zuerst) als „YYYY-MM-DD“ – Lücken in den Daten werden mit 0 gefüllt */
export function lastDays(n: number, today = new Date()): string[] {
  const end = statDay(today);
  const base = Date.UTC(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, Number(end.slice(8, 10)));
  return Array.from({ length: n }, (_, i) => new Date(base - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

/** Zeitreihe mit Nullen für fehlende Tage */
export function fillSeries<T extends { day: string }>(days: string[], rows: T[], pick: (row: T) => number): number[] {
  const map = new Map(rows.map((r) => [r.day, pick(r)]));
  return days.map((d) => map.get(d) ?? 0);
}

/** Veränderung in Prozent (null, wenn es vorher nichts gab) */
export function changePercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Discord: höchstens 2 Umbenennungen pro Kanal in 10 Minuten (mit kleinem Puffer gegen Uhr-Abweichungen) */
export const STAT_RENAME_LIMIT = 2;
export const STAT_RENAME_WINDOW_MS = 10 * 60_000 + 15_000;

/** Darf dieser Kanal jetzt umbenannt werden? `history` = Zeitpunkte der letzten Umbenennungen */
export function statRenameAllowed(history: readonly number[], now: number): boolean {
  return history.filter((at) => now - at < STAT_RENAME_WINDOW_MS).length < STAT_RENAME_LIMIT;
}

/** Wann ist die nächste Umbenennung frühestens möglich? (für die Anzeige im Dashboard) */
export function statNextRenameAt(history: readonly number[], now: number): number {
  const recent = history.filter((at) => now - at < STAT_RENAME_WINDOW_MS).sort((a, b) => a - b);
  return recent.length < STAT_RENAME_LIMIT ? now : recent[recent.length - STAT_RENAME_LIMIT]! + STAT_RENAME_WINDOW_MS;
}
