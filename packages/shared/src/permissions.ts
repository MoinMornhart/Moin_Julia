/** Discord-Rechte-Bits, die das Dashboard für die Rechte-Stufen braucht */
const ADMINISTRATOR = 0x8n;
const MANAGE_GUILD = 0x20n;

export function hasManagePermission(permissions: string | bigint): boolean {
  const bits = BigInt(permissions);
  return (bits & ADMINISTRATOR) !== 0n || (bits & MANAGE_GUILD) !== 0n;
}

/**
 * Hat ein Mitglied – nach seinen aktuellen Rollen – „Administrator“ oder „Server verwalten“?
 * @everyone zählt mit (Rollen-ID = Server-ID). null = Rechte unbekannt (Rolle ohne Angabe).
 */
export function isGuildManager(guildId: string, memberRoleIds: readonly string[], roles: readonly { id: string; permissions?: string }[]): boolean | null {
  const mine = new Set([guildId, ...memberRoleIds]);
  const relevant = roles.filter((r) => mine.has(r.id));
  if (relevant.some((r) => r.permissions === undefined)) return null;
  return hasManagePermission(relevant.reduce((acc, r) => acc | BigInt(r.permissions!), 0n));
}

/**
 * Admin im Dashboard? Live-Stand von Discord gewinnt (in beide Richtungen: Rechte entzogen ODER erst nach
 * dem Login bekommen). Nur wenn Discord gerade nicht antwortet (null), zählt der Stand vom Login.
 */
export function decideAdmin(adminAtLogin: boolean, live: boolean | null): boolean {
  return live === true || (live === null && adminAtLogin);
}
