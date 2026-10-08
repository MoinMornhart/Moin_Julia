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
  if (fromLogin && guild.modRoleIds.length > 0 && !session.demo) {
    const roles = await fetchMemberRoleIds(guild.id, session.userId);
    if (roles.some((r) => guild.modRoleIds.includes(r))) return 'mod';
  }
  return null;
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
