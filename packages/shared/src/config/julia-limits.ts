import { z } from 'zod';

/**
 * Julias Limits – für alle gleich oder pro Person/Rolle anders:
 * z. B. „Max: 200 Antworten pro Stunde“, „Anna: 2.000 Wörter pro Tag“, „Mods: unbegrenzt“.
 * Wörter = Wörter in den Fragen der Person. 0 = kein Limit. Herrscher haben nie ein Limit (siehe royal.ts).
 */
export const LIMIT_UNITS = ['antworten', 'woerter'] as const;
export const LIMIT_PERIODS = ['stunde', 'tag'] as const;
export type LimitUnit = (typeof LIMIT_UNITS)[number];
export type LimitPeriod = (typeof LIMIT_PERIODS)[number];
export const LIMIT_UNIT_LABELS: Record<LimitUnit, string> = { antworten: 'Antworten', woerter: 'Wörter' };
export const LIMIT_PERIOD_LABELS: Record<LimitPeriod, string> = { stunde: 'Stunde', tag: 'Tag' };
export const LIMIT_PERIOD_MS: Record<LimitPeriod, number> = { stunde: 3_600_000, tag: 86_400_000 };

export interface LimitRule {
  /** 0 = unbegrenzt */
  amount: number;
  unit: LimitUnit;
  period: LimitPeriod;
  cooldownSeconds: number;
}

export const limitOverrideSchema = z.object({
  /** Discord-ID der Person oder Rolle */
  id: z.string().regex(/^\d{15,22}$/),
  kind: z.enum(['user', 'role']).default('user'),
  /** Anzeigename (nur fürs Dashboard) */
  name: z.string().trim().max(60).default(''),
  amount: z.number().int().min(0).max(100_000).default(0),
  unit: z.enum(LIMIT_UNITS).default('antworten'),
  period: z.enum(LIMIT_PERIODS).default('stunde'),
  cooldownSeconds: z.number().int().min(0).max(600).default(0),
});
export type LimitOverride = z.infer<typeof limitOverrideSchema>;

/** „unbegrenzt“ ist großzügiger als jede Zahl */
function generosity(r: LimitRule): number {
  return r.amount === 0 ? Infinity : r.amount * (r.period === 'stunde' ? 24 : 1) * (r.unit === 'antworten' ? 50 : 1);
}

/**
 * Welche Regel gilt für diese Person? Eigene Ausnahme der Person > großzügigste Rollen-Ausnahme >
 * „Rollen ohne Limit“ > allgemeines Limit.
 */
export function effectiveLimit(
  config: { perUserPerHour: number; userCooldownSeconds: number; limitUnit: LimitUnit; limitPeriod: LimitPeriod; limitOverrides: LimitOverride[]; unlimitedRoleIds: string[] },
  userId: string,
  roleIds: readonly string[],
): LimitRule {
  const own = config.limitOverrides.find((o) => o.kind === 'user' && o.id === userId);
  if (own) return { amount: own.amount, unit: own.unit, period: own.period, cooldownSeconds: own.cooldownSeconds };
  const roles = config.limitOverrides.filter((o) => o.kind === 'role' && roleIds.includes(o.id));
  if (roles.length) {
    const best = roles.map((o) => ({ amount: o.amount, unit: o.unit, period: o.period, cooldownSeconds: o.cooldownSeconds })).sort((a, b) => generosity(b) - generosity(a))[0]!;
    return best;
  }
  if (config.unlimitedRoleIds.some((r) => roleIds.includes(r))) return { amount: 0, unit: 'antworten', period: 'stunde', cooldownSeconds: 0 };
  return { amount: config.perUserPerHour, unit: config.limitUnit, period: config.limitPeriod, cooldownSeconds: config.userCooldownSeconds };
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Darf die Person jetzt fragen? `used` = bisherige Anfragen (Zeitpunkt + Wörter) */
export function limitCheck(used: readonly { at: number; words: number }[], lastAt: number, rule: LimitRule, now: number, nextWords = 0): 'ok' | 'cooldown' | 'limit' {
  if (now - lastAt < rule.cooldownSeconds * 1000) return 'cooldown';
  if (rule.amount === 0) return 'ok';
  const recent = used.filter((u) => now - u.at < LIMIT_PERIOD_MS[rule.period]);
  if (rule.unit === 'antworten') return recent.length >= rule.amount ? 'limit' : 'ok';
  const spent = recent.reduce((sum, u) => sum + u.words, 0);
  if (spent >= rule.amount) return 'limit';
  // Die neue Frage zählt mit – nur die allererste darf auch allein länger sein
  return spent > 0 && spent + nextWords > rule.amount ? 'limit' : 'ok';
}
