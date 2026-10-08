'use server';

import { revalidatePath } from 'next/cache';
import { getModule, isLocale } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { publishConfig } from '@/lib/redis';

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/** Schaltet ein Modul an/aus. Rechte werden hier serverseitig erneut geprüft. */
export async function setModuleEnabled(guildId: string, moduleId: string, enabled: boolean): Promise<ActionResult> {
  const { session, canEdit, level } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins dürfen Module schalten.' };

  const meta = getModule(moduleId);
  if (!meta || (meta.ownerOnly && level !== 'owner')) return { ok: false, message: 'Unbekanntes Modul.' };
  if (meta.status !== 'available' && enabled) {
    return { ok: false, message: `${meta.name.de} ist noch in Arbeit (Modul ${meta.order}).` };
  }

  await db().guildModule.upsert({
    where: { guildId_moduleId: { guildId, moduleId } },
    create: { guildId, moduleId, enabled, updatedBy: session.userId },
    update: { enabled, updatedBy: session.userId },
  });
  const delivered = await publishConfig({ type: 'module', guildId, moduleId, enabled });
  revalidatePath(`/g/${guildId}`, 'layout');
  return {
    ok: true,
    message: delivered ? undefined : 'Gespeichert – der Bot übernimmt es beim nächsten Neustart (Redis nicht erreichbar).',
  };
}

export async function saveGuildSettings(guildId: string, formData: FormData): Promise<ActionResult> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins dürfen Einstellungen ändern.' };

  const locale = formData.get('locale');
  if (!isLocale(locale)) return { ok: false, message: 'Ungültige Sprache.' };
  const modRoleIds = formData
    .getAll('modRoleIds')
    .filter((v): v is string => typeof v === 'string' && /^\d+$/.test(v));

  await db().guild.update({ where: { id: guildId }, data: { locale, modRoleIds } });
  await publishConfig({ type: 'guild-settings', guildId });
  revalidatePath(`/g/${guildId}`, 'layout');
  return { ok: true, message: 'Gespeichert.' };
}
