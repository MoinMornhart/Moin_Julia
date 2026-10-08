import { z } from 'zod';

const snowflake = z.string().regex(/^\d{15,22}$/);

export const ESCALATION_ACTIONS = ['timeout', 'kick', 'ban'] as const;
export type EscalationAction = (typeof ESCALATION_ACTIONS)[number];

const escalationStep = z.object({
  /** Bei genau so vielen aktiven Verwarnungen greift die Stufe */
  warns: z.number().int().min(1).max(50),
  action: z.enum(ESCALATION_ACTIONS),
  /** Nur bei Timeout: Dauer in Minuten (max. 28 Tage) */
  durationMin: z.number().int().min(1).max(40320).nullable().default(null),
});
export type EscalationStep = z.infer<typeof escalationStep>;

/** Bot-seitige Regel (Spam/Caps) – was passiert bei einem Treffer */
export const AUTOMOD_ACTIONS = ['delete', 'delete_warn', 'delete_timeout'] as const;
export type AutomodAction = (typeof AUTOMOD_ACTIONS)[number];

const automodSchema = z.object({
  /** Discord-eigene AutoMod-Regeln (laufen auch, wenn der Bot offline ist) */
  badWords: z
    .object({ enabled: z.boolean().default(false), words: z.array(z.string().min(1).max(60)).max(1000).default([]) })
    .prefault({}),
  links: z
    .object({
      enabled: z.boolean().default(false),
      /** Erlaubte Domains, z. B. youtube.com, twitch.tv */
      allowDomains: z.array(z.string().min(3).max(100)).max(100).default([]),
    })
    .prefault({}),
  invites: z.object({ enabled: z.boolean().default(false) }).prefault({}),
  mentionSpam: z.object({ enabled: z.boolean().default(false), limit: z.number().int().min(2).max(50).default(5) }).prefault({}),
  /** Bot-seitig */
  spam: z
    .object({
      enabled: z.boolean().default(false),
      maxMessages: z.number().int().min(3).max(30).default(6),
      perSeconds: z.number().int().min(2).max(60).default(5),
      action: z.enum(AUTOMOD_ACTIONS).default('delete_timeout'),
      timeoutMin: z.number().int().min(1).max(1440).default(10),
    })
    .prefault({}),
  caps: z
    .object({
      enabled: z.boolean().default(false),
      minLength: z.number().int().min(5).max(200).default(12),
      percent: z.number().int().min(50).max(100).default(75),
      action: z.enum(AUTOMOD_ACTIONS).default('delete'),
    })
    .prefault({}),
  /** Jeder Treffer einer Discord-AutoMod-Regel erzeugt eine Verwarnung (zählt für die Eskalation) */
  warnOnNativeHit: z.boolean().default(false),
  exemptRoleIds: z.array(snowflake).max(20).default([]),
  exemptChannelIds: z.array(snowflake).max(50).default([]),
});
export type AutomodConfig = z.infer<typeof automodSchema>;

export const moderationConfigSchema = z.object({
  /** Kanal für Fall-Karten (Mod-Log) und AutoMod-Alarme */
  modLogChannelId: snowflake.nullable().default(null),
  /** Betroffene bekommen eine DM mit Grund */
  dmUsers: z.boolean().default(true),
  /** Ohne Grund keine Moderation */
  requireReason: z.boolean().default(false),
  /** Verwarnungen zählen nur so viele Tage (null = für immer) */
  warnExpiryDays: z.number().int().min(1).max(365).nullable().default(30),
  escalation: z
    .array(escalationStep)
    .max(5)
    .default([
      { warns: 3, action: 'timeout', durationMin: 60 },
      { warns: 5, action: 'kick', durationMin: null },
    ]),
  automod: automodSchema.prefault({}),
});

export type ModerationConfig = z.infer<typeof moderationConfigSchema>;

export function parseModerationConfig(raw: unknown): ModerationConfig {
  const result = moderationConfigSchema.safeParse(raw ?? {});
  return result.success ? result.data : moderationConfigSchema.parse({});
}

/** Welche Eskalationsstufe greift bei dieser Anzahl aktiver Verwarnungen? (genau gleich, damit sie nicht mehrfach auslöst) */
export function escalationFor(steps: EscalationStep[], activeWarns: number): EscalationStep | null {
  return steps.find((s) => s.warns === activeWarns) ?? null;
}

/** „10m“, „1h30m“, „2d“, „1w“ → Millisekunden; null bei ungültiger Eingabe */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!/^(\d+(s|m|min|h|std|d|t|w))+$/.test(text)) return null;
  const units: Record<string, number> = { s: 1e3, m: 6e4, min: 6e4, h: 36e5, std: 36e5, d: 864e5, t: 864e5, w: 6048e5 };
  let total = 0;
  for (const [, amount, unit] of text.matchAll(/(\d+)(min|std|s|m|h|d|t|w)/g)) {
    total += Number(amount) * units[unit!]!;
  }
  return total > 0 ? total : null;
}

/** Millisekunden → „1 Std. 30 Min.“ / „1 h 30 min“ */
export function formatDuration(ms: number, locale: 'de' | 'en'): string {
  const parts: string[] = [];
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  const m = Math.floor((ms % 36e5) / 6e4);
  if (d) parts.push(locale === 'de' ? `${d} ${d === 1 ? 'Tag' : 'Tage'}` : `${d} ${d === 1 ? 'day' : 'days'}`);
  if (h) parts.push(locale === 'de' ? `${h} Std.` : `${h} h`);
  if (m) parts.push(locale === 'de' ? `${m} Min.` : `${m} min`);
  if (!parts.length) parts.push(locale === 'de' ? `${Math.round(ms / 1000)} Sek.` : `${Math.round(ms / 1000)} s`);
  return parts.join(' ');
}

/** Maximaler Discord-Timeout: 28 Tage */
export const MAX_TIMEOUT_MS = 28 * 864e5;
