'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@moin/db';
import { APPLICATION_TAGS, positionSchema, teamConfigSchema } from '@moin/shared';
import { canReviewApplications, requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { formIds, formString, saveModuleConfig, sendModuleAction } from '@/lib/modules';
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

/** Zugriff + Prüfer-Recht (Owner/Admin oder Prüfer-Rolle) */
async function reviewer(guildId: string) {
  const access = await requireGuildAccess(guildId);
  return { ...access, canReview: await canReviewApplications(access) };
}

async function loadApp(guildId: string, appId: string) {
  return db().application.findFirst({ where: { id: appId, guildId } });
}

const done = (guildId: string, appId?: string) => {
  revalidatePath(`/g/${guildId}/team`);
  if (appId) revalidatePath(`/g/${guildId}/team/bewerbung/${appId}`);
};

// ── Einstellungen & Stellen (nur Owner/Admin) ───────────────────────────────

export async function saveTeamSettings(guildId: string, form: FormData): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins dürfen Einstellungen ändern.' };
  const parsed = teamConfigSchema.safeParse({
    logChannelId: formString(form, 'logChannelId'),
    reviewerRoleIds: formIds(form, 'reviewerRoleIds'),
    probationRoleId: formString(form, 'probationRoleId'),
    probationReminderDays: num(form, 'probationReminderDays', 3),
    panelChannelId: formString(form, 'panelChannelId'),
    panelText: formString(form, 'panelText') ?? '',
    acceptText: formString(form, 'acceptText') ?? '',
    rejectText: formString(form, 'rejectText') ?? '',
  });
  if (!parsed.success) return { ok: false, message: issueText(parsed.error) };
  const delivered = await saveModuleConfig(guildId, 'team', parsed.data, session.userId);
  return { ok: true, message: delivered ? 'Gespeichert – gilt ab sofort.' : 'Gespeichert – der Bot übernimmt es beim nächsten Neustart.' };
}

export async function sendApplyPanel(guildId: string): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  const sent = await sendModuleAction(guildId, 'team', 'panel', session.userId);
  return sent ? { ok: true, message: 'Panel wird gesendet.' } : { ok: false, message: 'Der Bot ist gerade nicht erreichbar.' };
}

/** Stelle speichern – alles kommt als JSON aus dem Editor (inkl. Fragen) */
export async function savePosition(guildId: string, positionId: string | null, json: string): Promise<ActionResult & { id?: string }> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, message: 'Die Eingaben konnten nicht gelesen werden.' };
  }
  const parsed = positionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: issueText(parsed.error) };
  const data = parsed.data as unknown as Prisma.InputJsonValue;
  let id = positionId;
  if (positionId) {
    const { count } = await db().jobPosition.updateMany({ where: { id: positionId, guildId }, data: { data } });
    if (!count) return { ok: false, message: 'Diese Stelle gibt es nicht mehr – bitte Seite neu laden.' };
  } else {
    id = (await db().jobPosition.create({ data: { guildId, data, sortOrder: await db().jobPosition.count({ where: { guildId } }) } })).id;
  }
  revalidatePath(`/g/${guildId}/team/stellen`);
  revalidatePath(`/bewerben/${guildId}`);
  return { ok: true, id: id!, message: 'Gespeichert – die Stelle steht so auf der Bewerbungsseite.' };
}

export async function deletePosition(guildId: string, positionId: string): Promise<ActionResult> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  await db().jobPosition.deleteMany({ where: { id: positionId, guildId } });
  revalidatePath(`/g/${guildId}/team/stellen`);
  return { ok: true, message: 'Stelle gelöscht. Bisherige Bewerbungen bleiben erhalten.' };
}

// ── Posteingang (Prüfer) ────────────────────────────────────────────────────

export async function claimApplication(guildId: string, appId: string): Promise<ActionResult> {
  const { session, canReview } = await reviewer(guildId);
  if (!canReview) return { ok: false, message: 'Du darfst keine Bewerbungen bearbeiten.' };
  const app = await loadApp(guildId, appId);
  if (!app) return { ok: false, message: 'Bewerbung nicht gefunden.' };
  const mine = app.handlerId === session.userId;
  await db().application.update({ where: { id: appId }, data: mine ? { handlerId: null, handlerTag: null } : { handlerId: session.userId, handlerTag: session.username } });
  done(guildId, appId);
  return { ok: true, message: mine ? 'Freigegeben.' : 'Du bearbeitest diese Bewerbung jetzt.' };
}

/** Weitergeben an ein anderes Team-Mitglied */
export async function passOnApplication(guildId: string, appId: string, userId: string, userTag: string): Promise<ActionResult> {
  const { canReview } = await reviewer(guildId);
  if (!canReview) return { ok: false, message: 'Du darfst keine Bewerbungen bearbeiten.' };
  if (!/^\d{15,22}$/.test(userId)) return { ok: false, message: 'Bitte ein Team-Mitglied wählen.' };
  await db().application.updateMany({ where: { id: appId, guildId }, data: { handlerId: userId, handlerTag: userTag.slice(0, 64) } });
  done(guildId, appId);
  return { ok: true, message: `An ${userTag} weitergegeben.` };
}

export async function setApplicationTag(guildId: string, appId: string, tag: string | null): Promise<ActionResult> {
  const { canReview } = await reviewer(guildId);
  if (!canReview) return { ok: false, message: 'Du darfst keine Bewerbungen bearbeiten.' };
  if (tag !== null && !(APPLICATION_TAGS as readonly string[]).includes(tag)) return { ok: false, message: 'Unbekannter Tag.' };
  await db().application.updateMany({ where: { id: appId, guildId }, data: { tag } });
  done(guildId, appId);
  return { ok: true, message: tag ? 'Tag gesetzt.' : 'Tag entfernt.' };
}

