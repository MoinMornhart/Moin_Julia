import { z } from 'zod';
import { formFieldSchema } from './forms.js';

const snowflake = z.string().regex(/^\d{15,22}$/);

/**
 * Teams / Bewerbungssystem wie bei GalaxyBot:
 * Stellen auf einer öffentlichen Bewerbungsseite → Posteingang im Dashboard → Annehmen (Rollen, Probezeit) / Ablehnen.
 */

export const positionSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().max(2000).default(''),
  emoji: z.string().max(40).default(''),
  open: z.boolean().default(true),
  /** Fragen auf der Bewerbungsseite (Webseite: bis zu 20) */
  questions: z.array(formFieldSchema).max(20).default([]),
  /** bei Annahme geben … */
  acceptRoleIds: z.array(snowflake).max(10).default([]),
  /** … und entziehen (z. B. „Bewerber:in“) */
  removeRoleIds: z.array(snowflake).max(10).default([]),
  /** Probezeit in Tagen (0 = keine) */
  probationDays: z.number().int().min(0).max(365).default(0),
  /** nach einer Absage erst wieder nach so vielen Tagen bewerben */
  cooldownDays: z.number().int().min(0).max(365).default(14),
  /** Anforderungen */
  minAccountDays: z.number().int().min(0).max(3650).default(0),
  minMemberDays: z.number().int().min(0).max(3650).default(0),
});
export type PositionData = z.infer<typeof positionSchema>;

export const teamConfigSchema = z.object({
  /** Log-Kanal: jede neue Bewerbung, Entscheidungen, Probezeit-Erinnerungen */
  logChannelId: snowflake.nullable().default(null),
  /** Diese Rollen dürfen Bewerbungen bearbeiten (Admins dürfen immer) */
  reviewerRoleIds: z.array(snowflake).max(10).default([]),
  /** Rolle während der Probezeit (wird danach wieder entzogen) */
  probationRoleId: snowflake.nullable().default(null),
  /** so viele Tage vor Ende erinnern – danach alle 3 Tage, bis entschieden ist */
  probationReminderDays: z.number().int().min(0).max(60).default(3),
  /** Kanal für das „Jetzt bewerben“-Panel */
  panelChannelId: snowflake.nullable().default(null),
  panelText: z.string().max(1500).default('Du willst ins Team? Schau dir die offenen Stellen an und bewirb dich direkt online. 💼'),
  acceptText: z.string().max(1500).default('🎉 Glückwunsch {user}! Deine Bewerbung als **{position}** auf **{server}** wurde angenommen. Willkommen im Team!'),
  rejectText: z.string().max(1500).default('Danke für deine Bewerbung als **{position}** auf **{server}**. Leider hat es diesmal nicht geklappt.\n\nBegründung: {reason}'),
});
export type TeamConfig = z.infer<typeof teamConfigSchema>;

export function parseTeamConfig(raw: unknown): TeamConfig {
  const parsed = teamConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : teamConfigSchema.parse({});
}

export const APPLICATION_STATUS = ['pending', 'accepted', 'rejected'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUS)[number];
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = { pending: 'Ausstehend', accepted: 'Angenommen', rejected: 'Abgelehnt' };

/** Tags wie bei GalaxyBot */
export const APPLICATION_TAGS = ['suitable', 'unsuitable', 'overqualified', 'backup'] as const;
export type ApplicationTag = (typeof APPLICATION_TAGS)[number];
export const TAG_LABELS: Record<ApplicationTag, string> = {
  suitable: '✅ Geeignet',
  unsuitable: '⛔ Ungeeignet',
  overqualified: '🚀 Überqualifiziert',
  backup: '🗂️ Reserve',
};

/** Erstellzeit eines Discord-Accounts aus der ID */
export function snowflakeDate(id: string): Date {
  return new Date(Number((BigInt(id) >> 22n) + 1420070400000n));
}

/**
 * Darf sich jemand auf diese Stelle bewerben?
 * Reihenfolge: Stelle offen → schon offene Bewerbung → Wartezeit nach Absage → Account-Alter → Mitgliedsdauer.
 */
export function applicationBlocker(
  position: Pick<PositionData, 'open' | 'cooldownDays' | 'minAccountDays' | 'minMemberDays'>,
  ctx: { userId: string; joinedAt: Date | null; now: Date; previous: { status: string; decidedAt: Date | null }[] },
): string | null {
  if (!position.open) return 'Diese Stelle ist gerade geschlossen.';
  if (ctx.previous.some((p) => p.status === 'pending')) return 'Du hast dich auf diese Stelle schon beworben – die Bewerbung wird gerade bearbeitet.';
  const day = 86_400_000;
  const lastRejected = ctx.previous
    .filter((p) => p.status === 'rejected' && p.decidedAt)
    .map((p) => p.decidedAt!.getTime())
    .sort((a, b) => b - a)[0];
  if (lastRejected && position.cooldownDays > 0) {
    const until = lastRejected + position.cooldownDays * day;
    if (ctx.now.getTime() < until) return `Nach einer Absage kannst du dich ab dem ${new Date(until).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })} wieder bewerben.`;
  }
  if (position.minAccountDays > 0 && ctx.now.getTime() - snowflakeDate(ctx.userId).getTime() < position.minAccountDays * day) {
    return `Dein Discord-Account muss mindestens ${position.minAccountDays} Tage alt sein.`;
  }
  if (position.minMemberDays > 0) {
    if (!ctx.joinedAt) return 'Du musst Mitglied auf dem Server sein, um dich zu bewerben.';
    if (ctx.now.getTime() - ctx.joinedAt.getTime() < position.minMemberDays * day) return `Du musst mindestens ${position.minMemberDays} Tage auf dem Server sein.`;
  }
  return null;
}

/** Platzhalter in DM-Texten */
export function fillTeamText(text: string, ctx: { user: string; position: string; server: string; reason?: string }): string {
  return text
    .replaceAll('{user}', ctx.user)
    .replaceAll('{position}', ctx.position)
    .replaceAll('{server}', ctx.server)
    .replaceAll('{reason}', ctx.reason ?? '–')
    .slice(0, 2000);
}
