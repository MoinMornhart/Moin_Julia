'use server';

import { revalidatePath } from 'next/cache';
import { communityConfigSchema, findSuggestionBoard, MAIN_SUGGESTION_BOARD, parseCommunityConfig, parseDuration, SUGGESTION_STATUS, suggestionBoardSchema, type SuggestionStatus } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { fetchMemberRoleIds } from '@/lib/discord';
import { formBool, formIds, formString, getModuleRow, saveModuleConfig, sendModuleAction } from '@/lib/modules';
import type { ActionResult } from '../actions';

const MAX_GIVEAWAY_MS = 30 * 86_400_000;

function num(form: FormData, key: string, fallback: number): number {
  const raw = formString(form, key);
  const value = Number(raw);
  return raw !== null && Number.isFinite(value) ? Math.round(value) : fallback;
}

async function config(guildId: string) {
  return parseCommunityConfig((await getModuleRow(guildId, 'community')).config);
}

/** Owner/Admin oder eine Manager- bzw. (bei Vorschlägen) Team-Rolle */
async function manager(guildId: string, extraRoles: (c: Awaited<ReturnType<typeof config>>) => string[] = () => []) {
  const access = await requireGuildAccess(guildId);
  if (access.canEdit) return access;
  const c = await config(guildId);
  const allowed = [...c.managerRoleIds, ...extraRoles(c)];
  if (!allowed.length) return null;
  const roles = await fetchMemberRoleIds(guildId, access.session.userId).catch(() => [] as string[]);
  return roles.some((r) => allowed.includes(r)) ? access : null;
}

export async function saveCommunitySettings(guildId: string, form: FormData): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins dürfen Einstellungen ändern.' };
  const current = await config(guildId);
  const parsed = communityConfigSchema.safeParse({
    birthdays: {
      enabled: formBool(form, 'birthdays.enabled'),
      channelId: formString(form, 'birthdays.channelId') ?? '',
      roleId: formString(form, 'birthdays.roleId') ?? '',
      text: formString(form, 'birthdays.text') ?? current.birthdays.text,
      hour: num(form, 'birthdays.hour', current.birthdays.hour),
    },
    counting: {
      enabled: formBool(form, 'counting.enabled'),
      channelId: formString(form, 'counting.channelId') ?? '',
      allowDouble: formBool(form, 'counting.allowDouble'),
      resetOnFail: formBool(form, 'counting.resetOnFail'),
      deleteWrong: formBool(form, 'counting.deleteWrong'),
    },
    suggestions: {
      enabled: formBool(form, 'suggestions.enabled'),
      name: formString(form, 'suggestions.name') ?? current.suggestions.name,
      channelId: formString(form, 'suggestions.channelId') ?? '',
      threads: formBool(form, 'suggestions.threads'),
      staffRoleIds: formIds(form, 'suggestions.staffRoleIds'),
      staffChannelId: formString(form, 'suggestions.staffChannelId') ?? '',
      resultChannelId: formString(form, 'suggestions.resultChannelId') ?? '',
      anonymous: formBool(form, 'suggestions.anonymous'),
      // Weitere Bereiche werden im Reiter „Vorschläge“ gepflegt
      boards: current.suggestions.boards,
    },
    starboard: {
      enabled: formBool(form, 'starboard.enabled'),
      channelId: formString(form, 'starboard.channelId') ?? '',
      emoji: formString(form, 'starboard.emoji') ?? '⭐',
      threshold: num(form, 'starboard.threshold', current.starboard.threshold),
      selfStar: formBool(form, 'starboard.selfStar'),
      ignoredChannelIds: formIds(form, 'starboard.ignoredChannelIds'),
    },
    managerRoleIds: formIds(form, 'managerRoleIds'),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: `Ungültige Eingabe bei „${issue?.path.join('.')}“: ${issue?.message}` };
  }
  const c = parsed.data;
  const missing = [
    c.birthdays.enabled && !c.birthdays.channelId && 'Geburtstage',
    c.counting.enabled && !c.counting.channelId && 'Zählen',
    c.suggestions.enabled && !c.suggestions.channelId && 'Vorschläge',
    c.starboard.enabled && !c.starboard.channelId && 'Starboard',
  ].filter(Boolean);
  if (missing.length) return { ok: false, message: `Bitte einen Kanal wählen für: ${missing.join(', ')}.` };
  if (c.counting.enabled && c.counting.channelId !== current.counting.channelId) {
    // Neuer Zähl-Kanal → von vorne
    await db().countingState.deleteMany({ where: { guildId } });
  }
  const delivered = await saveModuleConfig(guildId, 'community', c, session.userId);
  revalidatePath(`/g/${guildId}/community`);
  return { ok: true, message: delivered ? 'Gespeichert – gilt ab sofort.' : 'Gespeichert – der Bot übernimmt es beim nächsten Neustart.' };
}

