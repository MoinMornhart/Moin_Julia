'use server';

import { revalidatePath } from 'next/cache';
import { buildRankName, orderToPositions, RANK_PACKAGES, RANK_SEPARATORS, rankPermissions, roleBlockReason, type RankPackage } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { DEMO_GUILD_ID } from '@/lib/demo';
import { botRest } from '@/lib/discord';
import { actorTopPosition, botTopPosition, movableRoles, roleInfos } from '@/lib/members';
import { cacheDel } from '@/lib/redis';

export interface RankInput {
  emoji: string;
  separator: string;
  name: string;
  color: number;
  /** „unveraendert“ = Rechte beim Bearbeiten nicht anfassen */
  pkg: RankPackage | 'unveraendert';
  hoist: boolean;
  mentionable: boolean;
}

/** Eingaben aus dem Browser prüfen */
function clean(input: RankInput): { name: string; color: number; pkg: RankInput['pkg']; hoist: boolean; mentionable: boolean } | string {
  const separator = (RANK_SEPARATORS as readonly string[]).includes(input.separator) ? input.separator : ' ';
  const emoji = String(input.emoji ?? '').trim().slice(0, 16);
  const name = buildRankName(emoji, separator, String(input.name ?? '').replace(/[@#<>`]/g, ''));
  if (!name) return 'Bitte einen Namen eingeben.';
  const color = Number.isInteger(input.color) && input.color >= 0 && input.color <= 0xffffff ? input.color : 0;
  const pkg = input.pkg === 'unveraendert' || (RANK_PACKAGES as readonly string[]).includes(input.pkg) ? input.pkg : 'keine';
  return { name, color, pkg, hoist: !!input.hoist, mentionable: !!input.mentionable };
}

async function context(guildId: string) {
  const access = await requireGuildAccess(guildId);
  const isOwner = access.viaMaster || access.guild.ownerId === access.session.userId;
  return { ...access, isOwner };
}

/** Neuen Rang anlegen (Ränge-Baukasten, Issue #8) */
export async function createRank(guildId: string, input: RankInput): Promise<{ ok: boolean; message: string }> {
  const { session, canEdit, isOwner } = await context(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins dürfen Ränge anlegen.' };
  const c = clean(input);
  if (typeof c === 'string') return { ok: false, message: c };
  if (c.pkg === 'admin' && !isOwner) return { ok: false, message: 'Ränge mit Administrator-Rechten legt nur der Server-Owner an.' };
  const permissions = rankPermissions(c.pkg === 'unveraendert' ? 'keine' : c.pkg);
  if (guildId !== DEMO_GUILD_ID) {
    try {
      await botRest('POST', `/guilds/${guildId}/roles`, { name: c.name, color: c.color, permissions, hoist: c.hoist, mentionable: c.mentionable }, `Ränge-Baukasten (Dashboard, ${session.username})`);
    } catch (error) {
      const status = (error as { status?: number }).status;
      return { ok: false, message: status === 403 ? 'Discord hat abgelehnt: Dem Bot fehlt „Rollen verwalten“ oder er hat die Rechte des Pakets selbst nicht.' : 'Rang konnte nicht angelegt werden.' };
    }
    await cacheDel(`moin:dash:roles:${guildId}`);
  }
  revalidatePath(`/g/${guildId}/raenge`);
  return { ok: true, message: `Rang „${c.name}“ angelegt. Neue Rollen landen in Discord ganz unten – die Reihenfolge änderst du in Discord unter Server-Einstellungen → Rollen.` };
}

/** Vorhandenen Rang bearbeiten – nur Rollen unter der Bot-Rolle (und unter der eigenen höchsten Rolle) */
export async function updateRank(guildId: string, roleId: string, input: RankInput): Promise<{ ok: boolean; message: string }> {
  const { session, canEdit, isOwner } = await context(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins dürfen Ränge bearbeiten.' };
  const c = clean(input);
  if (typeof c === 'string') return { ok: false, message: c };
  if (c.pkg === 'admin' && !isOwner) return { ok: false, message: 'Administrator-Rechte vergibt nur der Server-Owner.' };
  const roles = await roleInfos(guildId);
  const role = roles.find((r) => r.id === roleId);
  if (!role) return { ok: false, message: 'Diese Rolle gibt es nicht (mehr).' };
  const [botTop, actorTop] = await Promise.all([botTopPosition(guildId, roles), actorTopPosition(guildId, session.userId, isOwner, roles)]);
  const blocked = roleBlockReason(role, guildId, botTop, actorTop);
  if (blocked) return { ok: false, message: `Geht nicht: Die Rolle ${blocked}.` };
  const body: Record<string, unknown> = { name: c.name, color: c.color, hoist: c.hoist, mentionable: c.mentionable };
  if (c.pkg !== 'unveraendert') body.permissions = rankPermissions(c.pkg);
  if (guildId !== DEMO_GUILD_ID) {
    try {
      await botRest('PATCH', `/guilds/${guildId}/roles/${roleId}`, body, `Ränge-Baukasten (Dashboard, ${session.username})`);
    } catch {
      return { ok: false, message: 'Discord hat die Änderung abgelehnt (Bot-Rechte?).' };
    }
    await cacheDel(`moin:dash:roles:${guildId}`);
  }
  revalidatePath(`/g/${guildId}/raenge`);
  return { ok: true, message: `Rang „${c.name}“ gespeichert.` };
}

/** Ränge-Fixer: neue Reihenfolge (oben → unten) der verschiebbaren Rollen speichern */
export async function setRoleOrder(guildId: string, orderIds: string[]): Promise<{ ok: boolean; message: string }> {
  const { session, canEdit, isOwner } = await context(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins dürfen die Reihenfolge ändern.' };
  if (!Array.isArray(orderIds) || orderIds.length > 250) return { ok: false, message: 'Ungültige Angaben.' };
  const roles = await roleInfos(guildId);
  const [botTop, actorTop] = await Promise.all([botTopPosition(guildId, roles), actorTopPosition(guildId, session.userId, isOwner, roles)]);
  const movable = movableRoles(roles, guildId, botTop, actorTop);
  const positions = orderToPositions(movable, orderIds);
  if (!positions) return { ok: false, message: 'Die Rollen haben sich inzwischen geändert – bitte Seite neu laden.' };
  if (!positions.length) return { ok: true, message: 'Reihenfolge ist schon so.' };
  if (guildId !== DEMO_GUILD_ID) {
    try {
      await botRest('PATCH', `/guilds/${guildId}/roles`, positions, `Ränge-Fixer (Dashboard, ${session.username})`);
    } catch {
      return { ok: false, message: 'Discord hat das Verschieben abgelehnt (Bot-Rechte?).' };
    }
    await cacheDel(`moin:dash:roles:${guildId}`);
  }
  revalidatePath(`/g/${guildId}/raenge`);
  return { ok: true, message: `Reihenfolge gespeichert (${positions.length} Rolle(n) verschoben).` };
}
