import 'server-only';
import { analyzeBlueprint, blueprintModuleConfigs, blueprintOverwrites, getBlueprint, type ProfileAnalysisItem, getModule, mergeConfig, MOD_PERMISSIONS, MODULE_CONFIG_PARSERS, templateFileSchema, type ServerBlueprint } from '@moin/shared';
import type { Prisma } from '@moin/db';
import { db } from './db';
import { DEMO_CHANNELS, DEMO_GUILD_ID, DEMO_ROLES } from './demo';
import { botRest, fetchGuildChannels, fetchGuildRoles } from './discord';
import { publishConfig } from './redis';
import { applyTemplate, exportGuild } from './templates';

/**
 * Server-Profile anwenden und wieder entfernen (Issue #5).
 * Anwenden: Sicherung → fehlende Rollen/Kategorien/Kanäle anlegen (vorhandene laut Auswahl übernehmen, Issue #7)
 * → Module einstellen → merken, was neu ist. Entfernen: Sicherung zurück, auf Wunsch Neues wieder löschen.
 */
export interface ProfileCreated {
  roleIds: string[];
  /** Kanäle zuerst, Kategorien zuletzt (Löschreihenfolge) */
  channelIds: string[];
  /** Module, die es vor dem Profil noch nicht gab – beim Entfernen wieder auf Standard */
  newModules: string[];
  /** Vorhandene Rollen, die das Profil angepasst hat – alter Stand zum Zurücksetzen (Issue #7) */
  adjusted?: AdjustedRole[];
}

export interface AdjustedRole {
  id: string;
  color: number;
  permissions: string;
  hoist: boolean;
}

/** Auswahl aus der Vorschau: pro Bauplan-Teil vorhandene ID (übernehmen) oder null (neu anlegen) */
export interface ProfileChoices {
  reuse: Record<string, string | null>;
  /** Übernommene Rollen an das Profil anpassen (Farbe; Team-Rollen bekommen fehlende Mod-Rechte dazu) */
  adjustRoles: boolean;
}

/** Was gibt es im Server schon? Vorschlag pro Rolle/Kategorie/Kanal für die Vorschau */
export async function analyzeProfile(guildId: string, blueprintId: string): Promise<ProfileAnalysisItem[]> {
  const blueprint = getBlueprint(blueprintId);
  if (!blueprint) throw new Error('Unbekanntes Profil.');
  const [roles, channels] = await Promise.all([fetchGuildRoles(guildId), fetchGuildChannels(guildId)]);
  return analyzeBlueprint(blueprint, roles, channels);
}

export interface ApplyProfileResult {
  created: { roles: number; channels: number };
  reused: { roles: number; channels: number };
  /** Angepasste vorhandene Rollen (und wie viele sich nicht anpassen ließen) */
  adjusted: { ok: number; failed: number };
  modules: string[];
}

type RawRole = { id: string; name: string; color: number; permissions: string; hoist: boolean; managed: boolean };
type RawChannel = { id: string; name: string; type: number; parent_id: string | null };

const fakeId = (n: number) => `7${Date.now().toString().slice(-9)}${String(n).padStart(8, '0')}`.slice(0, 18);

