import type { TicketQuestion, TicketReason, TicketsConfig } from '@moin/shared';

/** Gehört jemand zum Team? Team-Rollen (global + Grund) oder „Server verwalten“ */
export function isTeam(memberRoleIds: string[], canManageGuild: boolean, config: TicketsConfig, reason?: Pick<TicketReason, 'teamRoleIds'> | null): boolean {
  if (canManageGuild) return true;
  const team = new Set([...config.teamRoleIds, ...(reason?.teamRoleIds ?? [])]);
  return memberRoleIds.some((r) => team.has(r));
}

/** Darf noch ein Ticket geöffnet werden? */
export function canOpen(openCount: number, config: TicketsConfig): boolean {
  return openCount < config.maxOpenPerUser;
}

/** Formular-Antworten zuordnen; leere optionale Felder fallen weg */
export function collectAnswers(questions: TicketQuestion[], values: (string | null | undefined)[]): { label: string; value: string }[] {
  return questions.map((q, i) => ({ label: q.label, value: (values[i] ?? '').trim().slice(0, 1024) })).filter((a) => a.value.length > 0);
}

/** Inaktiv genug zum automatischen Schließen? */
export function shouldAutoClose(lastActivity: Date, now: Date, config: TicketsConfig): boolean {
  return config.autoClose.enabled && now.getTime() - lastActivity.getTime() >= config.autoClose.hours * 3_600_000;
}

export function stars(n: number): string {
  const v = Math.max(1, Math.min(5, Math.round(n)));
  return '★'.repeat(v) + '☆'.repeat(5 - v);
}

/** Begrüßungstext mit Platzhaltern */
export function welcomeText(template: string, ctx: { user: string; nr: number }): string {
  return template.replaceAll('{user}', ctx.user).replaceAll('{nr}', String(ctx.nr)).slice(0, 2000);
}
