'use server';

import { revalidatePath } from 'next/cache';
import { levelConfigSchema, levelFromXp, levelRewardsInputSchema, parseLevelConfig } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { formBool, formIds, formString, getModuleRow, saveModuleConfig, sendModuleAction } from '@/lib/modules';
import type { ActionResult } from '../actions';

const done = (guildId: string) => {
  revalidatePath(`/g/${guildId}/level`);
  revalidatePath(`/rangliste/${guildId}`);
};

function num(form: FormData, key: string, fallback: number): number {
  const raw = formString(form, key);
  const value = Number(raw);
  return raw !== null && Number.isFinite(value) ? Math.round(value) : fallback;
}

async function currentConfig(guildId: string) {
  return parseLevelConfig((await getModuleRow(guildId, 'level')).config);
}

function invalid(error: { issues: { path: PropertyKey[]; message: string }[] }): ActionResult {
  const issue = error.issues[0];
  return { ok: false, message: `Ungültige Eingabe bei „${issue?.path.join('.')}“: ${issue?.message}` };
}

export async function saveLevelSettings(guildId: string, form: FormData): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins dürfen Einstellungen ändern.' };
  const current = await currentConfig(guildId);
  const parsed = levelConfigSchema.safeParse({
    ...current,
    textXp: formBool(form, 'textXp'),
    textXpMin: num(form, 'textXpMin', current.textXpMin),
    textXpMax: num(form, 'textXpMax', current.textXpMax),
    cooldownSeconds: num(form, 'cooldownSeconds', current.cooldownSeconds),
    voiceXp: formBool(form, 'voiceXp'),
    voiceXpPerMinute: num(form, 'voiceXpPerMinute', current.voiceXpPerMinute),
    voiceNeedsCompany: formBool(form, 'voiceNeedsCompany'),
    ignoredChannelIds: formIds(form, 'ignoredChannelIds'),
    ignoredRoleIds: formIds(form, 'ignoredRoleIds'),
    levelUpMode: formString(form, 'levelUpMode') ?? current.levelUpMode,
    // Felder, die gerade ausgeblendet sind (z. B. Modus „aus“), fehlen im Formular – dann den alten Wert behalten
    // (die leere Kanal-Auswahl schickt nichts mit – bei „fester Kanal“ zählt das als „kein Kanal“)
    levelUpChannelId:
      form.has('levelUpChannelId') || formString(form, 'levelUpMode') === 'channel' ? (formString(form, 'levelUpChannelId') ?? '') : current.levelUpChannelId,
    levelUpText: form.has('levelUpText') ? (formString(form, 'levelUpText') ?? '') : current.levelUpText,
    cardStyle: formString(form, 'cardStyle') ?? current.cardStyle,
    publicLeaderboard: formBool(form, 'publicLeaderboard'),
  });
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.levelUpMode === 'channel' && !parsed.data.levelUpChannelId) return { ok: false, message: 'Bitte einen Kanal für die Level-up-Meldung wählen.' };
  const delivered = await saveModuleConfig(guildId, 'level', parsed.data, session.userId);
  done(guildId);
  return { ok: true, message: delivered ? 'Gespeichert – gilt ab sofort.' : 'Gespeichert – der Bot übernimmt es beim nächsten Neustart.' };
}

/** Belohnungsrollen + XP-Bonus (JSON aus dem Editor); danach gleicht der Bot die Rollen aller Mitglieder ab */
export async function saveLevelRewards(guildId: string, json: string): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, message: 'Die Eingaben konnten nicht gelesen werden.' };
  }
  const parsed = levelRewardsInputSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const levels = parsed.data.rewards.map((r) => r.level);
  if (new Set(levels).size !== levels.length) return { ok: false, message: 'Jedes Level darf nur eine Belohnung haben.' };
  const config = { ...(await currentConfig(guildId)), ...parsed.data, rewards: [...parsed.data.rewards].sort((a, b) => a.level - b.level) };
  const delivered = await saveModuleConfig(guildId, 'level', config, session.userId);
  if (delivered) await sendModuleAction(guildId, 'level', 'sync-roles', session.userId);
  done(guildId);
  return { ok: true, message: delivered ? 'Gespeichert – der Bot gleicht die Rollen jetzt bei allen ab.' : 'Gespeichert – die Rollen werden beim nächsten Aufstieg angepasst.' };
}

/** XP eines Mitglieds setzen (z. B. Übernahme vom alten Bot oder Korrektur) */
export async function setMemberXp(guildId: string, userId: string, xp: number): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  if (!Number.isInteger(xp) || xp < 0 || xp > 100_000_000) return { ok: false, message: 'Bitte eine ganze Zahl zwischen 0 und 100.000.000.' };
  const row = await db().memberXp.findUnique({ where: { guildId_userId: { guildId, userId } } });
  if (!row) return { ok: false, message: 'Dieses Mitglied hat noch keinen Eintrag.' };
  const { level } = levelFromXp(xp);
  await db().memberXp.update({ where: { id: row.id }, data: { xp, level } });
  await sendModuleAction(guildId, 'level', 'sync-roles', session.userId);
  done(guildId);
  return { ok: true, message: `XP gesetzt – jetzt Level ${level}.` };
}

export async function resetAllXp(guildId: string, confirm: string): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  if (confirm.trim().toUpperCase() !== 'ZURÜCKSETZEN') return { ok: false, message: 'Bitte zur Bestätigung ZURÜCKSETZEN eintippen.' };
  const { count } = await db().memberXp.deleteMany({ where: { guildId } });
  await sendModuleAction(guildId, 'level', 'sync-roles', session.userId);
  done(guildId);
  return { ok: true, message: `${count} Einträge gelöscht – alle starten wieder bei Level 0.` };
}
