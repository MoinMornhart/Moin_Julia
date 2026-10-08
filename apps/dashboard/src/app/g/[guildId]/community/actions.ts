'use server';

import { revalidatePath } from 'next/cache';
import { communityConfigSchema, parseCommunityConfig, parseDuration, SUGGESTION_STATUS, type SuggestionStatus } from '@moin/shared';
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
      channelId: formString(form, 'suggestions.channelId') ?? '',
      threads: formBool(form, 'suggestions.threads'),
      staffRoleIds: formIds(form, 'suggestions.staffRoleIds'),
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
  const access = await manager(guildId, (c) => c.suggestions.staffRoleIds);
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
