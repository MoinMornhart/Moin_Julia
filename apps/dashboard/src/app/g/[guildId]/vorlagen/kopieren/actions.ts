'use server';

import { randomUUID } from 'node:crypto';
import { canCopyServer, COPY_JOB_TTL, copyJobKey, newCopyJob, parseCopyOptions, type CopyJob } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { DEMO_GUILD_ID } from '@/lib/demo';
import { botApi, fetchGuildChannels } from '@/lib/discord';
import { memberPermissions } from '@/lib/members';
import { sendModuleAction } from '@/lib/modules';
import { acquireLock, cacheGet, cacheSet, releaseLock } from '@/lib/redis';

/** Demo: ein ausgedachter zweiter Server, damit man die Seite ausprobieren kann */
const DEMO_SOURCE = { id: '100000000000000099', name: 'Alter Demo-Server' };

export interface CopySource {
  id: string;
  name: string;
}

export interface CopyAnalysis {
  roles: { create: number; reuse: number };
  channels: { create: number; reuse: number };
  textChannels: number;
}

/** Owner oder Administrator auf diesem Server – live geprüft, ohne Generalschlüssel */
async function mayCopy(guildId: string, userId: string): Promise<boolean> {
  if (guildId === DEMO_GUILD_ID) return true;
  const guild = await db().guild.findUnique({ where: { id: guildId } });
  if (!guild?.botPresent) return false;
  if (guild.ownerId === userId) return true;
  return canCopyServer(false, await memberPermissions(guildId, userId).catch(() => 0n));
}

/** Ziel-Server: Owner/Admin hier UND (für den Start) auf dem Quell-Server */
async function targetAccess(guildId: string) {
  const access = await requireGuildAccess(guildId);
  if (!access.canEdit || !(await mayCopy(guildId, access.session.userId))) return null;
  return access;
}

/** Server, von denen man kopieren darf: Bot ist da, man ist dort Owner oder Administrator */
export async function copySources(guildId: string): Promise<{ ok: boolean; message?: string; sources?: CopySource[] }> {
  const access = await targetAccess(guildId);
  if (!access) return { ok: false, message: 'Server kopieren dürfen nur Owner und Administratoren.' };
  if (access.session.demo || guildId === DEMO_GUILD_ID) return { ok: true, sources: [DEMO_SOURCE] };
  const ids = access.session.guilds.map((g) => g.id).filter((id) => id !== guildId);
  const guilds = await db().guild.findMany({ where: { id: { in: ids }, botPresent: true }, orderBy: { name: 'asc' }, take: 50 });
  const sources: CopySource[] = [];
  for (const g of guilds) if (await mayCopy(g.id, access.session.userId)) sources.push({ id: g.id, name: g.name });
  return { ok: true, sources };
}

/** Vorschau: was würde angelegt, was mitbenutzt? */
export async function analyzeCopy(guildId: string, sourceId: string): Promise<{ ok: boolean; message?: string; analysis?: CopyAnalysis }> {
  const access = await targetAccess(guildId);
  if (!access) return { ok: false, message: 'Server kopieren dürfen nur Owner und Administratoren.' };
  if (!/^\d{15,22}$/.test(sourceId) || sourceId === guildId) return { ok: false, message: 'Ungültiger Quell-Server.' };
  if (!(guildId === DEMO_GUILD_ID && sourceId === DEMO_SOURCE.id) && !(await mayCopy(sourceId, access.session.userId))) return { ok: false, message: 'Auf dem Quell-Server musst du Owner oder Administrator sein (und der Bot muss dort sein).' };
  if (guildId === DEMO_GUILD_ID) return { ok: true, analysis: { roles: { create: 4, reuse: 1 }, channels: { create: 9, reuse: 2 }, textChannels: 7 } };
  try {
    type Role = { id: string; name: string; managed: boolean };
    const [sRoles, tRoles, sChannels, tChannels] = await Promise.all([botApi<Role[]>(`/guilds/${sourceId}/roles`), botApi<Role[]>(`/guilds/${guildId}/roles`), fetchGuildChannels(sourceId), fetchGuildChannels(guildId)]);
    const tRoleNames = new Set(tRoles.filter((r) => !r.managed && r.id !== guildId).map((r) => r.name.toLowerCase()));
    const roles = sRoles.filter((r) => !r.managed && r.id !== sourceId);
    const tChannelNames = new Set(tChannels.map((c) => `${c.type === 4 ? 'k' : 'c'}:${c.name.toLowerCase()}`));
    const channels = sChannels.filter((c) => [0, 2, 4, 5, 13, 15].includes(c.type));
    const reuseC = channels.filter((c) => tChannelNames.has(`${c.type === 4 ? 'k' : 'c'}:${c.name.toLowerCase()}`)).length;
    const reuseR = roles.filter((r) => tRoleNames.has(r.name.toLowerCase())).length;
    return {
      ok: true,
      analysis: {
        roles: { create: roles.length - reuseR, reuse: reuseR },
        channels: { create: channels.length - reuseC, reuse: reuseC },
        textChannels: channels.filter((c) => c.type === 0 || c.type === 5).length,
      },
    };
  } catch {
    return { ok: false, message: 'Die Server-Daten ließen sich nicht laden – ist der Bot auf beiden Servern?' };
  }
}

