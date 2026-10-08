'use server';

import { tempVoiceConfigSchema } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { formBool, formIds, formString, saveModuleConfig, sendModuleAction } from '@/lib/modules';
import type { ActionResult } from '../actions';

function num(form: FormData, key: string, fallback: number): number {
  const raw = formString(form, key);
  const value = Number(raw);
  return raw !== null && Number.isFinite(value) ? Math.round(value) : fallback;
}

export async function saveTempVoiceSettings(guildId: string, form: FormData): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins dürfen Einstellungen ändern.' };

  const hubs = [];
  for (let i = 0; i < 5; i++) {
    const channelId = formString(form, `hub.${i}.channelId`);
    if (!channelId) continue;
    hubs.push({
      channelId,
      categoryId: formString(form, `hub.${i}.categoryId`),
      nameTemplate: formString(form, `hub.${i}.nameTemplate`) ?? undefined,
      userLimit: num(form, `hub.${i}.userLimit`, 0),
      startLocked: formBool(form, `hub.${i}.startLocked`),
    });
  }
  if (new Set(hubs.map((h) => h.channelId)).size !== hubs.length) return { ok: false, message: 'Jeder Erstell-Kanal darf nur einmal vorkommen.' };

  const parsed = tempVoiceConfigSchema.safeParse({
    hubs,
    panel: formBool(form, 'panel'),
    deleteAfterSec: num(form, 'deleteAfterSec', 10),
    ownerRoleIds: formIds(form, 'ownerRoleIds'),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: `Ungültige Eingabe bei „${issue?.path.join('.')}“: ${issue?.message}` };
  }
  const delivered = await saveModuleConfig(guildId, 'tempvoice', parsed.data, session.userId);
  return { ok: true, message: delivered ? 'Gespeichert – gilt ab sofort.' : 'Gespeichert – der Bot übernimmt es beim nächsten Neustart.' };
}

/** Bot legt Kategorie + „➕ Kanal erstellen“ an und trägt ihn als Erstell-Kanal ein */
export async function createHub(guildId: string): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  const sent = await sendModuleAction(guildId, 'tempvoice', 'create-hub', session.userId);
  return sent
    ? { ok: true, message: 'Wird angelegt – lade die Seite in ein paar Sekunden neu, dann steht der Kanal unten.' }
    : { ok: false, message: 'Der Bot ist gerade nicht erreichbar.' };
}
