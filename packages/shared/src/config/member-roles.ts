import { dangerousIn, DANGEROUS_PERMS } from './permissions-check.js';

/**
 * Mitglieder verwalten (Issue #7/#8): Rollen zuweisen mit Warnung.
 * Prüft, welche Rollen sich überhaupt ändern lassen (Discord-Hierarchie) und welche gefährlichen Rechte dazukommen.
 */
export interface RoleInfo {
  id: string;
  name: string;
  position: number;
  /** Rechte als Bitfeld (Dezimal-String) */
  permissions?: string;
  managed: boolean;
}

export interface RoleWarning {
  roleId: string;
  roleName: string;
  perms: { label: string; why: string }[];
}

export interface RoleChangePlan {
  add: string[];
  remove: string[];
  /** Gewünschte Änderungen, die nicht gehen (mit Grund) */
  blocked: { roleId: string; roleName: string; why: string }[];
  /** Neue Rollen mit gefährlichen Rechten – vor dem Speichern bestätigen */
  warnings: RoleWarning[];
  /** Administrator-Rolle vergeben: nur der Server-Owner (bzw. Generalschlüssel) */
  needsOwner: boolean;
}

/**
 * Warum lässt sich diese Rolle nicht vergeben/entfernen? null = geht.
 * botTop/actorTop = Position der höchsten Rolle von Bot bzw. handelnder Person (actorTop null = Server-Owner, darf alles unter dem Bot).
 */
export function roleBlockReason(role: RoleInfo, guildId: string, botTop: number, actorTop: number | null): string | null {
  if (role.id === guildId) return '@everyone hat jeder';
  if (role.managed) return 'wird von Discord verwaltet (Bot-, Booster- oder Abo-Rolle)';
  if (role.position >= botTop) return 'steht über der Rolle des Bots – in Discord die Bot-Rolle weiter nach oben ziehen';
  if (actorTop !== null && role.position >= actorTop) return 'steht über deiner höchsten Rolle';
  return null;
}

export function roleWarning(role: RoleInfo): RoleWarning | null {
  const perms = dangerousIn(role.permissions ?? '0').map(({ label, why }) => ({ label, why }));
  return perms.length ? { roleId: role.id, roleName: role.name, perms } : null;
}

export function planRoleChange(input: { guildId: string; current: readonly string[]; wanted: readonly string[]; roles: readonly RoleInfo[]; botTop: number; actorTop: number | null }): RoleChangePlan {
  const { guildId, roles, botTop, actorTop } = input;
  const byId = new Map(roles.map((r) => [r.id, r]));
  const current = new Set(input.current.filter((id) => byId.has(id)));
  const wanted = new Set(input.wanted.filter((id) => byId.has(id)));
  const plan: RoleChangePlan = { add: [], remove: [], blocked: [], warnings: [], needsOwner: false };
  const check = (id: string, list: string[]) => {
    const role = byId.get(id)!;
    const why = roleBlockReason(role, guildId, botTop, actorTop);
    if (why) plan.blocked.push({ roleId: id, roleName: role.name, why });
    else list.push(id);
  };
  for (const id of wanted) if (!current.has(id)) check(id, plan.add);
  for (const id of current) if (!wanted.has(id)) check(id, plan.remove);
  for (const id of plan.add) {
    const role = byId.get(id)!;
    const warning = roleWarning(role);
    if (warning) plan.warnings.push(warning);
    if (actorTop !== null && warning?.perms.some((p) => p.label === DANGEROUS_PERMS[0]!.label)) plan.needsOwner = true;
  }
  return plan;
}

/**
 * Wie Discord (Bug-Hunting Runde 3): Niemand verteilt Rechte, die er selbst nicht hat – außer mit Administrator.
 * Dazu braucht man „Rollen verwalten“. Der Server-Owner darf immer (wird vorher geprüft).
 */
export function canGrantPermissions(actorBits: bigint, roleBits: bigint): { ok: boolean; why?: string } {
  const ADMIN = 1n << 3n;
  const MANAGE_ROLES = 1n << 28n;
  if ((actorBits & ADMIN) !== 0n) return { ok: true };
  if ((actorBits & MANAGE_ROLES) === 0n) return { ok: false, why: 'Dafür brauchst du in Discord das Recht „Rollen verwalten“.' };
  const missing = roleBits & ~actorBits;
  return missing === 0n ? { ok: true } : { ok: false, why: 'Diese Rolle hätte Rechte, die du selbst nicht hast – das lässt auch Discord nicht zu.' };
}