export async function addApplicationNote(guildId: string, appId: string, text: string): Promise<ActionResult> {
  const { session, canReview } = await reviewer(guildId);
  if (!canReview) return { ok: false, message: 'Du darfst keine Bewerbungen bearbeiten.' };
  const note = text.trim().slice(0, 1000);
  if (!note) return { ok: false, message: 'Die Notiz ist leer.' };
  const app = await loadApp(guildId, appId);
  if (!app) return { ok: false, message: 'Bewerbung nicht gefunden.' };
  const notes = [...(Array.isArray(app.notes) ? app.notes : []), { by: session.userId, byTag: session.username, text: note, at: new Date().toISOString() }];
  await db().application.update({ where: { id: appId }, data: { notes: notes as Prisma.InputJsonValue } });
  done(guildId, appId);
  return { ok: true, message: 'Notiz gespeichert.' };
}

/** Gesprächseinladung: Zeitpunkt + Ort (Text oder Sprachkanal) → DM mit Zusagen/Absagen */
export async function inviteToInterview(guildId: string, appId: string, at: string, place: string): Promise<ActionResult> {
  const { session, canReview } = await reviewer(guildId);
  if (!canReview) return { ok: false, message: 'Du darfst keine Bewerbungen bearbeiten.' };
  const when = new Date(at);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) return { ok: false, message: 'Bitte einen Zeitpunkt in der Zukunft wählen.' };
  const where = place.trim().slice(0, 200);
  if (!where) return { ok: false, message: 'Wo findet das Gespräch statt?' };
  await db().application.updateMany({ where: { id: appId, guildId }, data: { interview: { at: when.toISOString(), place: where, status: 'invited', by: session.userId } } });
  const sent = await sendModuleAction(guildId, 'team', `interview:${appId}`, session.userId);
  done(guildId, appId);
  return { ok: true, message: sent ? 'Einladung wird per DM verschickt.' : 'Gespeichert – der Bot ist gerade nicht erreichbar, die DM folgt später nicht automatisch.' };
}

export async function acceptApplication(guildId: string, appId: string, withProbation: boolean): Promise<ActionResult> {
  const { session, canReview } = await reviewer(guildId);
  if (!canReview) return { ok: false, message: 'Du darfst keine Bewerbungen bearbeiten.' };
  const app = await loadApp(guildId, appId);
  if (!app || app.status !== 'pending') return { ok: false, message: 'Diese Bewerbung ist schon entschieden.' };
  const position = await db().jobPosition.findUnique({ where: { id: app.positionId } });
  const data = position ? positionSchema.safeParse(position.data) : null;
  const days = data?.success ? data.data.probationDays : 0;
  await db().application.update({ where: { id: appId }, data: { status: 'accepted', decidedBy: session.userId, decidedAt: new Date(), decisionReason: null } });
  if (withProbation && days > 0) {
    await db().probation.create({
      data: { guildId, userId: app.userId, userTag: app.userTag, applicationId: app.id, positionTitle: app.positionTitle, endAt: new Date(Date.now() + days * 86_400_000) },
    });
  }
  const sent = await sendModuleAction(guildId, 'team', `accept:${appId}`, session.userId);
  done(guildId, appId);
  return { ok: true, message: sent ? 'Angenommen – der Bot vergibt die Rollen und schreibt eine DM.' : 'Angenommen – der Bot ist gerade nicht erreichbar, Rollen bitte von Hand vergeben.' };
}

export async function rejectApplication(guildId: string, appId: string, reason: string): Promise<ActionResult> {
  const { session, canReview } = await reviewer(guildId);
  if (!canReview) return { ok: false, message: 'Du darfst keine Bewerbungen bearbeiten.' };
  const why = reason.trim().slice(0, 1000);
  if (!why) return { ok: false, message: 'Bitte eine Begründung angeben – die Person bekommt sie per DM.' };
  const app = await loadApp(guildId, appId);
  if (!app || app.status !== 'pending') return { ok: false, message: 'Diese Bewerbung ist schon entschieden.' };
  await db().application.update({ where: { id: appId }, data: { status: 'rejected', decidedBy: session.userId, decidedAt: new Date(), decisionReason: why } });
  const sent = await sendModuleAction(guildId, 'team', `reject:${appId}`, session.userId);
  done(guildId, appId);
  return { ok: true, message: sent ? 'Abgelehnt – die Person bekommt die Begründung per DM.' : 'Abgelehnt – der Bot ist gerade nicht erreichbar.' };
}

export async function deleteApplication(guildId: string, appId: string): Promise<ActionResult> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Löschen dürfen nur Owner und Admins.' };
  await db().application.deleteMany({ where: { id: appId, guildId } });
  done(guildId);
  return { ok: true, message: 'Bewerbung gelöscht.' };
}

export async function decideProbation(guildId: string, probationId: string, passed: boolean): Promise<ActionResult> {
  const { session, canReview } = await reviewer(guildId);
  if (!canReview) return { ok: false, message: 'Du darfst das nicht entscheiden.' };
  const p = await db().probation.findFirst({ where: { id: probationId, guildId, status: 'running' } });
  if (!p) return { ok: false, message: 'Diese Probezeit ist schon entschieden.' };
  await db().probation.update({ where: { id: p.id }, data: { status: passed ? 'passed' : 'failed', decidedBy: session.userId } });
  await sendModuleAction(guildId, 'team', `${passed ? 'probation-pass' : 'probation-fail'}:${p.id}`, session.userId);
  revalidatePath(`/g/${guildId}/team/probezeit`);
  return { ok: true, message: passed ? 'Bestanden – die Probe-Rolle wird entzogen.' : 'Nicht bestanden – Team- und Probe-Rolle werden entzogen.' };
}

