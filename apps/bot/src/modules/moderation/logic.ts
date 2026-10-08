import type { APIEmbed } from 'discord.js';
import { formatDuration, t, type AutomodConfig, type Locale, type TranslationKey } from '@moin/shared';

/**
 * Reine Funktionen der Moderation – ohne Discord und Datenbank testbar.
 */

export type CaseType = 'WARN' | 'TIMEOUT' | 'UNTIMEOUT' | 'KICK' | 'BAN' | 'UNBAN';

export interface CaseData {
  number: number;
  type: CaseType;
  userId: string;
  userTag: string;
  moderatorId: string;
  moderatorTag: string;
  reason: string | null;
  durationSec: number | null;
  active: boolean;
  source: string;
  createdAt: Date;
}

export const CASE_COLORS: Record<CaseType, number> = {
  WARN: 0xffc857,
  TIMEOUT: 0xff9f43,
  UNTIMEOUT: 0x2fd1b8,
  KICK: 0xff7a59,
  BAN: 0xff5d7a,
  UNBAN: 0x2fd1b8,
};

const CASE_ICONS: Record<CaseType, string> = { WARN: '⚠️', TIMEOUT: '⏳', UNTIMEOUT: '✅', KICK: '👢', BAN: '🔨', UNBAN: '🕊️' };

export function caseEmbed(locale: Locale, c: CaseData): APIEmbed {
  const type = t(locale, `mod.type.${c.type}` as TranslationKey);
  const fields = [
    { name: t(locale, 'mod.case.user'), value: `<@${c.userId}> · \`${c.userTag}\``, inline: true },
    { name: t(locale, 'mod.case.moderator'), value: `<@${c.moderatorId}> · \`${c.moderatorTag}\``, inline: true },
  ];
  if (c.durationSec) fields.push({ name: t(locale, 'mod.case.duration'), value: formatDuration(c.durationSec * 1000, locale), inline: true });
  fields.push({ name: t(locale, 'mod.case.reason'), value: (c.reason ?? t(locale, 'mod.case.noReason')).slice(0, 1024), inline: false });
  const source = c.source === 'automod' ? t(locale, 'mod.case.source.automod') : c.source === 'escalation' ? t(locale, 'mod.case.source.escalation') : null;
  return {
    color: c.active ? CASE_COLORS[c.type] : 0x8c96ba,
    title: `${CASE_ICONS[c.type]} ${t(locale, 'mod.case.title', { case: c.number, type })}${c.active ? '' : ` · ${t(locale, 'mod.case.pardoned')}`}`,
    fields,
    footer: { text: [source, `User-ID: ${c.userId}`].filter(Boolean).join(' · ') },
    timestamp: c.createdAt.toISOString(),
  };
}

export function warnsEmbed(locale: Locale, userTag: string, warns: CaseData[], active: number): APIEmbed {
  if (!warns.length) {
    return { color: CASE_COLORS.UNTIMEOUT, description: t(locale, 'mod.warns.none', { user: userTag }) };
  }
  const lines = warns.slice(0, 15).map((w) => {
    const date = `<t:${Math.floor(w.createdAt.getTime() / 1000)}:d>`;
    const reason = (w.reason ?? t(locale, 'mod.case.noReason')).slice(0, 80);
    return `${w.active ? '⚠️' : '↩️'} **#${w.number}** · ${date} · ${reason}`;
  });
  return {
    color: CASE_COLORS.WARN,
    title: t(locale, 'mod.warns.title', { user: userTag }),
    description: lines.join('\n'),
    footer: { text: t(locale, 'mod.warns.footer', { active, total: warns.length }) },
  };
}

export function dmText(locale: Locale, type: 'WARN' | 'TIMEOUT' | 'KICK' | 'BAN', server: string, reason: string | null, durationMs?: number): string {
  const head = t(locale, `mod.dm.${type}` as TranslationKey, { server, duration: durationMs ? formatDuration(durationMs, locale) : '' });
  return reason ? `${head}\n${t(locale, 'mod.dm.reason', { reason })}` : head;
}

// ── Rangprüfung ─────────────────────────────────────────────────────────────

export interface HierarchyInput {
  moderatorId: string;
  targetId: string;
  ownerId: string;
  botId: string;
  /** Position der höchsten Rolle; null = Ziel ist kein Mitglied (z. B. Bann per ID) */
  moderatorTop: number;
  targetTop: number | null;
  botTop: number;
}

/** Liefert den Übersetzungsschlüssel des Hindernisses oder null, wenn moderiert werden darf. */
export function hierarchyProblem(i: HierarchyInput): TranslationKey | null {
  if (i.targetId === i.moderatorId) return 'mod.err.self';
  if (i.targetId === i.botId) return 'mod.err.bot';
  if (i.targetId === i.ownerId) return 'mod.err.owner';
  if (i.targetTop === null) return null;
  if (i.moderatorId !== i.ownerId && i.targetTop >= i.moderatorTop) return 'mod.err.hierarchy';
  if (i.targetTop >= i.botTop) return 'mod.err.botHierarchy';
  return null;
}

