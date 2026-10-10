'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@moin/db';
import { getModule, matchRefs, parseModerationConfig, readTemplateFile, templateFileSchema, type RefMatch } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { fetchGuildChannels, fetchGuildRoles } from '@/lib/discord';
import { listBotCandidates, scanGalaxy, type BotCandidate, type GalaxyScan } from '@/lib/galaxy';
import { getModuleRow, saveModuleConfig } from '@/lib/modules';
import { applyTemplate, exportGuild, type ApplyOptions } from '@/lib/templates';

export interface Analysis {
  ok: boolean;
  error?: string;
  templateText?: string;
  summary?: {
    sourceName: string;
    createdAt: string;
    modules: { id: string; name: string; enabled: boolean }[];
    panels: number;
    locale: string;
  };
  matches?: RefMatch[];
  channels?: { id: string; name: string; type: number }[];
  roles?: { id: string; name: string }[];
}

/** Vorlage prüfen und Kanäle/Rollen per Name im Ziel-Server zuordnen (noch nichts wird geändert). */
export async function analyzeTemplate(guildId: string, source: { kind: 'file'; text: string } | { kind: 'guild'; guildId: string }): Promise<Analysis> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, error: 'Nur Owner und Admins dürfen importieren.' };

  let text: string;
  if (source.kind === 'guild') {
    if (source.guildId === guildId) return { ok: false, error: 'Quelle und Ziel sind derselbe Server.' };
    const access = await requireGuildAccess(source.guildId);
    if (!access.canEdit) return { ok: false, error: 'Auf dem Quell-Server brauchst du Admin-Rechte.' };
    text = JSON.stringify(await exportGuild(source.guildId));
  } else {
    if (source.text.length > 2_000_000) return { ok: false, error: 'Die Datei ist zu groß (max. 2 MB).' };
    text = source.text;
  }
  const read = readTemplateFile(text);
  if (!read.ok) return { ok: false, error: read.error };

  const [channels, roles] = await Promise.all([fetchGuildChannels(guildId).catch(() => []), fetchGuildRoles(guildId).catch(() => [])]);
  const template = read.template;
  return {
    ok: true,
    templateText: text,
    summary: {
      sourceName: template.source.guildName,
      createdAt: template.createdAt,
      modules: Object.entries(template.modules)
        .filter(([id]) => getModule(id))
        .map(([id, m]) => ({ id, name: getModule(id)!.name.de, enabled: m.enabled })),
      panels: template.rolePanels.length,
      locale: template.guild.locale,
    },
    matches: matchRefs(template, { channels, roles }),
    channels: channels.map(({ id, name, type }) => ({ id, name, type })),
    roles: roles.map(({ id, name }) => ({ id, name })),
  };
}

export async function importTemplate(
  guildId: string,
  templateText: string,
  mapping: [string, string | null][],
  options: Omit<ApplyOptions, 'replacePanels'>,
): Promise<{ ok: boolean; message: string }> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins dürfen importieren.' };
  const read = readTemplateFile(templateText);
  if (!read.ok) return { ok: false, message: read.error };
  const valid = /^\d{15,22}$/;
  const map = new Map(mapping.filter(([s, t]) => valid.test(s) && (t === null || valid.test(t))));
  const result = await applyTemplate(guildId, read.template, map, options, session.userId, `Vor Import der Vorlage „${read.template.source.guildName}“`);
  revalidatePath(`/g/${guildId}`, 'layout');
  return {
    ok: true,
    message: [
      `Übernommen: ${result.modules.length} Module${result.panels ? `, ${result.panels} Rollen-Panels (noch nicht gesendet)` : ''}.`,
      result.dropped ? `${result.dropped} Einträge ohne passenden Kanal/Rolle wurden weggelassen.` : '',
      result.skipped.length ? `Nicht übernommen (unverändert gelassen): ${result.skipped.map((x) => x.error).join('; ')}.` : '',
      'Der vorherige Stand liegt unter „Sicherungen“.',
    ]
      .filter(Boolean)
      .join(' '),
  };
}

