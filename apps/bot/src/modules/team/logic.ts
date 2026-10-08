/** Probezeit-Erinnerung fällig? N Tage vor Ende, danach alle 3 Tage, bis entschieden ist */
export function probationReminderDue(p: { endAt: Date; remindedAt: Date | null; status: string }, reminderDays: number, now: Date): boolean {
  if (p.status !== 'running') return false;
  const day = 86_400_000;
  if (now.getTime() < p.endAt.getTime() - reminderDays * day) return false;
  return !p.remindedAt || now.getTime() - p.remindedAt.getTime() >= 3 * day;
}
