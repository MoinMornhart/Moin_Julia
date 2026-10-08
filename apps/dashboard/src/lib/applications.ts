import 'server-only';
import { applicationBlocker, positionSchema, type PositionData } from '@moin/shared';
import { botApi } from './discord';
import { db } from './db';
import { isDemoMode } from './env';
import type { DashboardSession } from './session';

/** Server, auf dem sich jemand bewerben kann: Bot ist da und das Team-Modul ist an */
export async function applyGuild(guildId: string) {
  if (!/^\d{15,22}$/.test(guildId)) return null;
  const guild = await db().guild.findUnique({ where: { id: guildId } });
  if (!guild?.botPresent) return null;
  const mod = await db().guildModule.findUnique({ where: { guildId_moduleId: { guildId, moduleId: 'team' } } });
  return { guild, enabled: mod?.enabled ?? false };
}

export async function openPositions(guildId: string): Promise<{ id: string; data: PositionData }[]> {
  const rows = await db().jobPosition.findMany({ where: { guildId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  return rows
    .map((r) => ({ id: r.id, parsed: positionSchema.safeParse(r.data) }))
    .filter((r) => r.parsed.success && r.parsed.data.open)
    .map((r) => ({ id: r.id, data: r.parsed.data! }));
}

/** Seit wann ist jemand auf dem Server? (Discord-API; im Demo-Modus 100 Tage) */
export async function memberJoinedAt(guildId: string, userId: string): Promise<Date | null> {
  if (isDemoMode()) return new Date(Date.now() - 100 * 86_400_000);
  try {
    const m = await botApi<{ joined_at: string }>(`/guilds/${guildId}/members/${userId}`);
    return new Date(m.joined_at);
  } catch {
    return null;
  }
}

/** Grund, warum diese Person sich (noch) nicht bewerben darf – oder null */
export async function blockerFor(session: DashboardSession, guildId: string, positionId: string, position: PositionData): Promise<string | null> {
  if (!session.demo && !session.guilds.some((g) => g.id === guildId)) return 'Du musst Mitglied auf dem Server sein, um dich zu bewerben.';
  const previous = await db().application.findMany({ where: { guildId, positionId, userId: session.userId }, select: { status: true, decidedAt: true } });
  return applicationBlocker(position, { userId: session.userId, joinedAt: await memberJoinedAt(guildId, session.userId), now: new Date(), previous });
}