export async function applyProfile(guildId: string, blueprintId: string, userId: string, username: string, choices?: ProfileChoices): Promise<ApplyProfileResult> {
  const blueprint = getBlueprint(blueprintId);
  if (!blueprint) throw new Error('Unbekanntes Profil.');
  if (await db().serverProfile.findFirst({ where: { guildId, active: true } })) throw new Error('Es ist schon ein Profil aktiv – bitte erst deaktivieren.');

  const backup = await db().configBackup.create({
    data: { guildId, reason: `Vor Server-Profil „${blueprint.name}“`, createdBy: userId, data: (await exportGuild(guildId)) as unknown as Prisma.InputJsonValue },
  });

  const reason = `Server-Profil „${blueprint.name}“ (Dashboard, ${username})`;
  const ids: Record<string, string> = {};
  const created: ProfileCreated = { roleIds: [], channelIds: [], newModules: [], adjusted: [] };
  const reused = { roles: 0, channels: 0 };
  const adjustedCount = { ok: 0, failed: 0 };
  const createdCategories: string[] = [];
  const demo = guildId === DEMO_GUILD_ID;
  let n = 0;

  try {
    // Demo: ohne Auswahl wird alles neu „angelegt“ (wie bisher), mit Auswahl zählen die Demo-Rollen/-Kanäle als vorhanden
    const roles = (
      demo
        ? choices
          ? DEMO_ROLES.map((r) => ({ id: r.id, name: r.name, color: r.color, permissions: r.permissions ?? '0', hoist: false, managed: false }))
          : []
        : ((await botRest<RawRole[]>('GET', `/guilds/${guildId}/roles`)) ?? [])
    ).filter((r) => r.id !== guildId && !r.managed);
    const channels: RawChannel[] = demo ? (choices ? DEMO_CHANNELS.map((c) => ({ id: c.id, name: c.name, type: c.type, parent_id: null })) : []) : ((await botRest<RawChannel[]>('GET', `/guilds/${guildId}/channels`)) ?? []);
    const botId = demo ? null : ((await botRest<{ id: string }>('GET', '/users/@me'))?.id ?? null);
    const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
    // Mit Auswahl aus der Vorschau: gewählte ID nutzen (null = neu anlegen); sonst wie bisher gleicher Name
    const pick = <T extends { id: string }>(key: string, list: readonly T[], types: number[] | null, fallback: () => T | undefined): T | undefined => {
      if (!choices || !(key in choices.reuse)) return fallback();
      const id = choices.reuse[key];
      return id ? list.find((x) => x.id === id && (!types || types.includes((x as unknown as RawChannel).type))) : undefined;
    };

    // 1. Rollen
    for (const role of blueprint.roles) {
      const existing = pick(role.key, roles, null, () => roles.find((r) => same(r.name, role.name)));
      if (existing) {
        ids[role.key] = existing.id;
        reused.roles++;
        if (choices?.adjustRoles) {
          // Nur dazu, nie weg: Farbe wie im Profil, Team-Rollen bekommen fehlende Mod-Rechte und werden getrennt angezeigt
          const permissions = role.kind === 'mod' ? (BigInt(existing.permissions) | MOD_PERMISSIONS).toString() : existing.permissions;
          const hoist = role.kind === 'mod' ? true : existing.hoist;
          if (existing.color !== role.color || permissions !== existing.permissions || hoist !== existing.hoist) {
            try {
              if (!demo) await botRest('PATCH', `/guilds/${guildId}/roles/${existing.id}`, { color: role.color, permissions, hoist }, reason);
              created.adjusted!.push({ id: existing.id, color: existing.color, permissions: existing.permissions, hoist: existing.hoist });
              adjustedCount.ok++;
            } catch {
              adjustedCount.failed++; // z. B. Rolle steht über der Bot-Rolle
            }
          }
        }
        continue;
      }
      const body = { name: role.name, color: role.color, permissions: role.kind === 'mod' ? MOD_PERMISSIONS.toString() : '0', hoist: role.kind === 'mod', mentionable: role.kind === 'ping' };
      const id = demo ? fakeId(n++) : (await botRest<{ id: string }>('POST', `/guilds/${guildId}/roles`, body, reason))!.id;
      ids[role.key] = id;
      created.roleIds.push(id);
    }
    const modRoleIds = blueprint.roles.filter((r) => r.kind === 'mod').map((r) => ids[r.key]!);

    // 2. Kategorien und Kanäle
    for (const cat of blueprint.categories) {
      const existingCat = pick(`cat:${cat.key}`, channels, [4], () => channels.find((c) => c.type === 4 && same(c.name, cat.name)));
      let catId: string;
      if (existingCat) {
        catId = existingCat.id;
        reused.channels++;
      } else {
        const body = { name: cat.name, type: 4, permission_overwrites: blueprintOverwrites(cat.access, guildId, modRoleIds, botId) };
        catId = demo ? fakeId(n++) : (await botRest<{ id: string }>('POST', `/guilds/${guildId}/channels`, body, reason))!.id;
        createdCategories.push(catId);
      }
      ids[`cat:${cat.key}`] = catId;
      for (const ch of cat.channels) {
        const type = ch.type === 'voice' ? 2 : 0;
        const existing = pick(ch.key, channels, type === 2 ? [2, 13] : [0, 5, 15], () => channels.find((c) => c.type === type && c.parent_id === catId && same(c.name, ch.name)));
        if (existing) {
          ids[ch.key] = existing.id;
          reused.channels++;
          continue;
        }
        const body = { name: ch.name, type, parent_id: catId, ...(ch.topic && type === 0 ? { topic: ch.topic } : {}), permission_overwrites: blueprintOverwrites(ch.access ?? cat.access, guildId, modRoleIds, botId) };
        const id = demo ? fakeId(n++) : (await botRest<{ id: string }>('POST', `/guilds/${guildId}/channels`, body, reason))!.id;
        ids[ch.key] = id;
        created.channelIds.push(id);
      }
    }
    created.channelIds.push(...createdCategories);
  } catch (error) {
    // Halb angelegt: merken, damit man es über „Deaktivieren“ wieder wegräumen kann
    created.channelIds.push(...createdCategories);
    await db().serverProfile.create({ data: { guildId, blueprintId, backupId: backup.id, created: created as unknown as Prisma.InputJsonValue, createdBy: userId } });
    throw error;
  }

  // 3. Module einstellen (vorhandene Einstellungen bleiben, nur die Bauplan-Werte kommen dazu)
  const configs = blueprintModuleConfigs(blueprint, ids);
  const rows = new Map((await db().guildModule.findMany({ where: { guildId } })).map((m) => [m.moduleId, m]));
  const modules: string[] = [];
  for (const [moduleId, patch] of Object.entries(configs)) {
    const parse = MODULE_CONFIG_PARSERS[moduleId];
    if (!parse || !getModule(moduleId)) continue;
    const config = parse(mergeConfig(rows.get(moduleId)?.config, patch)) as Prisma.InputJsonValue;
    if (!rows.has(moduleId)) created.newModules.push(moduleId);
    await db().guildModule.upsert({
      where: { guildId_moduleId: { guildId, moduleId } },
      create: { guildId, moduleId, enabled: true, config, updatedBy: userId },
      update: { enabled: true, config, updatedBy: userId },
    });
    await publishConfig({ type: 'module', guildId, moduleId, enabled: true });
    modules.push(moduleId);
  }

  await db().serverProfile.create({ data: { guildId, blueprintId, backupId: backup.id, created: created as unknown as Prisma.InputJsonValue, createdBy: userId } });
  return { created: { roles: created.roleIds.length, channels: created.channelIds.length }, reused, adjusted: adjustedCount, modules };
}