export async function restoreBackup(guildId: string, backupId: string): Promise<{ ok: boolean; message: string }> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  const backup = await db().configBackup.findFirst({ where: { id: backupId, guildId } });
  const parsed = backup ? templateFileSchema.safeParse(backup.data) : null;
  if (!parsed?.success) return { ok: false, message: 'Dieses Backup ist nicht lesbar.' };
  await applyTemplate(
    guildId,
    parsed.data,
    new Map(),
    { modules: Object.keys(parsed.data.modules), includeEnabled: true, includePanels: true, replacePanels: true, includeLocale: true },
    session.userId,
    `Vor Wiederherstellung des Backups vom ${backup!.createdAt.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}`,
  );
  revalidatePath(`/g/${guildId}`, 'layout');
  return { ok: true, message: 'Backup wiederhergestellt. Rollen-Panels bitte erneut in Discord senden.' };
}

// ── Bilder ──────────────────────────────────────────────────────────────────

export async function deleteUpload(guildId: string, uploadId: string): Promise<{ ok: boolean; message: string }> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  const { count } = await db().upload.deleteMany({ where: { id: uploadId, guildId } });
  revalidatePath(`/g/${guildId}/vorlagen/bilder`);
  return count ? { ok: true, message: 'Gelöscht.' } : { ok: false, message: 'Bild nicht gefunden.' };
}

// ── GalaxyBot ───────────────────────────────────────────────────────────────

const SNOWFLAKE = /^\d{15,22}$/;

/** Welche Bots kommen als „alter Bot“ infrage? (Bots auf dem Server + Ersteller von AutoMod-Regeln) */
export async function listScanBots(guildId: string): Promise<{ ok: boolean; bots?: BotCandidate[]; message?: string }> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  try {
    return { ok: true, bots: await listBotCandidates(guildId) };
  } catch {
    return { ok: false, message: 'Bots konnten nicht geladen werden – ist der Bot auf dem Server?' };
  }
}

export async function runGalaxyScan(guildId: string, botId: string): Promise<{ ok: boolean; scan?: GalaxyScan; message?: string }> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  try {
    if (!SNOWFLAKE.test(botId)) return { ok: false, message: 'Bitte einen Bot auswählen oder eine gültige Bot-ID eingeben.' };
    return { ok: true, scan: await scanGalaxy(guildId, botId) };
  } catch {
    return { ok: false, message: 'Der Scan ist fehlgeschlagen – ist der Bot auf dem Server und darf er die Kanäle lesen?' };
  }
}

/** GalaxyBot-AutoMod-Regeln in die Moderations-Einstellungen übernehmen (Schimpfwörter, Massen-Erwähnungen). */
export async function importGalaxyRules(guildId: string, botId: string, ruleIds: string[]): Promise<{ ok: boolean; message: string }> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  if (!SNOWFLAKE.test(botId)) return { ok: false, message: 'Kein Bot gewählt.' };
  const scan = await scanGalaxy(guildId, botId);
  const chosen = scan.rules.filter((r) => ruleIds.includes(r.id) && r.importable);
  if (!chosen.length) return { ok: false, message: 'Keine übernehmbare Regel ausgewählt (Regeln nur mit Regex-Mustern oder Spam-Erkennung gibt es in Moin_Julia nicht).' };

  await db().configBackup.create({
    data: { guildId, reason: 'Vor Übernahme der GalaxyBot-AutoMod-Regeln', createdBy: session.userId, data: (await exportGuild(guildId)) as unknown as Prisma.InputJsonValue },
  });
  const config = parseModerationConfig((await getModuleRow(guildId, 'moderation')).config);
  const words = new Set(config.automod.badWords.words);
  for (const rule of chosen) {
    if (rule.kind === 'keywords') {
      rule.keywords.forEach((w) => words.add(w));
      config.automod.badWords.enabled = true;
    }
    if (rule.kind === 'mentions' && rule.mentionLimit) {
      config.automod.mentionSpam = { enabled: true, limit: Math.min(50, Math.max(2, rule.mentionLimit)) };
    }
  }
  config.automod.badWords.words = [...words].slice(0, 1000);
  await saveModuleConfig(guildId, 'moderation', config, session.userId);
  revalidatePath(`/g/${guildId}/moderation`);
  return {
    ok: true,
    message: `${chosen.length} Regel(n) übernommen (${words.size} Schimpfwörter). Schalte Moderation ein und deaktiviere danach die Regeln des alten Bots, sonst greifen beide.`,
  };
}
