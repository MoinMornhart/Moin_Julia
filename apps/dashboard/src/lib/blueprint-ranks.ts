import 'server-only';
import { blueprintRoleBody, getBlueprint, roleNeedsUpdate, withExtraRanks, type ExtraRank, type ServerBlueprint } from '@moin/shared';
import type { Prisma } from '@moin/db';
import { db } from './db';
import { DEMO_GUILD_ID } from './demo';
import { botRest } from './discord';
import type { ProfileCreated } from './profiles';

/**
 * Eigene Ränge in Server-Vorlagen (Wunsch Philip, 14.10.): Ränge aus dem Dashboard einer Vorlage hinzufügen;
 * Server mit diesem Profil werden danach aktualisiert. Gilt für alle Server der Instanz – darum ändert die
 * Vorlagen nur der Instanz-Admin; „Profil aktualisieren“ darf jeder Owner/Admin für seinen Server.
 */

export async function extraRanks(blueprintId?: string): Promise<ExtraRank[]> {
  const rows = await db().blueprintRank.findMany({ where: blueprintId ? { blueprintId } : {}, orderBy: { createdAt: 'asc' } });
  return rows.map((r) => ({ id: r.id, blueprintId: r.blueprintId, name: r.name, color: r.color, permissions: r.permissions, hoist: r.hoist, mentionable: r.mentionable }));
}

/** Vorlage inklusive eigener Ränge */
export async function effectiveBlueprint(blueprintId: string): Promise<ServerBlueprint | undefined> {
  const base = getBlueprint(blueprintId);
  return base ? withExtraRanks(base, await extraRanks(blueprintId)) : undefined;
}

type RawRole = { id: string; name: string; color: number; permissions: string; hoist: boolean; mentionable: boolean; managed: boolean };

export interface SyncResult {
  created: number;
  updated: number;
  failed: number;
}

/**
 * Aktives Profil eines Servers an die Vorlage angleichen:
 * fehlende Rollen anlegen; vom Profil angelegte eigene Ränge an geänderte Farbe/Rechte anpassen.
 * Vorhandene, nicht vom Profil angelegte Rollen werden nie verändert, nichts wird gelöscht.
 */
export async function syncProfileRoles(guildId: string, username: string): Promise<SyncResult | null> {
  const profile = await db().serverProfile.findFirst({ where: { guildId, active: true }, orderBy: { createdAt: 'desc' } });
  if (!profile) return null;
  const blueprint = await effectiveBlueprint(profile.blueprintId);
  if (!blueprint) return null;
  const created = { roleIds: [], channelIds: [], newModules: [], ...((profile.created ?? {}) as Partial<ProfileCreated>) } as ProfileCreated & { demoNames?: string[] };
  const demo = guildId === DEMO_GUILD_ID;
  // Demo: Bauplan-Rollen gibt es schon, eigene Ränge, die einmal „angelegt“ wurden, auch
  const demoRole = (name: string): RawRole => ({ id: `demo-${name}`, name, color: 0, permissions: '0', hoist: false, mentionable: false, managed: false });
  const roles = demo ? [...blueprint.roles.filter((r) => !r.rankId).map((r) => r.name), ...(created.demoNames ?? [])].map(demoRole) : ((await botRest<RawRole[]>('GET', `/guilds/${guildId}/roles`)) ?? []).filter((r) => r.id !== guildId && !r.managed);
  const reason = `Server-Profil „${blueprint.name}“ aktualisiert (Dashboard, ${username})`;
  const result: SyncResult = { created: 0, updated: 0, failed: 0 };
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  for (const role of blueprint.roles) {
    const body = blueprintRoleBody(role);
    const existing = roles.find((r) => same(r.name, role.name));
    try {
      if (!existing) {
        const id = demo ? `9${Date.now().toString().slice(-9)}${String(result.created).padStart(8, '0')}`.slice(0, 18) : (await botRest<{ id: string }>('POST', `/guilds/${guildId}/roles`, body, reason))!.id;
        if (demo) created.demoNames = [...(created.demoNames ?? []), role.name];
        created.roleIds.push(id);
        result.created++;
      } else if (role.rankId && created.roleIds.includes(existing.id) && roleNeedsUpdate(existing, body)) {
        await botRest('PATCH', `/guilds/${guildId}/roles/${existing.id}`, { color: body.color, permissions: body.permissions, hoist: body.hoist, mentionable: body.mentionable }, reason);
        result.updated++;
      }
    } catch {
      result.failed++; // z. B. Rolle über der Bot-Rolle oder fehlendes Recht
    }
  }
  await db().serverProfile.update({ where: { id: profile.id }, data: { created: created as unknown as Prisma.InputJsonValue } });
  return result;
}

/** Alle Server mit diesem Profil aktualisieren (nach dem Ändern der Vorlage) */
export async function syncBlueprintEverywhere(blueprintId: string, username: string): Promise<{ servers: number } & SyncResult> {
  const profiles = await db().serverProfile.findMany({ where: { blueprintId, active: true }, select: { guildId: true } });
  const total = { servers: 0, created: 0, updated: 0, failed: 0 };
  for (const { guildId } of profiles) {
    const guild = await db().guild.findUnique({ where: { id: guildId } });
    if (!guild?.botPresent) continue;
    const r = await syncProfileRoles(guildId, username).catch(() => null);
    if (!r) continue;
    total.servers++;
    total.created += r.created;
    total.updated += r.updated;
    total.failed += r.failed;
  }
  return total;
}