export async function startCopy(guildId: string, sourceId: string, raw: { roles: boolean; channels: boolean; messages: number }): Promise<{ ok: boolean; message: string }> {
  const access = await targetAccess(guildId);
  if (!access) return { ok: false, message: 'Server kopieren dürfen nur Owner und Administratoren.' };
  if (!/^\d{15,22}$/.test(sourceId) || sourceId === guildId) return { ok: false, message: 'Ungültiger Quell-Server.' };
  if (!(guildId === DEMO_GUILD_ID && sourceId === DEMO_SOURCE.id) && !(await mayCopy(sourceId, access.session.userId))) return { ok: false, message: 'Auf dem Quell-Server musst du Owner oder Administrator sein.' };
  const options = parseCopyOptions(raw);
  if (!options) return { ok: false, message: 'Bitte wähle aus, was kopiert werden soll.' };
  const lock = `moin:dash:copy-lock:${guildId}`;
  if (!(await acquireLock(lock, 10))) return { ok: false, message: 'Läuft schon – bitte kurz warten.' };
  try {
    const current = await cacheGet<CopyJob>(copyJobKey(guildId));
    if (current && (current.status === 'queued' || current.status === 'running')) return { ok: false, message: 'Hier läuft schon eine Kopie.' };
    const sourceName = sourceId === DEMO_SOURCE.id ? DEMO_SOURCE.name : ((await db().guild.findUnique({ where: { id: sourceId } }))?.name ?? sourceId);
    const job = newCopyJob({ id: randomUUID(), sourceGuildId: sourceId, sourceName, targetGuildId: guildId, by: access.session.userId, byName: access.session.username, options });
    if (guildId === DEMO_GUILD_ID) {
      // Demo: kein Bot – gleich „fertig“ zeigen
      Object.assign(job, { status: 'done', step: 'Fertig ✅', finishedAt: Date.now() });
      job.counts = { roles: options.roles ? 4 : 0, reusedRoles: 1, channels: 9, reusedChannels: 2, messages: options.messages ? 7 * Math.min(options.messages, 12) : 0, messageTotal: options.messages ? 7 * Math.min(options.messages, 12) : 0 };
      job.created = { roleIds: ['100000000000000901'], channelIds: ['100000000000000902'] };
      await cacheSet(copyJobKey(guildId), job, COPY_JOB_TTL);
      return { ok: true, message: 'Demo: Kopie fertig.' };
    }
    await cacheSet(copyJobKey(guildId), job, COPY_JOB_TTL);
    if (!(await sendModuleAction(guildId, 'kern', 'copy-start', access.session.userId))) return { ok: false, message: 'Der Bot ist gerade nicht erreichbar.' };
    return { ok: true, message: 'Gestartet – der Bot kopiert jetzt.' };
  } finally {
    await releaseLock(lock);
  }
}

export async function copyStatus(guildId: string): Promise<CopyJob | null> {
  const access = await targetAccess(guildId);
  if (!access) return null;
  return cacheGet<CopyJob>(copyJobKey(guildId));
}

export async function cancelCopy(guildId: string): Promise<{ ok: boolean; message: string }> {
  const access = await targetAccess(guildId);
  if (!access) return { ok: false, message: 'Nicht erlaubt.' };
  const job = await cacheGet<CopyJob>(copyJobKey(guildId));
  if (!job || (job.status !== 'running' && job.status !== 'queued')) return { ok: false, message: 'Es läuft keine Kopie.' };
  job.cancel = true;
  if (job.status === 'queued') Object.assign(job, { status: 'cancelled', step: 'Abgebrochen', finishedAt: Date.now() });
  await cacheSet(copyJobKey(guildId), job, COPY_JOB_TTL);
  return { ok: true, message: 'Wird abgebrochen …' };
}

export async function undoCopy(guildId: string): Promise<{ ok: boolean; message: string }> {
  const access = await targetAccess(guildId);
  if (!access) return { ok: false, message: 'Nicht erlaubt.' };
  const job = await cacheGet<CopyJob>(copyJobKey(guildId));
  if (!job || job.status === 'running' || job.status === 'queued') return { ok: false, message: 'Gerade nicht möglich.' };
  if (!job.created.roleIds.length && !job.created.channelIds.length) return { ok: false, message: 'Es gibt nichts zu löschen.' };
  if (guildId === DEMO_GUILD_ID) {
    job.step = `Wieder gelöscht: ${job.created.channelIds.length} Kanäle, ${job.created.roleIds.length} Rollen 🧹`;
    job.created = { roleIds: [], channelIds: [] };
    await cacheSet(copyJobKey(guildId), job, COPY_JOB_TTL);
    return { ok: true, message: 'Demo: wieder gelöscht.' };
  }
  if (!(await sendModuleAction(guildId, 'kern', 'copy-undo', access.session.userId))) return { ok: false, message: 'Der Bot ist gerade nicht erreichbar.' };
  return { ok: true, message: 'Der Bot löscht das Angelegte …' };
}
