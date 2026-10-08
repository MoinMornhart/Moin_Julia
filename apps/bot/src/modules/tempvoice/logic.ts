import type { TempVoiceConfig, TempVoiceHub } from '@moin/shared';

/** Ist dieser Kanal ein Erstell-Kanal („➕ Kanal erstellen“)? */
export function hubFor(config: TempVoiceConfig, channelId: string | null | undefined): TempVoiceHub | undefined {
  return channelId ? config.hubs.find((h) => h.channelId === channelId) : undefined;
}

/** Was passiert, wenn jemand einem Erstell-Kanal beitritt? Wer schon einen Kanal hat, kommt dorthin zurück. */
export function joinDecision(existing: { channelId: string; exists: boolean } | null): { kind: 'create' } | { kind: 'move'; channelId: string } {
  return existing?.exists ? { kind: 'move', channelId: existing.channelId } : { kind: 'create' };
}

/** Nur Besitzer:in darf steuern – „Übernehmen“ geht für alle, wenn Besitzer:in nicht mehr drin ist. */
export function mayControl(action: string, ownerId: string, userId: string, ownerInChannel: boolean): 'ok' | 'not-owner' | 'owner-here' {
  if (action === 'claim') return ownerInChannel ? (ownerId === userId ? 'ok' : 'owner-here') : 'ok';
  return ownerId === userId ? 'ok' : 'not-owner';
}

/** Limit aus dem Formular: 0–99, sonst ungültig */
export function parseLimit(raw: string): number | null {
  if (!/^\s*\d{1,2}\s*$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  return n >= 0 && n <= 99 ? n : null;
}

/**
 * Besitzer-Rollen (Rolle geben UND entziehen): Wer einen eigenen Kanal besitzt, bekommt sie;
 * wer keinen mehr besitzt, verliert sie wieder.
 */
export function ownerRoleChanges(roleIds: string[], ownsChannel: boolean, memberRoleIds: string[], serverRoleIds: string[]): { add: string[]; remove: string[] } {
  const exists = new Set(serverRoleIds);
  const has = new Set(memberRoleIds);
  const roles = roleIds.filter((r) => exists.has(r));
  return ownsChannel ? { add: roles.filter((r) => !has.has(r)), remove: [] } : { add: [], remove: roles.filter((r) => has.has(r)) };
}
