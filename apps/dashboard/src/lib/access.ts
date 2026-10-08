import 'server-only';
import { notFound } from 'next/navigation';
import type { Guild } from '@moin/db';
import { db } from './db';
import { fetchMemberRoleIds } from './discord';
import { requireSession, type DashboardSession } from './session';

export type AccessLevel = 'owner' | 'admin' | 'mod';

export const ACCESS_LABELS: Record<AccessLevel, string> = {
  owner: 'Owner',
  admin: 'Admin',
  mod: 'Mod (nur lesen)',
};

const ADMINISTRATOR = 0x8n;
const MANAGE_GUILD = 0x20n;

export function hasManagePermission(permissions: string): boolean {
  const bits = BigInt(permissions);
  return (bits & ADMINISTRATOR) !== 0n || (bits & MANAGE_GUILD) !== 0n;
}

/**
 * Rechte-Stufe eines Users auf einem Server:
 * Owner → Admin (Administrator/Server verwalten) → Mod (hat eine im Dashboard festgelegte Mod-Rolle).
 */
export async function accessLevel(session: DashboardSession, guild: Guild): Promise<AccessLevel | null> {
  const fromLogin = session.guilds.find((g) => g.id === guild.id);
  if (fromLogin?.owner || guild.ownerId === session.userId) return 'owner';
  if (fromLogin && hasManagePermission(fromLogin.permissions)) return 'admin';
  // Mod-Rollen aus den Einstellungen + Prüfer-Rollen des Bewerbungssystems (Teams)
  const reviewerRoleIds = await teamReviewerRoles(guild.id);
  const modRoles = [...guild.modRoleIds, ...reviewerRoleIds];
  if (fromLogin && modRoles.length > 0 && !session.demo) {
    const roles = await fetchMemberRoleIds(guild.id, session.userId);
    if (roles.some((r) => modRoles.includes(r))) return 'mod';
  }
  return null;
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
