'use server';

import { revalidatePath } from 'next/cache';
import { cleanRoleName, ownerConfigSchema, parseOwnerConfig } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { isDemoMode } from '@/lib/env';
import { getModuleRow, saveModuleConfig, sendModuleAction } from '@/lib/modules';
import type { ActionResult } from '../actions';

/** Alles hier darf NUR der Server-Owner – auch Admins nicht */
async function owner(guildId: string) {
  const access = await requireGuildAccess(guildId);
  return access.level === 'owner' ? access : null;
}

const done = (guildId: string) => revalidatePath(`/g/${guildId}/owner`);

async function action(guildId: string, cmd: string, ok: string): Promise<ActionResult> {
  const access = await owner(guildId);
  if (!access) return { ok: false, message: 'Nur der Server-Owner.' };
  const sent = await sendModuleAction(guildId, 'owner', cmd, access.session.userId);
  done(guildId);
  return sent ? { ok: true, message: ok } : { ok: false, message: 'Der Bot ist gerade nicht erreichbar.' };
}

export async function setupOwnerArea(guildId: string): Promise<ActionResult> {
  const access = await owner(guildId);
  if (!access) return { ok: false, message: 'Nur der Server-Owner.' };
  // Modul einschalten, damit der Bot die Sperre auch wirklich überwacht
  await db().guildModule.upsert({
    where: { guildId_moduleId: { guildId, moduleId: 'owner' } },
    create: { guildId, moduleId: 'owner', enabled: true, updatedBy: access.session.userId },
    update: { enabled: true, updatedBy: access.session.userId },
  });
  if (isDemoMode()) {
    // Demo hat keinen Bot: Kategorie aus den Demo-Kanälen eintragen
    const current = parseOwnerConfig((await getModuleRow(guildId, 'owner')).config);
    await saveModuleConfig(guildId, 'owner', { ...current, categoryId: '100000000000000060' }, access.session.userId);
    done(guildId);
    return { ok: true, message: 'Demo: Owner-Bereich angelegt.' };
  }
  return action(guildId, 'setup', 'Wird angelegt – in ein paar Sekunden steht die Kategorie „🔒 Owner-Bereich“ in Discord.');
}

export async function checkOwnerArea(guildId: string): Promise<ActionResult> {
  return action(guildId, 'check', 'Rechte werden geprüft und bei Bedarf wiederhergestellt.');
}

export async function addOwnerChannel(guildId: string, name: string, kind: 'text' | 'voice'): Promise<ActionResult> {
  // Erst prüfen, ob hier der Owner fragt – sonst verrät schon die Antwort, ob es den Bereich gibt
  if (!(await owner(guildId))) return { ok: false, message: 'Nur der Server-Owner.' };
  const clean = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .slice(0, 90);
  if (!clean) return { ok: false, message: 'Bitte einen Namen eingeben.' };
  const config = parseOwnerConfig((await getModuleRow(guildId, 'owner')).config);
  if (!config.categoryId) return { ok: false, message: 'Erst den Owner-Bereich anlegen.' };
  return action(guildId, `${kind}:${Buffer.from(kind === 'voice' ? name.trim().slice(0, 90) : clean, 'utf8').toString('base64url')}`, `Kanal „${kind === 'voice' ? name.trim() : clean}“ wird angelegt.`);
}

export async function saveOwnerSettings(guildId: string, allowBots: boolean, notifyOwner: boolean, autoReplaceAdmin = false): Promise<ActionResult> {
  const access = await owner(guildId);
  if (!access) return { ok: false, message: 'Nur der Server-Owner.' };
  const current = parseOwnerConfig((await getModuleRow(guildId, 'owner')).config);
  const next = ownerConfigSchema.parse({ ...current, allowBots, notifyOwner, autoReplaceAdmin });
  await saveModuleConfig(guildId, 'owner', next, access.session.userId);
  done(guildId);
  return { ok: true, message: 'Gespeichert – Rechte werden angepasst.' };
}

export async function replaceAdministrator(guildId: string, roleId: string): Promise<ActionResult> {
  if (!/^\d{15,22}$/.test(roleId)) return { ok: false, message: 'Ungültige Rolle.' };
  return action(guildId, `deadmin:${roleId}`, 'Wird umgestellt – die alten Rechte sind gesichert (unten wiederherstellbar).');
}

export async function restoreRoleBackup(guildId: string, backupId: string): Promise<ActionResult> {
  const access = await owner(guildId);
  if (!access) return { ok: false, message: 'Nur der Server-Owner.' };
  const backup = await db().ownerRoleBackup.findFirst({ where: { id: backupId, guildId, status: 'applied' } });
  if (!backup) return { ok: false, message: 'Diese Sicherung gibt es nicht (mehr).' };
  return action(guildId, `restore:${backupId}`, `Rechte von „${backup.roleName}“ werden wiederhergestellt.`);
}

/** Neue Admin-Rolle (ownerSafe = alle Einzelrechte statt „Administrator“, sieht den Owner-Bereich nicht) */
export async function createAdminRole(guildId: string, name: string, color: string, ownerSafe: boolean): Promise<ActionResult> {
  const access = await owner(guildId);
  if (!access) return { ok: false, message: 'Nur der Server-Owner.' };
  const clean = cleanRoleName(name);
  if (!clean) return { ok: false, message: 'Bitte einen Namen eingeben.' };
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1) : '';
  if (isDemoMode()) return { ok: true, message: `Demo: Rolle „${clean}“ würde ${ownerSafe ? 'ohne Zugriff auf den Owner-Bereich' : 'mit Administrator'} angelegt.` };
  return action(guildId, `adminrole:${Buffer.from(clean, 'utf8').toString('base64url')}:${ownerSafe ? '1' : '0'}:${hex}`, `Rolle „${clean}“ wird angelegt${ownerSafe ? ' – alle Rechte außer dem Owner-Bereich' : ''}.`);
}
