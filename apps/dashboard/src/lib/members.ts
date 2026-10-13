import 'server-only';
import type { RoleInfo } from '@moin/shared';
import { DEMO_GUILD_ID } from './demo';
import { botApi, botRest, fetchGuildRoles, fetchMemberRoleIds } from './discord';
import { cacheDel, cacheGet, cacheSet } from './redis';

/**
 * Mitglieder verwalten (Issue #7/#8): Liste wie in Discord (Name, Beitritt, Rollen) und Rollen zuweisen.
 * Braucht wie die Mitglieder-Suche den „Server Members Intent“ des Bots.
 */
export interface MemberRow {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  /** ISO-Datum */
  joinedAt: string | null;
  roles: string[];
}

type RawMemberFull = {
  user: { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean };
  nick?: string | null;
  avatar?: string | null;
  joined_at?: string | null;
  roles: string[];
};

const DEMO_ROWS: MemberRow[] = [
  { id: '100000000000000300', name: 'Anna', username: 'anna', avatar: null, joinedAt: '2025-03-14T18:00:00.000Z', roles: ['100000000000000012'] },
  { id: '100000000000000301', name: 'lukas.gamer', username: 'lukas.gamer', avatar: null, joinedAt: '2026-09-30T10:00:00.000Z', roles: [] },
  { id: '100000000000000302', name: 'ben.plays', username: 'ben.plays', avatar: null, joinedAt: '2026-01-02T12:00:00.000Z', roles: ['100000000000000014'] },
  { id: '100000000000000303', name: 'Ozzy', username: 'ozzy', avatar: null, joinedAt: '2024-11-20T20:00:00.000Z', roles: ['100000000000000013', '100000000000000015'] },
  { id: '100000000000000304', name: 'MoinMornhart', username: 'moinmornhart', avatar: null, joinedAt: '2024-06-01T09:00:00.000Z', roles: ['100000000000000011'] },
  { id: '100000000000000305', name: 'Der Ozelot', username: 'katze', avatar: null, joinedAt: '2026-10-10T16:00:00.000Z', roles: [] },
];
const demoKey = (guildId: string) => `moin:demo:memberroles:${guildId}`;
const listKey = (guildId: string) => `moin:dash:memberlist:${guildId}`;

/** Alle Mitglieder (ohne Bots) mit Rollen und Beitritt – 60 s zwischengespeichert */
export async function fetchMemberRows(guildId: string): Promise<MemberRow[]> {
  if (guildId === DEMO_GUILD_ID) {
    const overrides = (await cacheGet<Record<string, string[]>>(demoKey(guildId))) ?? {};
    return DEMO_ROWS.map((m) => ({ ...m, roles: overrides[m.id] ?? m.roles }));
  }
  const cached = await cacheGet<MemberRow[]>(listKey(guildId));
  if (cached) return cached;
  const out: MemberRow[] = [];
  let after = '0';
  for (let page = 0; page < 10; page++) {
    const batch = await botApi<RawMemberFull[]>(`/guilds/${guildId}/members?limit=1000&after=${after}`);
    for (const m of batch) {
      if (m.user.bot) continue;
      out.push({
        id: m.user.id,
        name: m.nick || m.user.global_name || m.user.username,
        username: m.user.username,
        avatar: m.avatar ? `https://cdn.discordapp.com/guilds/${guildId}/users/${m.user.id}/avatars/${m.avatar}.png?size=64` : m.user.avatar ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png?size=64` : null,
        joinedAt: m.joined_at ?? null,
        roles: m.roles,
      });
    }
    if (batch.length < 1000) break;
    after = batch.at(-1)!.user.id;
  }
  await cacheSet(listKey(guildId), out, 60);
  return out;
}

/** Rollen des Servers als RoleInfo (für die Prüfung) */
export async function roleInfos(guildId: string): Promise<(RoleInfo & { color: number })[]> {
  const roles = await fetchGuildRoles(guildId);
  return roles.map((r) => ({ id: r.id, name: r.name, position: r.position, permissions: r.permissions ?? '0', managed: r.managed, color: r.color }));
}

/** Höchste Rollen-Position einer Person (ohne Rollen: 0) */
async function topPosition(guildId: string, userId: string, roles: readonly RoleInfo[]): Promise<number> {
  const ids = new Set(await fetchMemberRoleIds(guildId, userId));
  return Math.max(0, ...roles.filter((r) => ids.has(r.id)).map((r) => r.position));
}

let botUserId: string | null = null;
/** Position der höchsten Bot-Rolle: nur Rollen darunter kann der Bot vergeben */
export async function botTopPosition(guildId: string, roles: readonly RoleInfo[]): Promise<number> {
  if (guildId === DEMO_GUILD_ID) return 100;
  botUserId ??= (await botApi<{ id: string }>('/users/@me')).id;
  return topPosition(guildId, botUserId, roles);
}

/** Höchste Rolle der handelnden Person – null = darf alles unter dem Bot (Server-Owner, Generalschlüssel) */
export async function actorTopPosition(guildId: string, userId: string, isOwner: boolean, roles: readonly RoleInfo[]): Promise<number | null> {
  if (isOwner || guildId === DEMO_GUILD_ID) return null;
  return topPosition(guildId, userId, roles);
}

/** Aktuelle Rollen einer Person – frisch von Discord */
export async function currentMemberRoles(guildId: string, userId: string): Promise<string[]> {
  if (guildId === DEMO_GUILD_ID) return (await fetchMemberRows(guildId)).find((m) => m.id === userId)?.roles ?? [];
  return (await botApi<{ roles: string[] }>(`/guilds/${guildId}/members/${userId}`)).roles;
}

/** Rollen setzen: einzeln hinzufügen/entfernen (Grund steht im Discord-Audit-Log) */
export async function applyMemberRoles(guildId: string, userId: string, add: readonly string[], remove: readonly string[], reason: string): Promise<{ failed: number }> {
  if (guildId === DEMO_GUILD_ID) {
    const overrides = (await cacheGet<Record<string, string[]>>(demoKey(guildId))) ?? {};
    const now = new Set(await currentMemberRoles(guildId, userId));
    for (const id of add) now.add(id);
    for (const id of remove) now.delete(id);
    overrides[userId] = [...now];
    await cacheSet(demoKey(guildId), overrides, 24 * 3600);
    return { failed: 0 };
  }
  let failed = 0;
  for (const id of add) await botRest('PUT', `/guilds/${guildId}/members/${userId}/roles/${id}`, undefined, reason).catch(() => failed++);
  for (const id of remove) await botRest('DELETE', `/guilds/${guildId}/members/${userId}/roles/${id}`, undefined, reason).catch(() => failed++);
  // Listen neu laden lassen
  await cacheDel(listKey(guildId));
  await cacheDel(`moin:dash:member:${guildId}:${userId}`);
  return { failed };
}
