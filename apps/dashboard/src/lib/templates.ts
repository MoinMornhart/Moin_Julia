import 'server-only';
import { buildTemplate, getModule, isLocale, remapModuleConfig, replaceSnowflakes, type TemplateFile } from '@moin/shared';
import type { Prisma } from '@moin/db';
import { db } from './db';
import { fetchGuildChannels, fetchGuildRoles } from './discord';
import { appVersion } from './env';
import { publishConfig } from './redis';

/** Aktuellen Stand eines Servers als Vorlage */
export async function exportGuild(guildId: string): Promise<TemplateFile> {
  const guild = await db().guild.findUniqueOrThrow({ where: { id: guildId }, include: { modules: true } });
  const panels = await db().rolePanel.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' } });
  const [channels, roles] = await Promise.all([fetchGuildChannels(guildId).catch(() => []), fetchGuildRoles(guildId).catch(() => [])]);
  return buildTemplate({
    appVersion: appVersion(),
    guildName: guild.name,
    locale: isLocale(guild.locale) ? guild.locale : 'de',
    // Owner-Bereich gehört nur dem Owner – nie in (teilbare) Vorlagen
    modules: Object.fromEntries(guild.modules.filter((m) => !getModule(m.moduleId)?.ownerOnly).map((m) => [m.moduleId, { enabled: m.enabled, config: m.config }])),
    rolePanels: panels.map((p) => ({ name: p.name, channelId: p.channelId, data: p.data })),
    channels: channels.map((c) => ({ id: c.id, name: c.name, type: c.type })),
    roles: roles.map((r) => ({ id: r.id, name: r.name })),
  });
}

export interface ApplyOptions {
  modules: string[];
  /** An/Aus-Zustand der Module mit übernehmen */
  includeEnabled: boolean;
  includePanels: boolean;
  /** Bei Wiederherstellung: vorhandene Rollen-Panels vorher löschen */
  replacePanels?: boolean;
  includeLocale: boolean;
}

export interface ApplyResult {
  modules: string[];
  panels: number;
  backupId: string;
}

/** Vorlage auf einen Server anwenden – vorher wird automatisch ein Backup angelegt. */
export async function applyTemplate(
  guildId: string,
  template: TemplateFile,
  mapping: Map<string, string | null>,
  options: ApplyOptions,
  userId: string,
  reason: string,
): Promise<ApplyResult> {
  const backup = await db().configBackup.create({
    data: { guildId, reason, createdBy: userId, data: (await exportGuild(guildId)) as unknown as Prisma.InputJsonValue },
  });

  const modules = options.modules.filter((id) => template.modules[id] && getModule(id) && !getModule(id)?.ownerOnly);
  const panels = options.includePanels ? template.rolePanels : [];
  const existing = new Map((await db().guildModule.findMany({ where: { guildId } })).map((m) => [m.moduleId, m]));

  await db().$transaction([
    ...modules.map((id) => {
      const source = template.modules[id]!;
      const config = remapModuleConfig(id, source.config, mapping) as Prisma.InputJsonValue;
      const enabled = options.includeEnabled ? source.enabled : (existing.get(id)?.enabled ?? getModule(id)!.defaultEnabled);
      return db().guildModule.upsert({
        where: { guildId_moduleId: { guildId, moduleId: id } },
        create: { guildId, moduleId: id, enabled, config, updatedBy: userId },
        update: { enabled, config, updatedBy: userId },
      });
    }),
    ...(options.replacePanels ? [db().rolePanel.deleteMany({ where: { guildId } })] : []),
    ...panels.map((p) =>
      db().rolePanel.create({
        data: {
          guildId,
          name: p.name,
          channelId: p.channelId ? ((mapping.has(p.channelId) ? mapping.get(p.channelId) : p.channelId) ?? null) : null,
          data: replaceSnowflakes(p.data, mapping) as Prisma.InputJsonValue,
        },
      }),
    ),
    ...(options.includeLocale ? [db().guild.update({ where: { id: guildId }, data: { locale: template.guild.locale } })] : []),
  ]);

  // Bot informieren: Einstellungen neu laden, Befehle neu registrieren
  for (const id of modules) {
    await publishConfig({ type: 'module', guildId, moduleId: id, enabled: options.includeEnabled ? template.modules[id]!.enabled : (existing.get(id)?.enabled ?? false) });
  }
  if (options.includeLocale) await publishConfig({ type: 'guild-settings', guildId });

  // Nur die letzten 20 Backups behalten
  const old = await db().configBackup.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' }, skip: 20, select: { id: true } });
  if (old.length) await db().configBackup.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });

  return { modules, panels: panels.length, backupId: backup.id };
}
