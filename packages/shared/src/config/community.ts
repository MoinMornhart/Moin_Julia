import { z } from 'zod';

/**
 * Community: Geburtstage, Zähl-Kanal, Vorschläge mit Abstimmung, Starboard, Giveaways,
 * Umfragen (Discords eigene) und Erinnerungen. Jede Funktion lässt sich einzeln einschalten.
 */

const snowflake = z.string().regex(/^\d{15,22}$/);
const optionalSnowflake = z.union([snowflake, z.literal('')]);

export const DEFAULT_BIRTHDAY_TEXT = '🎂 Alles Gute zum Geburtstag, {user}! Feier schön! 🎉';

export const communityConfigSchema = z.object({
  birthdays: z
    .object({
      enabled: z.boolean().default(false),
      channelId: optionalSnowflake.default(''),
      /** Rolle für den ganzen Geburtstag (wird am nächsten Tag wieder entfernt) */
      roleId: optionalSnowflake.default(''),
      text: z.string().max(1000).default(DEFAULT_BIRTHDAY_TEXT),
      /** Uhrzeit (Europe/Berlin), zu der gratuliert wird */
      hour: z.number().int().min(0).max(23).default(9),
    })
    .default({ enabled: false, channelId: '', roleId: '', text: DEFAULT_BIRTHDAY_TEXT, hour: 9 }),
  counting: z
    .object({
      enabled: z.boolean().default(false),
      channelId: optionalSnowflake.default(''),
      /** Darf dieselbe Person zweimal hintereinander zählen? */
      allowDouble: z.boolean().default(false),
      /** Bei Fehler wieder bei 1 anfangen (sonst nur Hinweis) */
      resetOnFail: z.boolean().default(true),
      /** Falsche Nachrichten löschen (statt ❌-Reaktion) */
      deleteWrong: z.boolean().default(false),
    })
    .default({ enabled: false, channelId: '', allowDouble: false, resetOnFail: true, deleteWrong: false }),
  suggestions: z
    .object({
      enabled: z.boolean().default(false),
      channelId: optionalSnowflake.default(''),
      /** Zu jedem Vorschlag einen Thread zum Diskutieren */
      threads: z.boolean().default(true),
      /** Diese Rollen dürfen Vorschläge annehmen/ablehnen (Admins immer) */
      staffRoleIds: z.array(snowflake).max(20).default([]),
    })
    .default({ enabled: false, channelId: '', threads: true, staffRoleIds: [] }),
  starboard: z
    .object({
      enabled: z.boolean().default(false),
      channelId: optionalSnowflake.default(''),
      emoji: z.string().trim().min(1).max(60).default('⭐'),
      threshold: z.number().int().min(1).max(100).default(3),
      selfStar: z.boolean().default(false),
      ignoredChannelIds: z.array(snowflake).max(50).default([]),
    })
    .default({ enabled: false, channelId: '', emoji: '⭐', threshold: 3, selfStar: false, ignoredChannelIds: [] }),
  /** Wer Giveaways, Umfragen per Bot und Vorschlags-Entscheidungen steuern darf (zusätzlich zu „Server verwalten“) */
  managerRoleIds: z.array(snowflake).max(20).default([]),
});
export type CommunityConfig = z.infer<typeof communityConfigSchema>;

export function parseCommunityConfig(raw: unknown): CommunityConfig {
  const parsed = communityConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : communityConfigSchema.parse({});
}

// ── Geburtstage ─────────────────────────────────────────────────────────────

export function validBirthday(day: number, month: number, year?: number | null): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month) || month < 1 || month > 12 || day < 1) return false;
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  if (day > max) return false;
  if (year != null) {
    if (!Number.isInteger(year) || year < 1900 || year > new Date().getUTCFullYear()) return false;
    if (month === 2 && day === 29 && !isLeap(year)) return false;
  }
  return true;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Datum (Tag/Monat/Jahr/Stunde) in Europe/Berlin */
export function berlinParts(date: Date): { day: number; month: number; year: number; hour: number } {
  const parts = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', hourCycle: 'h23' }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { day: get('day'), month: get('month'), year: get('year'), hour: get('hour') };
}

/** Hat jemand heute Geburtstag? 29. Februar wird in Nicht-Schaltjahren am 28. gefeiert. */
export function isBirthdayToday(b: { day: number; month: number }, today: { day: number; month: number; year: number }): boolean {
  if (b.month === 2 && b.day === 29 && !isLeap(today.year)) return today.month === 2 && today.day === 28;
  return b.day === today.day && b.month === today.month;
}

/** Tage bis zum nächsten Geburtstag (0 = heute) */
export function daysUntilBirthday(b: { day: number; month: number }, today: { day: number; month: number; year: number }): number {
  const start = Date.UTC(today.year, today.month - 1, today.day);
  for (let i = 0; i < 366 * 2; i++) {
    const d = new Date(start + i * 86_400_000);
    if (isBirthdayToday(b, { day: d.getUTCDate(), month: d.getUTCMonth() + 1, year: d.getUTCFullYear() })) return i;
  }
  return 0;
}

export function fillBirthdayText(text: string, ctx: { user: string; name: string; age: number | null; server: string }): string {
  return text
    .replaceAll('{user}', ctx.user)
    .replaceAll('{name}', ctx.name)
    .replaceAll('{age}', ctx.age == null ? '' : String(ctx.age))
    .replaceAll('{server}', ctx.server)
    .slice(0, 2000);
}

// ── Zählen ──────────────────────────────────────────────────────────────────

/** Zahl am Anfang der Nachricht („12“, „12 juhu“); sonst null */
export function parseCount(content: string): number | null {
  const m = content.trim().match(/^(\d{1,9})(?:\s|$)/);
  return m ? Number(m[1]) : null;
}

export type CountResult = 'ok' | 'wrong-number' | 'double' | 'ignore';

export function checkCount(state: { current: number; lastUserId: string | null }, value: number | null, userId: string, allowDouble: boolean): CountResult {
  if (value === null) return 'ignore';
  if (!allowDouble && state.lastUserId === userId) return 'double';
  return value === state.current + 1 ? 'ok' : 'wrong-number';
}

// ── Giveaways ───────────────────────────────────────────────────────────────

/** Zieht bis zu n verschiedene Gewinner (fair gemischt) */
export function pickWinners(entrants: string[], n: number, random = Math.random): string[] {
  const pool = [...new Set(entrants)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, Math.max(0, n));
}

// ── Vorschläge ──────────────────────────────────────────────────────────────

export const SUGGESTION_STATUS = ['open', 'accepted', 'denied', 'considered'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUS)[number];
export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  open: 'Offen',
  accepted: 'Angenommen',
  denied: 'Abgelehnt',
  considered: 'Wird überlegt',
};

export function voteCounts(votes: Record<string, number>): { up: number; down: number } {
  let up = 0;
  let down = 0;
  for (const v of Object.values(votes)) {
    if (v > 0) up++;
    else if (v < 0) down++;
  }
  return { up, down };
}

// ── Erinnerungen ────────────────────────────────────────────────────────────

export const MAX_REMINDER_MS = 365 * 86_400_000;
export const MAX_REMINDERS_PER_USER = 25;
