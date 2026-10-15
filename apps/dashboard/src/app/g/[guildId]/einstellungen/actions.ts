'use server';

import { revalidatePath } from 'next/cache';
import { parseSupportScopes, SUPPORT_DURATIONS, supportAccessKey, supportBlockKey, supportRequestKey, type SupportAccess, type SupportDuration, type SupportRequest } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { cacheDel, cacheGet, storeJson } from '@/lib/redis';
import { updateGuildBotProfile, validImage } from '@/lib/botProfile';

export interface GuildBotProfileInput {
  nick: string;
  /** undefined = unverändert */
  bio?: string;
  /** undefined = unverändert, null = entfernen, Data-URL = neues Bild */
  avatar?: string | null;
  banner?: string | null;
}

/** Profil des Bots nur auf diesem Server (Spitzname, Bild, Banner, Bio). */
export async function saveGuildBotProfile(guildId: string, input: GuildBotProfileInput): Promise<{ ok: boolean; messages: string[] }> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, messages: ['Nur Owner und Admins.'] };
  const nick = input.nick.trim();
  if (nick.length > 32) return { ok: false, messages: ['Der Spitzname darf höchstens 32 Zeichen haben.'] };
  if (input.bio !== undefined && input.bio.length > 190) return { ok: false, messages: ['Die Bio darf höchstens 190 Zeichen haben.'] };
  if (!validImage(input.avatar) || !validImage(input.banner)) return { ok: false, messages: ['Bilder bitte als PNG, JPG, GIF oder WebP bis 10 MB.'] };
  try {
    return { ok: true, messages: [await updateGuildBotProfile(guildId, { nick, bio: input.bio, avatar: input.avatar, banner: input.banner })] };
  } catch (error) {
    return { ok: false, messages: [error instanceof Error ? error.message : 'Discord nicht erreichbar.'] };
  }
}

/**
 * Betreiber-Zugang verwalten (Issue #13): nur echte Owner/Admins des Servers – nie der Betreiber selbst über seine Freigabe.
 */
async function ownerOrAdmin(guildId: string) {
  const access = await requireGuildAccess(guildId);
  if (access.viaMaster || (access.level !== 'owner' && access.level !== 'admin')) return null;
  return access;
}

export async function grantOperator(guildId: string, scopesRaw: string[], duration: string): Promise<{ ok: boolean; message: string }> {
  const access = await ownerOrAdmin(guildId);
  if (!access) return { ok: false, message: 'Das entscheiden nur Owner und Admins.' };
  const scopes = parseSupportScopes(scopesRaw);
  if (!scopes || !(duration in SUPPORT_DURATIONS)) return { ok: false, message: 'Bitte Umfang und Dauer wählen.' };
  const request = await cacheGet<SupportRequest>(supportRequestKey(guildId));
  const ms = SUPPORT_DURATIONS[duration as SupportDuration];
  const grant: SupportAccess = { by: access.session.userId, byName: access.session.username, since: Date.now(), until: ms === null ? null : Date.now() + ms, scopes, reason: request?.reason };
  await storeJson(supportAccessKey(guildId), grant, ms === null ? 0 : Math.ceil(ms / 1000));
  await cacheDel(supportRequestKey(guildId));
  revalidatePath(`/g/${guildId}`, 'layout');
  return { ok: true, message: 'Freigegeben.' };
}

export async function revokeOperator(guildId: string): Promise<{ ok: boolean; message: string }> {
  if (!(await ownerOrAdmin(guildId))) return { ok: false, message: 'Das entscheiden nur Owner und Admins.' };
  await cacheDel(supportAccessKey(guildId));
  revalidatePath(`/g/${guildId}`, 'layout');
  return { ok: true, message: 'Zugang entzogen.' };
}

export async function setOperatorBlocked(guildId: string, blocked: boolean): Promise<{ ok: boolean; message: string }> {
  const access = await ownerOrAdmin(guildId);
  if (!access) return { ok: false, message: 'Das entscheiden nur Owner und Admins.' };
  if (blocked) {
    await storeJson(supportBlockKey(guildId), { by: access.session.userId, at: Date.now() });
    await cacheDel(supportAccessKey(guildId));
    await cacheDel(supportRequestKey(guildId));
  } else await cacheDel(supportBlockKey(guildId));
  revalidatePath(`/g/${guildId}`, 'layout');
  return { ok: true, message: blocked ? 'Betreiber gesperrt – kein Zugang, keine Anfragen.' : 'Sperre aufgehoben.' };
}

export async function denyOperatorRequest(guildId: string): Promise<{ ok: boolean; message: string }> {
  if (!(await ownerOrAdmin(guildId))) return { ok: false, message: 'Das entscheiden nur Owner und Admins.' };
  await cacheDel(supportRequestKey(guildId));
  revalidatePath(`/g/${guildId}/einstellungen`);
  return { ok: true, message: 'Anfrage abgelehnt.' };
}
