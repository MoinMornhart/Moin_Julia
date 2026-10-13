import { dangerousIn } from './permissions-check.js';

/**
 * Ränge-Fixer (Issue #8): Reihenfolge der Rollen sinnvoll sortieren und Positionen für Discord ausrechnen.
 * Nur Rollen unter der Bot-Rolle lassen sich verschieben – alles darüber bleibt, wo es ist.
 */
export interface FixerRole {
  id: string;
  name: string;
  position: number;
  permissions?: string;
  managed: boolean;
  hoist?: boolean;
}

export type RankGroup = 'admin' | 'team' | 'bot' | 'special' | 'member';

export const RANK_GROUP_LABELS: Record<RankGroup, string> = {
  admin: '👑 Admins (Administrator)',
  team: '🛡️ Team (Moderations-Rechte)',
  bot: '🤖 Bots',
  special: '⭐ Besondere Ränge (getrennt angezeigt)',
  member: '👤 Mitglieder und Deko',
};
const ORDER: RankGroup[] = ['admin', 'team', 'bot', 'special', 'member'];

export function rankGroup(role: FixerRole): RankGroup {
  const d = dangerousIn(role.permissions ?? '0');
  if (d.some((p) => p.name === 'Administrator')) return 'admin';
  if (role.managed) return 'bot';
  if (d.some((p) => ['BanMembers', 'KickMembers', 'ModerateMembers', 'ManageMessages', 'ManageRoles', 'ManageChannels', 'ManageGuild'].includes(p.name))) return 'team';
  if (role.hoist) return 'special';
  return 'member';
}

/** Vorschlag: oben nach unten Admins → Team → Bots → Besondere → Mitglieder; innerhalb einer Gruppe bleibt die Reihenfolge */
export function suggestOrder<T extends FixerRole>(roles: readonly T[]): T[] {
  const sorted = [...roles].sort((a, b) => b.position - a.position);
  return ORDER.flatMap((g) => sorted.filter((r) => rankGroup(r) === g));
}

/**
 * Neue Reihenfolge (oben → unten) in Discord-Positionen umrechnen: Die Rollen bekommen genau die Plätze,
 * die sie vorher zusammen belegt haben – unverschiebbare Rollen bleiben unberührt.
 */
export function orderToPositions(current: readonly FixerRole[], newOrderIds: readonly string[]): { id: string; position: number }[] | null {
  const byId = new Map(current.map((r) => [r.id, r]));
  if (newOrderIds.length !== current.length || new Set(newOrderIds).size !== newOrderIds.length || newOrderIds.some((id) => !byId.has(id))) return null;
  const slots = current.map((r) => r.position).sort((a, b) => b - a);
  return newOrderIds.map((id, i) => ({ id, position: slots[i]! })).filter(({ id, position }) => byId.get(id)!.position !== position);
}

/** Hinweise zur Reihenfolge: z. B. Team-Rolle unter einer normalen Rolle, gefährliche Rechte bei Deko-Rollen */
export function orderWarnings(rolesTopDown: readonly FixerRole[]): string[] {
  const out: string[] = [];
  const groups = rolesTopDown.map((r) => ORDER.indexOf(rankGroup(r)));
  rolesTopDown.forEach((r, i) => {
    const lowerAbove = rolesTopDown.slice(0, i).find((_, j) => groups[j]! > groups[i]!);
    if (lowerAbove && (rankGroup(r) === 'admin' || rankGroup(r) === 'team')) out.push(`„${r.name}“ hat Team-Rechte, steht aber unter „${lowerAbove.name}“ – „Sinnvoll sortieren“ schiebt sie nach oben.`);
  });
  return out.slice(0, 10);
}