/** Aktives Profil entfernen: Sicherung zurück; auf Wunsch angelegte Kanäle/Rollen löschen */
export async function deactivateProfile(guildId: string, userId: string, username: string, deleteCreated: boolean): Promise<{ deleted: number; failed: number; restored: number; blueprint: ServerBlueprint | undefined }> {
  const profile = await db().serverProfile.findFirst({ where: { guildId, active: true }, orderBy: { createdAt: 'desc' } });
  if (!profile) throw new Error('Kein Profil aktiv.');
  const blueprint = getBlueprint(profile.blueprintId);
  const created = (profile.created ?? {}) as Partial<ProfileCreated>;

  // Einstellungen zurück
  const backup = profile.backupId ? await db().configBackup.findFirst({ where: { id: profile.backupId, guildId } }) : null;
  const parsed = backup ? templateFileSchema.safeParse(backup.data) : null;
  if (parsed?.success) {
    await applyTemplate(
      guildId,
      parsed.data,
      new Map(),
      { modules: Object.keys(parsed.data.modules), includeEnabled: true, includePanels: false, includeLocale: false },
      userId,
      `Vor Entfernen des Server-Profils „${blueprint?.name ?? profile.blueprintId}“`,
    );
  }
  for (const moduleId of created.newModules ?? []) {
    await db().guildModule.deleteMany({ where: { guildId, moduleId } });
    await publishConfig({ type: 'module', guildId, moduleId, enabled: getModule(moduleId)?.defaultEnabled ?? false });
  }

  let restored = 0;
  if (guildId !== DEMO_GUILD_ID) {
    for (const old of created.adjusted ?? []) {
      try {
        await botRest('PATCH', `/guilds/${guildId}/roles/${old.id}`, { color: old.color, permissions: old.permissions, hoist: old.hoist }, `Server-Profil entfernt (Dashboard, ${username})`);
        restored++;
      } catch {
        // Rolle weg oder nicht mehr erreichbar – nichts zurückzusetzen
      }
    }
  } else restored = created.adjusted?.length ?? 0;

  let deleted = 0;
  let failed = 0;
  if (deleteCreated && guildId !== DEMO_GUILD_ID) {
    const reason = `Server-Profil entfernt (Dashboard, ${username})`;
    for (const id of created.channelIds ?? []) {
      try {
        await botRest('DELETE', `/channels/${id}`, undefined, reason);
        deleted++;
      } catch (error) {
        if ((error as { status?: number }).status === 404) continue; // schon weg
        failed++;
      }
    }
    for (const id of created.roleIds ?? []) {
      try {
        await botRest('DELETE', `/guilds/${guildId}/roles/${id}`, undefined, reason);
        deleted++;
      } catch (error) {
        if ((error as { status?: number }).status === 404) continue;
        failed++;
      }
    }
  } else if (deleteCreated) {
    deleted = (created.channelIds?.length ?? 0) + (created.roleIds?.length ?? 0);
  }

  await db().serverProfile.update({ where: { id: profile.id }, data: { active: false, endedAt: new Date() } });
  return { deleted, failed, restored, blueprint };
}
