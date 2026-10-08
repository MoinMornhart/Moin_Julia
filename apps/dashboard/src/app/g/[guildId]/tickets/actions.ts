'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@moin/db';
import { convertGalaxyPlaceholders, messageTemplateSchema, newReasonId, ticketPanelSchema, ticketsConfigSchema } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { formBool, formIds, formString, saveModuleConfig, sendModuleAction } from '@/lib/modules';
import type { ActionResult } from '../actions';

function num(form: FormData, key: string, fallback: number): number {
  const raw = formString(form, key);
  const value = Number(raw);
  return raw !== null && Number.isFinite(value) ? Math.round(value) : fallback;
}

function issueText(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  const issue = error.issues[0];
  return `Ungültige Eingabe bei „${issue?.path.join('.')}“: ${issue?.message}`;
}

export async function saveTicketsSettings(guildId: string, form: FormData): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins dürfen Einstellungen ändern.' };
  const parsed = ticketsConfigSchema.safeParse({
    teamRoleIds: formIds(form, 'teamRoleIds'),
    categoryId: formString(form, 'categoryId'),
    logChannelId: formString(form, 'logChannelId'),
    nameTemplate: formString(form, 'nameTemplate') ?? undefined,
    maxOpenPerUser: num(form, 'maxOpenPerUser', 1),
    pingTeam: formBool(form, 'pingTeam'),
    welcomeText: formString(form, 'welcomeText') ?? '',
    transcriptDm: formBool(form, 'transcriptDm'),
    feedback: formBool(form, 'feedback'),
    autoClose: { enabled: formBool(form, 'autoClose.enabled'), hours: num(form, 'autoClose.hours', 48) },
    deleteAfterSec: num(form, 'deleteAfterSec', 10),
  });
  if (!parsed.success) return { ok: false, message: issueText(parsed.error) };
  const delivered = await saveModuleConfig(guildId, 'tickets', parsed.data, session.userId);
  return { ok: true, message: delivered ? 'Gespeichert – gilt ab sofort.' : 'Gespeichert – der Bot übernimmt es beim nächsten Neustart.' };
}

/** Panel speichern: Gründe kommen als JSON aus dem Editor (inkl. Fragen) */
export async function saveTicketPanel(guildId: string, panelId: string | null, form: FormData): Promise<ActionResult & { id?: string }> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  let reasons: unknown = [];
  let template: unknown;
  try {
    reasons = JSON.parse(formString(form, 'reasons') ?? '[]');
    template = messageTemplateSchema.parse(JSON.parse(formString(form, 'template') ?? '{}'));
  } catch {
    return { ok: false, message: 'Die Eingaben konnten nicht gelesen werden.' };
  }
  const parsed = ticketPanelSchema.safeParse({
    name: formString(form, 'name') ?? '',
    channelId: formString(form, 'channelId'),
    style: formString(form, 'style') ?? 'buttons',
    template,
    reasons,
  });
  if (!parsed.success) return { ok: false, message: Array.isArray(reasons) && reasons.length ? issueText(parsed.error) : 'Füge mindestens einen Grund hinzu.' };
  const { channelId, name, ...rest } = parsed.data;
  const data = { ...rest, name } as unknown as Prisma.InputJsonValue;
  const saved = panelId
    ? await db().ticketPanel.update({ where: { id: panelId, guildId }, data: { name, channelId, data } })
    : await db().ticketPanel.create({ data: { guildId, name, channelId, data } });
  revalidatePath(`/g/${guildId}/tickets/panels`);
  return { ok: true, id: saved.id, message: 'Gespeichert. Mit „In Discord senden“ erscheint es im Kanal.' };
}

export async function deleteTicketPanel(guildId: string, panelId: string): Promise<ActionResult> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  await db().ticketPanel.deleteMany({ where: { id: panelId, guildId } });
  revalidatePath(`/g/${guildId}/tickets/panels`);
  return { ok: true, message: 'Gelöscht. Die Nachricht in Discord kannst du einfach löschen.' };
}

export async function sendTicketPanel(guildId: string, panelId: string): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  const panel = await db().ticketPanel.findFirst({ where: { id: panelId, guildId } });
  if (!panel?.channelId) return { ok: false, message: 'Erst einen Kanal wählen und speichern.' };
  const sent = await sendModuleAction(guildId, 'tickets', `panel:${panelId}`, session.userId);
  return sent ? { ok: true, message: panel.messageId ? 'Panel wird aktualisiert.' : 'Panel wird gesendet.' } : { ok: false, message: 'Der Bot ist gerade nicht erreichbar.' };
}

/** Panel des alten Bots (aus dem Scan) als Ticket-Panel übernehmen – Optionen werden zu Gründen */
export async function importTicketPanel(
  guildId: string,
  source: { title: string; description: string; options: string[]; channelId: string; color: number | null },
): Promise<ActionResult & { id?: string }> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  const ids: string[] = [];
  const reasons = (source.options.length ? source.options : ['Support']).slice(0, 10).map((label) => {
    const id = newReasonId(ids);
    ids.push(id);
    return { id, label: label.slice(0, 80) };
  });
  const color = source.color !== null ? `#${source.color.toString(16).padStart(6, '0')}` : '#ff7a59';
  const parsed = ticketPanelSchema.safeParse({
    name: (source.title || 'Übernommenes Panel').slice(0, 60),
    channelId: /^\d{15,22}$/.test(source.channelId) ? source.channelId : null,
    template: {
      embed: {
        color,
        title: convertGalaxyPlaceholders(source.title).text.slice(0, 256),
        description: convertGalaxyPlaceholders(source.description).text.slice(0, 4096),
      },
    },
    reasons,
  });
  if (!parsed.success) return { ok: false, message: issueText(parsed.error) };
  const { channelId, name, ...rest } = parsed.data;
  const saved = await db().ticketPanel.create({ data: { guildId, name, channelId, data: { ...rest, name } as unknown as Prisma.InputJsonValue } });
  revalidatePath(`/g/${guildId}/tickets/panels`);
  return { ok: true, id: saved.id, message: `Als Ticket-Panel „${name}“ mit ${reasons.length} Gründen übernommen.` };
}
