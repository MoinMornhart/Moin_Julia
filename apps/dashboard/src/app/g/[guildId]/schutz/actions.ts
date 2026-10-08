'use server';

import { revalidatePath } from 'next/cache';
import { parseSchutzConfig, schutzConfigSchema } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { formBool, formIds, formString, getModuleRow, saveModuleConfig, sendModuleAction } from '@/lib/modules';
import type { ActionResult } from '../actions';

function num(form: FormData, key: string, fallback: number): number {
  const value = Number(formString(form, key));
  return Number.isFinite(value) && formString(form, key) !== null ? Math.round(value) : fallback;
}

export async function saveSchutzSettings(guildId: string, form: FormData): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins dürfen Einstellungen ändern.' };

  const parsed = schutzConfigSchema.safeParse({
    alertChannelId: formString(form, 'alertChannelId'),
    alertRoleId: formString(form, 'alertRoleId'),
    antiRaid: {
      enabled: formBool(form, 'antiRaid.enabled'),
      joins: num(form, 'antiRaid.joins', 10),
      seconds: num(form, 'antiRaid.seconds', 10),
      action: formString(form, 'antiRaid.action') ?? 'pause',
      durationMin: num(form, 'antiRaid.durationMin', 15),
    },
    antiNuke: {
      enabled: formBool(form, 'antiNuke.enabled'),
      threshold: num(form, 'antiNuke.threshold', 3),
      seconds: num(form, 'antiNuke.seconds', 15),
      punishment: formString(form, 'antiNuke.punishment') ?? 'strip_roles',
      watch: {
        channelDelete: formBool(form, 'watch.channelDelete'),
        roleDelete: formBool(form, 'watch.roleDelete'),
        ban: formBool(form, 'watch.ban'),
        kick: formBool(form, 'watch.kick'),
        webhookCreate: formBool(form, 'watch.webhookCreate'),
        adminGrant: formBool(form, 'watch.adminGrant'),
      },
      whitelistUserIds: (formString(form, 'antiNuke.whitelistUserIds') ?? '').split(/[\s,]+/).filter(Boolean),
      whitelistRoleIds: formIds(form, 'antiNuke.whitelistRoleIds'),
    },
    verification: {
      enabled: formBool(form, 'verification.enabled'),
      roleId: formString(form, 'verification.roleId'),
      channelId: formString(form, 'verification.channelId'),
      mode: formString(form, 'verification.mode') ?? 'button',
      title: formString(form, 'verification.title') ?? undefined,
      message: formString(form, 'verification.message') ?? undefined,
    },
    accountAge: {
      enabled: formBool(form, 'accountAge.enabled'),
      minDays: num(form, 'accountAge.minDays', 7),
      action: formString(form, 'accountAge.action') ?? 'alert',
    },
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: `Ungültige Eingabe bei „${issue?.path.join('.')}“: ${issue?.message}` };
  }
  const delivered = await saveModuleConfig(guildId, 'schutz', parsed.data, session.userId);
  return { ok: true, message: delivered ? 'Gespeichert – gilt ab sofort.' : 'Gespeichert – der Bot übernimmt es beim nächsten Neustart.' };
}

export async function postVerifyPanel(guildId: string): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  const config = parseSchutzConfig((await getModuleRow(guildId, 'schutz')).config);
  if (!config.verification.channelId || !config.verification.roleId) {
    return { ok: false, message: 'Erst Kanal und Rolle für die Verifizierung wählen und speichern.' };
  }
  const sent = await sendModuleAction(guildId, 'schutz', 'post-verify-panel', session.userId);
  return sent ? { ok: true, message: 'Panel wird gesendet – schau in den Kanal.' } : { ok: false, message: 'Der Bot ist gerade nicht erreichbar.' };
}

export async function endRaid(guildId: string): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  const sent = await sendModuleAction(guildId, 'schutz', 'end-raid', session.userId);
  revalidatePath(`/g/${guildId}/schutz`);
  return sent ? { ok: true, message: 'Raid-Modus wird beendet.' } : { ok: false, message: 'Der Bot ist gerade nicht erreichbar.' };
}
