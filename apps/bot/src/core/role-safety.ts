import { PermissionFlagsBits, type Guild, type Role } from 'discord.js';
import type { Logger } from 'pino';

/**
 * Schutz vor Rechte-Ausweitung: Rollen, die Moin_Julia „automatisch“ vergibt (Rollen-Panels, Auto-Rollen,
 * Verifizierung, Level, Geburtstag, Live-Rolle, eigene Sprachkanäle), dürfen keine gefährlichen Rechte haben.
 * Sonst könnte jemand mit „Server verwalten“ im Dashboard die Admin-Rolle in ein Panel legen und sie sich holen –
 * Moin_Julia würde sie mit ihren eigenen Rechten vergeben.
 */
export const SELF_SERVICE_FORBIDDEN =
  PermissionFlagsBits.Administrator |
  PermissionFlagsBits.ManageGuild |
  PermissionFlagsBits.ManageRoles |
  PermissionFlagsBits.ManageChannels |
  PermissionFlagsBits.ManageWebhooks |
  PermissionFlagsBits.BanMembers |
  PermissionFlagsBits.KickMembers |
  PermissionFlagsBits.ModerateMembers |
  PermissionFlagsBits.ManageMessages |
  PermissionFlagsBits.MentionEveryone |
  PermissionFlagsBits.MuteMembers |
  PermissionFlagsBits.DeafenMembers |
  PermissionFlagsBits.MoveMembers |
  PermissionFlagsBits.ManageNicknames |
  PermissionFlagsBits.ManageThreads |
  PermissionFlagsBits.ManageGuildExpressions |
  PermissionFlagsBits.ManageEvents |
  PermissionFlagsBits.ViewAuditLog;

/**
 * Für Bewerbungen (Team): Moderations-Rechte sind dort gewollt (z. B. Stelle „Moderator“),
 * aber keine Rechte, mit denen man sich selbst alles geben kann.
 */
export const STAFF_FORBIDDEN = PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles | PermissionFlagsBits.ManageWebhooks;

export function isRoleSafe(role: Pick<Role, 'permissions'> | undefined | null, forbidden: bigint): boolean {
  if (!role) return false;
  const bits = role.permissions?.bitfield;
  // Ohne Rechte-Angabe (nur in Test-Attrappen) nicht blockieren
  if (bits === undefined) return true;
  return (BigInt(bits) & forbidden) === 0n;
}

/**
 * Geschützte Rollen pro Server (Moderation → „Geschützte Kanäle & Rollen“, Issue #5): Diese gibt Moin_Julia
 * nie per Selbstbedienung heraus – auch wenn die Rolle selbst keine gefährlichen Rechte hat.
 * Ausnahme: Bewerbungen (STAFF_FORBIDDEN) – dort entscheidet das Team bewusst über eine Team-Rolle.
 */
const protectedRoles = new Map<string, Set<string>>();
export function setProtectedRoles(guildId: string, ids: readonly string[]): void {
  if (ids.length) protectedRoles.set(guildId, new Set(ids));
  else protectedRoles.delete(guildId);
}
export function isProtectedRole(guildId: string, roleId: string): boolean {
  return protectedRoles.get(guildId)?.has(roleId) ?? false;
}

/** Nur die ungefährlichen Rollen zurückgeben; blockierte werden geloggt */
export function safeRoleIds(guild: Guild, ids: readonly string[], forbidden: bigint, logger?: Logger, context = 'Rollen'): string[] {
  const ok: string[] = [];
  for (const id of ids) {
    if (forbidden !== STAFF_FORBIDDEN && isProtectedRole(guild.id, id)) {
      logger?.warn({ guildId: guild.id, roleId: id, context }, 'Geschützte Rolle wird nicht per Selbstbedienung vergeben');
      continue;
    }
    const role = guild.roles.cache.get(id);
    if (role && !isRoleSafe(role, forbidden)) {
      logger?.warn({ guildId: guild.id, roleId: id, roleName: role.name, context }, 'Rolle mit gefährlichen Rechten wird nicht automatisch vergeben');
      continue;
    }
    ok.push(id);
  }
  return ok;
}
