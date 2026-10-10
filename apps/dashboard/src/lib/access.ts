import 'server-only';
import { notFound } from 'next/navigation';
import type { Guild } from '@moin/db';
import { decideAdmin, hasManagePermission, isGuildManager } from '@moin/shared';
import { db } from './db';
import { botApi, fetchMemberRoleIds } from './discord';
import { cacheGet, cacheSet } from './redis';
import { requireSession, type DashboardSession } from './session';

export type AccessLevel = 'owner' | 'admin' | 'mod';

export const ACCESS_LABELS: Record<AccessLevel, string> = {
  owner: 'Owner',
  admin: 'Admin',
  mod: 'Mod (nur lesen)',
};

export { hasManagePermission };

/**
 * Rechte-Stufe eines Users auf einem Server:
 * Owner → Admin (Administrator/Server verwalten) → Mod (hat eine im Dashboard festgelegte Mod-Rolle).
 */
export async function accessLevel(session: DashboardSession, guild: Guild): Promise<AccessLevel | null> {
  const fromLogin = session.guilds.find((g) => g.id === guild.id);
  if (fromLogin?.owner || guild.ownerId === session.userId) return 'owner';
  const adminAtLogin = !!fromLogin && hasManagePermission(fromLogin.permissions);
  if (session.demo) {
    if (adminAtLogin) return 'admin';
  } else {
    // Der Login-Stand kann bis zu 7 Tage alt sein – darum live nachsehen, in BEIDE Richtungen:
    // Rechte entzogen → kein Admin mehr; erst nach dem Login Admin geworden (oder dem Server beigetreten) → sofort Admin.
    // Ist Discord gerade nicht erreichbar (null), gilt der Login-Stand.
    const live = await stillManager(guild.id, session.userId);
    if (decideAdmin(adminAtLogin, live)) return 'admin';
  }
  // Mod-Rollen aus den Einstellungen + Prüfer-Rollen des Bewerbungssystems (Teams)
  const reviewerRoleIds = await teamReviewerRoles(guild.id);
  const modRoles = [...guild.modRoleIds, ...reviewerRoleIds];
  if (modRoles.length > 0 && !session.demo) {
    const roles = await fetchMemberRoleIds(guild.id, session.userId);
    if (roles.some((r) => modRoles.includes(r))) return 'mod';
  }
  return null;
}

/**
 * Hat die Person JETZT noch „Administrator“ oder „Server verwalten“? (über den Bot, 60 s zwischengespeichert)
 * false = sicher nicht mehr (Rechte weg oder nicht mehr auf dem Server), null = unbekannt (Discord nicht erreichbar →
 * Login-Stand gilt weiter, damit ein Discord-Schluckauf niemanden aussperrt).
 */
async function stillManager(guildId: string, userId: string): Promise<boolean | null> {
  const key = `moin:dash:manager:${guildId}:${userId}`;
  const cached = await cacheGet<{ v: boolean }>(key);
  if (cached) return cached.v;
  try {
    const [member, roles] = await Promise.all([
      botApi<{ roles: string[] }>(`/guilds/${guildId}/members/${userId}`),
      botApi<{ id: string; permissions?: string }[]>(`/guilds/${guildId}/roles`),
    ]);
    const v = isGuildManager(guildId, member.roles, roles);
    if (v === null) return null;
    await cacheSet(key, { v }, 60);
    return v;
  } catch (error) {
    // 404 = nicht mehr auf dem Server
    return error instanceof Error && error.message.includes('(404)') ? false : null;
  }
}

/** Prüfer-Rollen aus den Team-Einstellungen (leer, wenn das Modul nichts festlegt) */
export async function teamReviewerRoles(guildId: string): Promise<string[]> {
  const row = await db().guildModule.findUnique({ where: { guildId_moduleId: { guildId, moduleId: 'team' } }, select: { config: true } });
  const ids = (row?.config as { reviewerRoleIds?: unknown } | null)?.reviewerRoleIds;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
}

/** Darf Bewerbungen bearbeiten: Owner/Admin oder eine Prüfer-Rolle */
export async function canReviewApplications(access: { session: DashboardSession; guild: Guild; canEdit: boolean }): Promise<boolean> {
  if (access.canEdit) return true;
  if (access.session.demo) return false;
  const reviewers = await teamReviewerRoles(access.guild.id);
  if (!reviewers.length) return false;
  const roles = await fetchMemberRoleIds(access.guild.id, access.session.userId);
  return roles.some((r) => reviewers.includes(r));
}

export interface GuildAccess {
  session: DashboardSession;
  guild: Guild;
  level: AccessLevel;
  canEdit: boolean;
}

/** Lädt Server + Rechte oder zeigt 404 (kein Hinweis, ob der Server existiert). */
export async function requireGuildAccess(guildId: string): Promise<GuildAccess> {
  const session = await requireSession();
  const guild = await db().guild.findUnique({ where: { id: guildId } });
  if (!guild || !guild.botPresent) notFound();
  const level = await accessLevel(session, guild);
  if (!level) notFound();
  return { session, guild, level, canEdit: level !== 'mod' };
}