// ── Bot-seitiger Automod ────────────────────────────────────────────────────

/** Zählt Nachrichten pro Mitglied in einem gleitenden Zeitfenster. */
export class SpamTracker {
  private readonly hits = new Map<string, number[]>();

  /** Registriert eine Nachricht und liefert die Anzahl im Fenster. */
  hit(key: string, now: number, windowMs: number): number {
    const list = (this.hits.get(key) ?? []).filter((ts) => now - ts < windowMs);
    list.push(now);
    this.hits.set(key, list);
    return list.length;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  /** Alte Einträge entfernen (gegen Speicherwachstum) */
  sweep(now: number, maxAgeMs: number): void {
    for (const [key, list] of this.hits) {
      if (!list.some((ts) => now - ts < maxAgeMs)) this.hits.delete(key);
    }
  }
}

/** Anteil Großbuchstaben an allen Buchstaben – Erwähnungen, Emojis, Links und Code werden ignoriert. */
export function capsStats(text: string): { letters: number; ratio: number } {
  const cleaned = text
    .replace(/<a?:\w+:\d+>/g, '')
    .replace(/<[@#&!]+\d+>/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/```[\s\S]*?```|`[^`]*`/g, '');
  const letters = [...cleaned].filter((ch) => ch.toLowerCase() !== ch.toUpperCase());
  if (!letters.length) return { letters: 0, ratio: 0 };
  const upper = letters.filter((ch) => ch === ch.toUpperCase()).length;
  return { letters: letters.length, ratio: upper / letters.length };
}

export function isCapsViolation(text: string, minLength: number, percent: number): boolean {
  const { letters, ratio } = capsStats(text);
  return letters >= minLength && ratio * 100 >= percent;
}

// ── Discord-AutoMod-Regeln ──────────────────────────────────────────────────

export const RULE_PREFIX = 'Moin_Julia ·';

export interface NativeRule {
  key: 'badWords' | 'links' | 'invites' | 'mentionSpam';
  name: string;
  triggerType: 1 | 5; // 1 = Keyword, 5 = Mention-Spam
  keywordFilter?: string[];
  regexPatterns?: string[];
  allowList?: string[];
  mentionTotalLimit?: number;
}

/** Regex für Discord-Einladungen (Rust-Regex-Syntax, wie Discord sie erwartet) */
export const INVITE_REGEX = '(?i)(discord\\.gg|discord(app)?\\.com/invite)/[a-z0-9-]+';
export const LINK_REGEX = '(?i)https?://[^\\s]+';

/** Welche Discord-AutoMod-Regeln laut Einstellungen existieren sollen. */
export function desiredNativeRules(locale: Locale, automod: AutomodConfig): NativeRule[] {
  const rules: NativeRule[] = [];
  const words = [...new Set(automod.badWords.words.map((w) => w.trim()).filter(Boolean))].slice(0, 1000);
  if (automod.badWords.enabled && words.length) {
    rules.push({ key: 'badWords', name: t(locale, 'mod.auto.ruleBadWords'), triggerType: 1, keywordFilter: words });
  }
  if (automod.links.enabled) {
    rules.push({
      key: 'links',
      name: t(locale, 'mod.auto.ruleLinks'),
      triggerType: 1,
      regexPatterns: [LINK_REGEX],
      allowList: automod.links.allowDomains.map((d) => `*${d.replace(/^\*+|\*+$/g, '').replace(/^https?:\/\//, '')}*`).slice(0, 100),
    });
  }
  if (automod.invites.enabled) {
    rules.push({ key: 'invites', name: t(locale, 'mod.auto.ruleInvites'), triggerType: 1, regexPatterns: [INVITE_REGEX] });
  }
  if (automod.mentionSpam.enabled) {
    rules.push({ key: 'mentionSpam', name: t(locale, 'mod.auto.ruleMentions'), triggerType: 5, mentionTotalLimit: automod.mentionSpam.limit });
  }
  return rules;
}

/** Ordnet eine vorhandene Discord-Regel anhand ihres Namens unserem Schlüssel zu (de oder en). */
export function ruleKeyFromName(name: string): NativeRule['key'] | null {
  if (!name.startsWith(RULE_PREFIX)) return null;
  for (const locale of ['de', 'en'] as const) {
    if (name === t(locale, 'mod.auto.ruleBadWords')) return 'badWords';
    if (name === t(locale, 'mod.auto.ruleLinks')) return 'links';
    if (name === t(locale, 'mod.auto.ruleInvites')) return 'invites';
    if (name === t(locale, 'mod.auto.ruleMentions')) return 'mentionSpam';
  }
  return null;
}