export async function resetCounting(guildId: string): Promise<ActionResult> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  await db().countingState.updateMany({ where: { guildId }, data: { current: 0, lastUserId: null } });
  revalidatePath(`/g/${guildId}/community`);
  return { ok: true, message: 'Zurückgesetzt – es geht wieder bei 1 los.' };
}

// ── Vorschläge ──────────────────────────────────────────────────────────────

export async function decideSuggestion(guildId: string, suggestionId: string, status: SuggestionStatus, reason: string): Promise<ActionResult> {
  // Team-Rollen des Bereichs, zu dem der Vorschlag gehört
  const target = await db().suggestion.findFirst({ where: { id: suggestionId, guildId }, select: { boardId: true } });
  const access = await manager(guildId, (c) => findSuggestionBoard(c.suggestions, target?.boardId ?? MAIN_SUGGESTION_BOARD)?.staffRoleIds ?? c.suggestions.staffRoleIds);
  if (!access) return { ok: false, message: 'Du darfst über Vorschläge nicht entscheiden.' };
  if (!SUGGESTION_STATUS.includes(status)) return { ok: false, message: 'Unbekannter Status.' };
  const text = reason.trim().slice(0, 1000) || null;
  const { count } = await db().suggestion.updateMany({
    where: { id: suggestionId, guildId },
    data: { status, reason: text, decidedBy: access.session.userId, decidedAt: status === 'open' ? null : new Date() },
  });
  if (!count) return { ok: false, message: 'Vorschlag nicht gefunden.' };
  await sendModuleAction(guildId, 'community', `suggestion:${suggestionId}`, access.session.userId);
  revalidatePath(`/g/${guildId}/community/vorschlaege`);
  return { ok: true, message: 'Gespeichert – Nachricht in Discord wird aktualisiert und die Person per DM informiert.' };
}

/** Weitere Vorschlags-Bereiche speichern (Hauptbereich steht unter Einstellungen) */
export async function saveSuggestionBoards(guildId: string, json: string): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, message: 'Die Eingaben konnten nicht gelesen werden.' };
  }
  const parsed = suggestionBoardSchema.array().max(9).safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = typeof issue?.path[0] === 'number' ? `Bereich ${issue.path[0] + 1}` : 'Bereiche';
    return { ok: false, message: `Ungültige Eingabe (${where}): ${issue?.path[1] === 'channelId' ? 'bitte einen Kanal wählen' : issue?.message}` };
  }
  const names = parsed.data.map((b) => b.name.toLowerCase());
  if (new Set(names).size !== names.length) return { ok: false, message: 'Jeder Bereich braucht einen eigenen Namen.' };
  const current = await config(guildId);
  const next = communityConfigSchema.parse({ ...current, suggestions: { ...current.suggestions, boards: parsed.data } });
  const delivered = await saveModuleConfig(guildId, 'community', next, session.userId);
  revalidatePath(`/g/${guildId}/community/vorschlaege`);
  return { ok: true, message: delivered ? 'Gespeichert – gilt ab sofort.' : 'Gespeichert – der Bot übernimmt es beim nächsten Neustart.' };
}

