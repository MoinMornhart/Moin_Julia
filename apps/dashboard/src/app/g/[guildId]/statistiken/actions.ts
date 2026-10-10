'use server';

import { revalidatePath } from 'next/cache';
import { fillStatTemplate, parseStatsConfig, statsConfigSchema } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { createStatVoiceChannel } from '@/lib/discord';
import { getModuleRow, saveModuleConfig, sendModuleAction } from '@/lib/modules';
import type { ActionResult } from '../actions';

async function current(guildId: string) {
  return parseStatsConfig((await getModuleRow(guildId, 'statistiken')).config);
}

/** Statistik-Kanäle + Aufbewahrung + ignorierte Kanäle (JSON aus dem Editor) */
export async function saveStatsSettings(guildId: string, json: string): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, message: 'Die Eingaben konnten nicht gelesen werden.' };
  }
  const parsed = statsConfigSchema.safeParse({ ...(await current(guildId)), ...(raw as object) });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: `Ungültige Eingabe bei „${issue?.path.join('.')}“: ${issue?.message}` };
  }
  const ids = parsed.data.statChannels.map((c) => c.channelId);
  if (new Set(ids).size !== ids.length) return { ok: false, message: 'Jeder Kanal darf nur einmal vorkommen.' };
  const delivered = await saveModuleConfig(guildId, 'statistiken', parsed.data, session.userId);
  if (delivered) await sendModuleAction(guildId, 'statistiken', 'refresh', session.userId);
  revalidatePath(`/g/${guildId}/statistiken/kanaele`);
  return { ok: true, message: delivered ? 'Gespeichert – die Kanalnamen werden gleich aktualisiert (danach höchstens alle 10 Minuten).' : 'Gespeichert.' };
}

/** Neuen Sprachkanal anlegen und direkt als Statistik-Kanal eintragen */
export async function createStatChannel(guildId: string, template: string): Promise<ActionResult & { channel?: { channelId: string; template: string } }> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  const t = template.trim().slice(0, 90);
  if (!t) return { ok: false, message: 'Bitte eine Vorlage eingeben, z. B. „👥 Mitglieder: {members}“.' };
  const config = await current(guildId);
  if (config.statChannels.length >= 10) return { ok: false, message: 'Höchstens 10 Statistik-Kanäle.' };
  let channelId: string;
  try {
    // Erster Name ohne echte Zahlen – der Bot setzt sie gleich danach
    channelId = await createStatVoiceChannel(guildId, fillStatTemplate(t, { members: 0, humans: 0, bots: 0, boosts: 0, channels: 0, roles: 0, voice: 0 }));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Kanal konnte nicht angelegt werden.' };
  }
  const next = statsConfigSchema.safeParse({ ...config, statChannels: [...config.statChannels, { channelId, template: t }] });
  if (!next.success) return { ok: false, message: 'Discord hat eine unerwartete Kanal-ID geliefert – bitte Seite neu laden und den Kanal unter „Vorhandenen Kanal nutzen“ wählen.' };
  const delivered = await saveModuleConfig(guildId, 'statistiken', next.data, session.userId);
  if (delivered) await sendModuleAction(guildId, 'statistiken', 'refresh', session.userId);
  revalidatePath(`/g/${guildId}/statistiken/kanaele`);
  return { ok: true, channel: { channelId, template: t }, message: 'Kanal angelegt – er steht ganz oben, niemand kann beitreten.' };
}
