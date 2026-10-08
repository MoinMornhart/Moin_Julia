'use server';

import { LOG_CATEGORIES, loggingConfigSchema } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { formBool, formIds, formString, saveModuleConfig } from '@/lib/modules';
import type { ActionResult } from '../actions';

export async function saveLoggingSettings(guildId: string, form: FormData): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins dürfen Einstellungen ändern.' };

  const parsed = loggingConfigSchema.safeParse({
    defaultChannelId: formString(form, 'defaultChannelId'),
    categories: Object.fromEntries(
      LOG_CATEGORIES.map((c) => [c, { enabled: formBool(form, `cat.${c}.enabled`), channelId: formString(form, `cat.${c}.channelId`) }]),
    ),
    ignoredChannelIds: formIds(form, 'ignoredChannelIds'),
    ignoreBots: formBool(form, 'ignoreBots'),
  });
  if (!parsed.success) return { ok: false, message: 'Ungültige Eingabe – bitte Seite neu laden und nochmal versuchen.' };

  const delivered = await saveModuleConfig(guildId, 'logging', parsed.data, session.userId);
  return { ok: true, message: delivered ? 'Gespeichert – gilt ab sofort.' : 'Gespeichert – der Bot übernimmt es beim nächsten Neustart.' };
}
