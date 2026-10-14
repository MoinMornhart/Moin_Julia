'use server';

import { revalidatePath } from 'next/cache';
import { canGrantPermissions, planRoleChange, type RoleWarning } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { actorTopPosition, applyMemberRoles, botTopPosition, currentMemberRoles, memberPermissions, memberTopPosition, roleInfos } from '@/lib/members';

export interface SetRolesResult {
  ok: boolean;
  message: string;
  /** Erst bestätigen: diese gefährlichen Rechte kämen dazu */
  confirm?: RoleWarning[];
  /** Rollen der Person nach dem Speichern */
  roles?: string[];
}

/**
 * Rollen einer Person setzen (gewünschte Endliste). Gefährliche Rechte → erst Warnung, dann mit confirmed=true.
 * Administrator-Rollen vergibt nur der Server-Owner (oder der Instanz-Admin mit Generalschlüssel).
 */
export async function setMemberRoles(guildId: string, userId: string, wanted: string[], confirmed: boolean): Promise<SetRolesResult> {
  const { session, guild, canEdit, viaMaster } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins dürfen Rollen vergeben.' };
  if (!/^\d{15,22}$/.test(userId) || !Array.isArray(wanted) || wanted.length > 250) return { ok: false, message: 'Ungültige Angaben.' };
  try {
    const roles = await roleInfos(guildId);
    const isOwner = viaMaster || guild.ownerId === session.userId;
    const [botTop, actorTop, current] = await Promise.all([botTopPosition(guildId, roles), actorTopPosition(guildId, session.userId, isOwner, roles), currentMemberRoles(guildId, userId)]);
    const plan = planRoleChange({ guildId, current, wanted: wanted.filter((id) => typeof id === 'string'), roles, botTop, actorTop });
    if (plan.needsOwner) return { ok: false, message: 'Rollen mit „Administrator“ vergibt nur der Server-Owner.' };
    if (!isOwner && (plan.add.length || plan.remove.length)) {
      // Wie in Discord: nur Leute unter dir, und nur Rechte, die du selbst hast (Runde 3)
      if (userId !== session.userId && actorTop !== null && (await memberTopPosition(guildId, userId)) >= actorTop) return { ok: false, message: 'Diese Person steht gleich hoch oder über dir – ihre Rollen kannst du nicht ändern.' };
      const mine = await memberPermissions(guildId, session.userId);
      for (const id of plan.add) {
        const grant = canGrantPermissions(mine, BigInt(roles.find((r) => r.id === id)?.permissions ?? '0'));
        if (!grant.ok) return { ok: false, message: grant.why! };
      }
      if (plan.remove.length && (mine & ((1n << 3n) | (1n << 28n))) === 0n) return { ok: false, message: 'Dafür brauchst du in Discord das Recht „Rollen verwalten“.' };
    }
    if (plan.blocked.length && !plan.add.length && !plan.remove.length) return { ok: false, message: `Geht nicht: ${plan.blocked.map((b) => `„${b.roleName}“ ${b.why}`).join('; ')}.` };
    if (!plan.add.length && !plan.remove.length) return { ok: true, message: 'Nichts geändert.' };
    if (plan.warnings.length && !confirmed) return { ok: false, message: 'Bitte bestätigen: Die Person bekommt dadurch gefährliche Rechte.', confirm: plan.warnings };
    const { failed } = await applyMemberRoles(guildId, userId, plan.add, plan.remove, `Dashboard (${session.username})`);
    revalidatePath(`/g/${guildId}/mitglieder`);
    const parts = [plan.add.length ? `${plan.add.length} Rolle(n) gegeben` : '', plan.remove.length ? `${plan.remove.length} entfernt` : ''].filter(Boolean).join(', ');
    const skipped = plan.blocked.length ? ` Übersprungen: ${plan.blocked.map((b) => `„${b.roleName}“ (${b.why})`).join('; ')}.` : '';
    const final = [...new Set([...current.filter((id) => !plan.remove.includes(id)), ...plan.add])];
    return { ok: failed === 0, roles: final, message: failed ? `${parts} – ${failed} Änderung(en) hat Discord abgelehnt.${skipped}` : `Gespeichert: ${parts}.${skipped}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Fehler' };
  }
}
