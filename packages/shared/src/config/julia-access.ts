import { z } from 'zod';

/**
 * Wer darf Julia nutzen (Blacklist/Whitelist mit Personen UND Rollen) und Stichwort-Regeln
 * („wenn X erwähnt wird, dann …“). Herrscher dürfen immer (siehe royal.ts).
 */
const snowflake = z.string().regex(/^\d{15,22}$/);

export const keywordRuleSchema = z.object({
  id: z.string().regex(/^r[\w-]{1,20}$/),
  /** Stichwörter, durch Komma getrennt (Groß/klein egal, ganze Wörter) */
  words: z.string().trim().min(1).max(300),
  /** Zusatzanweisung für Julia, wenn ein Stichwort fällt */
  instruction: z.string().trim().max(600).default(''),
  /** Optional: für diese Antwort in diesem Modus antworten (leer = aktueller Modus) */
  modeId: z.string().max(30).default(''),
});
export type KeywordRule = z.infer<typeof keywordRuleSchema>;

export const juliaAccessFields = {
  /** Diese Personen ignoriert Julia (Blacklist) */
  blockedUserIds: z.array(snowflake).max(100).default([]),
  /** Whitelist: Ist hier jemand eingetragen, antwortet Julia NUR diesen Personen/Rollen (und den Herrschern) */
  allowUserIds: z.array(snowflake).max(100).default([]),
  allowRoleIds: z.array(snowflake).max(20).default([]),
  keywordRules: z.array(keywordRuleSchema).max(20).default([]),
};

/** Darf diese Person Julia nutzen? (Herrscher prüft der Aufrufer vorher) */
export function juliaUserAllowed(
  config: { blockedUserIds: string[]; blockedRoleIds: string[]; allowUserIds: string[]; allowRoleIds: string[] },
  userId: string,
  roleIds: readonly string[],
): boolean {
  if (config.blockedUserIds.includes(userId) || config.blockedRoleIds.some((r) => roleIds.includes(r))) return false;
  const whitelist = config.allowUserIds.length > 0 || config.allowRoleIds.length > 0;
  if (!whitelist) return true;
  return config.allowUserIds.includes(userId) || config.allowRoleIds.some((r) => roleIds.includes(r));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Stichwörter einer Regel als Liste (leere weg, höchstens 20) */
export function ruleWords(rule: Pick<KeywordRule, 'words'>): string[] {
  return rule.words
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/** Welche Regeln treffen auf den Text zu? (ganze Wörter, Groß/klein egal, auch mit Umlauten) */
export function matchKeywordRules(rules: readonly KeywordRule[], text: string): { rule: KeywordRule; word: string }[] {
  const out: { rule: KeywordRule; word: string }[] = [];
  for (const rule of rules) {
    const word = ruleWords(rule).find((w) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(w)}($|[^\\p{L}\\p{N}])`, 'iu').test(text));
    if (word) out.push({ rule, word });
  }
  return out;
}
