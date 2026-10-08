'use server';

import { revalidatePath } from 'next/cache';
import { messageTemplateSchema, rolePanelSchema, willkommenConfigSchema } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { formBool, formIds, formString, saveModuleConfig, sendModuleAction } from '@/lib/modules';
import type { ActionResult } from '../actions';

function template(form: FormData, key: string): unknown {
  try {
    return messageTemplateSchema.parse(JSON.parse(formString(form, key) ?? '{}'));
  } catch {
    return undefined;
  }
}

function issueText(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  const issue = error.issues[0];
  return `Ungültige Eingabe bei „${issue?.path.join('.')}“: ${issue?.message}`;
}

export async function saveWillkommenSettings(guildId: string, form: FormData): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins dürfen Einstellungen ändern.' };
  const parsed = willkommenConfigSchema.safeParse({
    welcome: {
      enabled: formBool(form, 'welcome.enabled'),
      channelId: formString(form, 'welcome.channelId'),
      template: template(form, 'welcome.template'),
      card: {
        enabled: formBool(form, 'card.enabled'),
        style: formString(form, 'card.style') ?? 'hafen',
        headline: formString(form, 'card.headline') ?? '',
        subline: formString(form, 'card.subline') ?? '',
        backgroundUrl: formString(form, 'card.backgroundUrl') ?? '',
      },
    },
    leave: { enabled: formBool(form, 'leave.enabled'), channelId: formString(form, 'leave.channelId'), template: template(form, 'leave.template') },
    dm: { enabled: formBool(form, 'dm.enabled'), template: template(form, 'dm.template') },
    autoRoles: { humans: formIds(form, 'autoRoles.humans'), bots: formIds(form, 'autoRoles.bots') },
  });
  if (!parsed.success) return { ok: false, message: issueText(parsed.error) };
  const delivered = await saveModuleConfig(guildId, 'willkommen', parsed.data, session.userId);
  return { ok: true, message: delivered ? 'Gespeichert – gilt ab dem nächsten Beitritt.' : 'Gespeichert – der Bot übernimmt es beim nächsten Neustart.' };
}

// ── Rollen-Panels ───────────────────────────────────────────────────────────

export async function savePanel(guildId: string, panelId: string | null, form: FormData): Promise<ActionResult & { id?: string }> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  const roles = [];
  for (let i = 0; i < 25; i++) {
    const roleId = formString(form, `role.${i}.id`);
    if (!roleId) continue;
    roles.push({
      roleId,
      label: formString(form, `role.${i}.label`) ?? 'Rolle',
      emoji: formString(form, `role.${i}.emoji`) ?? '',
      description: formString(form, `role.${i}.description`) ?? '',
    });
  }
  const parsed = rolePanelSchema.safeParse({
    name: formString(form, 'name') ?? '',
    channelId: formString(form, 'channelId'),
    style: formString(form, 'style') ?? 'buttons',
    mode: formString(form, 'mode') ?? 'multi',
    template: template(form, 'template'),
    roles,
    removeOnPick: formIds(form, 'removeOnPick'),
  });
  if (!parsed.success) {
    return { ok: false, message: roles.length ? issueText(parsed.error) : 'Füge mindestens eine Rolle hinzu.' };
  }
  const data = { style: parsed.data.style, mode: parsed.data.mode, template: parsed.data.template, roles: parsed.data.roles, name: parsed.data.name, removeOnPick: parsed.data.removeOnPick };
  const saved = panelId
    ? await db().rolePanel.update({ where: { id: panelId, guildId }, data: { name: parsed.data.name, channelId: parsed.data.channelId, data } })
    : await db().rolePanel.create({ data: { guildId, name: parsed.data.name, channelId: parsed.data.channelId, data } });
  revalidatePath(`/g/${guildId}/willkommen/panels`);
  return { ok: true, id: saved.id, message: 'Gespeichert. Mit „Senden/aktualisieren“ erscheint es in Discord.' };
}

export async function deletePanel(guildId: string, panelId: string): Promise<ActionResult> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  await db().rolePanel.deleteMany({ where: { id: panelId, guildId } });
  revalidatePath(`/g/${guildId}/willkommen/panels`);
  return { ok: true, message: 'Gelöscht. Die Nachricht in Discord kannst du einfach löschen.' };
}

export async function sendPanel(guildId: string, panelId: string): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  const panel = await db().rolePanel.findFirst({ where: { id: panelId, guildId } });
  if (!panel?.channelId) return { ok: false, message: 'Erst einen Kanal wählen und speichern.' };
  const sent = await sendModuleAction(guildId, 'willkommen', `panel:${panelId}`, session.userId);
  return sent
    ? { ok: true, message: panel.messageId ? 'Panel wird aktualisiert.' : 'Panel wird gesendet.' }
    : { ok: false, message: 'Der Bot ist gerade nicht erreichbar.' };
}