/** Nachricht mit Knopf „Vorschlag einreichen“ in den Kanal des Bereichs schicken (bleibt danach immer unten) */
export async function sendSuggestionPanel(guildId: string, boardId: string): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  const c = await config(guildId);
  if (!c.suggestions.enabled) return { ok: false, message: 'Erst unter Einstellungen die Vorschläge einschalten.' };
  const board = findSuggestionBoard(c.suggestions, boardId);
  if (!board || board.id !== boardId) return { ok: false, message: 'Diesen Bereich gibt es nicht.' };
  const sent = await sendModuleAction(guildId, 'community', `suggestpanel:${board.id}`, session.userId);
  return sent ? { ok: true, message: `Knopf „Vorschlag einreichen“ wird in den Kanal von „${board.name}“ gepostet.` } : { ok: false, message: 'Der Bot ist gerade nicht erreichbar.' };
}

export async function deleteSuggestion(guildId: string, suggestionId: string): Promise<ActionResult> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  await db().suggestion.deleteMany({ where: { id: suggestionId, guildId } });
  revalidatePath(`/g/${guildId}/community/vorschlaege`);
  return { ok: true, message: 'Gelöscht (die Nachricht in Discord bleibt stehen).' };
}

// ── Giveaways ───────────────────────────────────────────────────────────────

export async function createGiveaway(guildId: string, form: FormData): Promise<ActionResult> {
  const access = await manager(guildId);
  if (!access) return { ok: false, message: 'Du darfst keine Giveaways starten.' };
  const channelId = formString(form, 'channelId');
  const prize = (formString(form, 'prize') ?? '').slice(0, 200);
  const durationMs = parseDuration(formString(form, 'duration') ?? '');
  const winners = Math.max(1, Math.min(20, num(form, 'winners', 1)));
  const roleId = formString(form, 'roleId');
  if (!channelId || !/^\d{15,22}$/.test(channelId)) return { ok: false, message: 'Bitte einen Kanal wählen.' };
  if (!prize) return { ok: false, message: 'Bitte einen Preis eintragen.' };
  if (!durationMs || durationMs > MAX_GIVEAWAY_MS) return { ok: false, message: 'Ungültige Dauer. Beispiele: 30m, 2h, 1d12h (höchstens 30 Tage).' };
  if (roleId && !/^\d{15,22}$/.test(roleId)) return { ok: false, message: 'Ungültige Rolle.' };
  const prize64 = Buffer.from(prize, 'utf8').toString('base64url');
  const sent = await sendModuleAction(guildId, 'community', `giveaway-start:${channelId}:${durationMs}:${winners}:${roleId ?? '-'}:${prize64}`, access.session.userId);
  revalidatePath(`/g/${guildId}/community/giveaways`);
  return sent ? { ok: true, message: 'Giveaway wird gestartet – in ein paar Sekunden steht es in Discord.' } : { ok: false, message: 'Der Bot ist gerade nicht erreichbar.' };
}

export async function giveawayAction(guildId: string, giveawayId: string, kind: 'end' | 'reroll'): Promise<ActionResult> {
  const access = await manager(guildId);
  if (!access) return { ok: false, message: 'Du darfst Giveaways nicht steuern.' };
  const g = await db().giveaway.findFirst({ where: { id: giveawayId, guildId } });
  if (!g) return { ok: false, message: 'Giveaway nicht gefunden.' };
  if (kind === 'end' && g.ended) return { ok: false, message: 'Schon beendet.' };
  if (kind === 'reroll' && !g.ended) return { ok: false, message: 'Erst beenden, dann neu auslosen.' };
  const sent = await sendModuleAction(guildId, 'community', `giveaway-${kind}:${giveawayId}`, access.session.userId);
  revalidatePath(`/g/${guildId}/community/giveaways`);
  return sent ? { ok: true, message: kind === 'end' ? 'Wird beendet – Gewinner werden gezogen.' : 'Neue Gewinner werden gezogen.' } : { ok: false, message: 'Der Bot ist gerade nicht erreichbar.' };
}

// ── Geburtstage ─────────────────────────────────────────────────────────────

export async function deleteBirthday(guildId: string, birthdayId: string): Promise<ActionResult> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  await db().birthday.deleteMany({ where: { id: birthdayId, guildId } });
  revalidatePath(`/g/${guildId}/community/geburtstage`);
  return { ok: true, message: 'Entfernt.' };
}
