'use server';

import { moderationConfigSchema, parseModerationConfig } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { formBool, formIds, formString, getModuleRow, saveModuleConfig } from '@/lib/modules';
import type { ActionResult } from '../actions';

function num(form: FormData, key: string): number | null {
  const raw = formString(form, key);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value) : null;
}

function list(form: FormData, key: string): string[] {
  return (formString(form, key) ?? '')
    .split(/[\n,]+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

export async function saveModerationSettings(guildId: string, form: FormData): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins dürfen Einstellungen ändern.' };

  const escalation = [];
  for (let i = 0; i < 5; i++) {
    const warns = num(form, `esc.${i}.warns`);
    const action = formString(form, `esc.${i}.action`);
    if (warns === null || !action) continue;
    escalation.push({ warns, action, durationMin: action === 'timeout' ? (num(form, `esc.${i}.duration`) ?? 60) : null });
  }
  escalation.sort((a, b) => a.warns - b.warns);

  const current = parseModerationConfig((await getModuleRow(guildId, 'moderation')).config);
  const parsed = moderationConfigSchema.safeParse({
    modLogChannelId: formString(form, 'modLogChannelId'),
    dmUsers: formBool(form, 'dmUsers'),
    requireReason: formBool(form, 'requireReason'),
    warnExpiryDays: num(form, 'warnExpiryDays'),
    escalation,
    automod: {
      badWords: {
        enabled: formBool(form, 'badWords.enabled'),
        words: list(form, 'badWords.words'),
        smart: formBool(form, 'badWords.smart'),
        useDefaultList: formBool(form, 'badWords.useDefaultList'),
        action: formString(form, 'badWords.action') ?? 'delete',
      },
      links: { enabled: formBool(form, 'links.enabled'), allowDomains: list(form, 'links.allowDomains') },
      invites: { enabled: formBool(form, 'invites.enabled') },
      mentionSpam: { enabled: formBool(form, 'mentionSpam.enabled'), limit: num(form, 'mentionSpam.limit') ?? 5 },
      spam: {
        enabled: formBool(form, 'spam.enabled'),
        maxMessages: num(form, 'spam.maxMessages') ?? 6,
        perSeconds: num(form, 'spam.perSeconds') ?? 5,
        action: formString(form, 'spam.action') ?? 'delete_timeout',
        timeoutMin: num(form, 'spam.timeoutMin') ?? 10,
        duplicates: num(form, 'spam.duplicates') ?? 3,
      },
      flood: {
        enabled: formBool(form, 'flood.enabled'),
        maxEmojis: num(form, 'flood.maxEmojis') ?? 12,
        maxLines: num(form, 'flood.maxLines') ?? 15,
        action: formString(form, 'flood.action') ?? 'delete',
      },
      caps: {
        enabled: formBool(form, 'caps.enabled'),
        minLength: num(form, 'caps.minLength') ?? 12,
        percent: num(form, 'caps.percent') ?? 75,
        action: formString(form, 'caps.action') ?? 'delete',
      },
      warnOnNativeHit: formBool(form, 'warnOnNativeHit'),
      exemptRoleIds: formIds(form, 'exemptRoleIds'),
      exemptChannelIds: formIds(form, 'exemptChannelIds'),
    },
    // Geschützte Kanäle & Rollen – nur wenn der Bereich im Formular war (sonst bleibt der Stand, z. B. von /geschuetzt)
    protection: form.has('protection.present')
      ? { roleIds: formIds(form, 'protection.roleIds'), channelIds: formIds(form, 'protection.channelIds'), autoFix: formBool(form, 'protection.autoFix') }
      : current.protection,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: `Ungültige Eingabe bei „${issue?.path.join('.')}“: ${issue?.message}` };
  }

  const delivered = await saveModuleConfig(guildId, 'moderation', parsed.data, session.userId);
  return {
    ok: true,
    message: delivered ? 'Gespeichert – Discord-AutoMod-Regeln werden jetzt abgeglichen.' : 'Gespeichert – der Bot übernimmt es beim nächsten Neustart.',
  };
}
