'use server';

import { revalidatePath } from 'next/cache';
import { clearSettings, loadGuildSecrets, saveGuildSecret, saveSettings, type Prisma } from '@moin/db';
import { feedSchema, MAX_FEEDS_PER_GUILD, needsTargetChannel, PLATFORM_LABELS, type Platform } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { appSettings, invalidateSettings } from '@/lib/config';
import { db } from '@/lib/db';
import { createGuildRole } from '@/lib/discord';
import { sendModuleAction } from '@/lib/modules';
import { getSession } from '@/lib/session';
import { resolveChannel, testConnection } from '@/lib/social';
import type { ActionResult } from '../actions';

const done = (guildId: string) => revalidatePath(`/g/${guildId}/alerts`);

/** Feed speichern – alles kommt als JSON aus dem Editor. Der Kanal wird bei Änderung neu nachgeschlagen. */
export async function saveFeed(guildId: string, feedId: string | null, json: string): Promise<ActionResult & { id?: string }> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return { ok: false, message: 'Die Eingaben konnten nicht gelesen werden.' };
  }
  const existing = feedId ? await db().socialFeed.findFirst({ where: { id: feedId, guildId } }) : null;
  if (feedId && !existing) return { ok: false, message: 'Diesen Eintrag gibt es nicht mehr.' };
  const before = existing ? feedSchema.safeParse(existing.data) : null;
  const platform = (existing?.platform ?? raw.platform) as Platform;
  if (!(platform in PLATFORM_LABELS)) return { ok: false, message: 'Bitte eine Plattform wählen.' };
  const input = typeof raw.input === 'string' ? raw.input.trim() : '';

  // Kanal nur nachschlagen, wenn er neu ist oder sich geändert hat
  let channelKey = before?.success ? before.data.channelKey : '';
  let displayName = before?.success ? before.data.displayName : '';
  let warning: string | undefined;
  if (!before?.success || before.data.input !== input) {
    const resolved = await resolveChannel(platform, input);
    if (!resolved.ok) return { ok: false, message: resolved.error };
    channelKey = resolved.channelKey;
    displayName = resolved.displayName;
    warning = resolved.warning;
  }
  const parsed = feedSchema.safeParse({ ...raw, platform, input, channelKey, displayName });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: `Ungültige Eingabe bei „${issue?.path.join('.')}“: ${issue?.message}` };
  }
  // Kanal/Kategorie legt der Bot selbst an, beim Event ist der Kanal freiwillig
  if (!parsed.data.discordChannelId && needsTargetChannel(parsed.data)) return { ok: false, message: 'Bitte einen Discord-Kanal für die Meldungen wählen.' };

  const others = await db().socialFeed.findMany({ where: { guildId, NOT: feedId ? { id: feedId } : undefined }, select: { platform: true, channelKey: true, data: true } });
  if (!feedId && others.length >= MAX_FEEDS_PER_GUILD) return { ok: false, message: `Höchstens ${MAX_FEEDS_PER_GUILD} Kanäle pro Server.` };
  const duplicate = others.some(
    (o) =>
      o.platform === platform &&
      o.channelKey === channelKey &&
      (o.data as { discordChannelId?: string }).discordChannelId === parsed.data.discordChannelId &&
      ((o.data as { display?: string }).display ?? 'classic') === parsed.data.display,
  );
  if (duplicate) return { ok: false, message: 'Diesen Kanal gibt es hier schon mit demselben Discord-Kanal.' };

  const data = parsed.data as unknown as Prisma.InputJsonValue;
  const keyChanged = !existing || existing.channelKey !== channelKey;
  const saved = existing
    ? await db().socialFeed.update({
        where: { id: existing.id },
        data: { data, channelKey, ...(keyChanged ? { state: {}, lastError: null, lastCheckedAt: null } : {}) },
      })
    : await db().socialFeed.create({ data: { guildId, platform, channelKey, data } });
  // Bot gleich einmal prüfen lassen (YouTube merkt sich beim ersten Lauf die vorhandenen Videos)
  await sendModuleAction(guildId, 'alerts', 'check', session.userId);
  done(guildId);
  const name = displayName || channelKey;
  return { ok: true, id: saved.id, message: warning ? `Gespeichert (${name}). ${warning}` : `Gespeichert – ${name} wird jetzt beobachtet.` };
}

export async function deleteFeed(guildId: string, feedId: string): Promise<ActionResult> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  await db().socialFeed.deleteMany({ where: { id: feedId, guildId } });
  done(guildId);
  return { ok: true, message: 'Gelöscht.' };
}

export async function sendTestAlert(guildId: string, feedId: string): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  const feed = await db().socialFeed.findFirst({ where: { id: feedId, guildId } });
  if (!feed) return { ok: false, message: 'Erst speichern, dann testen.' };
  const sent = await sendModuleAction(guildId, 'alerts', `test:${feedId}`, session.userId);
  return sent ? { ok: true, message: 'Test-Meldung wird gesendet (ohne Pings).' } : { ok: false, message: 'Der Bot ist gerade nicht erreichbar.' };
}

// ── Verbindungen (instanzweit, nur Instanz-Admin) ───────────────────────────

async function instanceAdmin(): Promise<boolean> {
  const session = await getSession();
  const { instanceOwnerId } = await appSettings();
  return !!session && !!instanceOwnerId && session.userId === instanceOwnerId;
}

export async function saveConnection(guildId: string, platform: 'twitch' | 'kick', form: FormData): Promise<ActionResult> {
  await requireGuildAccess(guildId);
  if (!(await instanceAdmin())) return { ok: false, message: 'Nur der Instanz-Admin (wer Moin_Julia eingerichtet hat) darf Verbindungen ändern.' };
  const clientId = String(form.get('clientId') ?? '').trim();
  const secret = String(form.get('clientSecret') ?? '').trim();
  const current = await appSettings();
  const currentSecret = platform === 'twitch' ? current.twitchClientSecret : current.kickClientSecret;
  const useSecret = secret || currentSecret || '';
  if (!/^[\w-]{10,64}$/.test(clientId)) return { ok: false, message: 'Die Client-ID sieht nicht richtig aus – bitte genau kopieren.' };
  if (!useSecret) return { ok: false, message: 'Bitte auch das Client-Secret eintragen.' };
  const check = await testConnection(platform, clientId, useSecret);
  if (!check.ok) return check;
  await saveSettings(db(), platform === 'twitch' ? { twitchClientId: clientId, twitchClientSecret: useSecret } : { kickClientId: clientId, kickClientSecret: useSecret });
  invalidateSettings();
  revalidatePath(`/g/${guildId}/alerts/verbindungen`);
  return { ok: true, message: `${PLATFORM_LABELS[platform]} ist verbunden – Meldungen kommen ab der nächsten Minute.` };
}

export async function removeConnection(guildId: string, platform: 'twitch' | 'kick'): Promise<ActionResult> {
  await requireGuildAccess(guildId);
  if (!(await instanceAdmin())) return { ok: false, message: 'Nur der Instanz-Admin darf Verbindungen ändern.' };
  await clearSettings(db(), platform === 'twitch' ? ['twitchClientId', 'twitchClientSecret'] : ['kickClientId', 'kickClientSecret']);
  invalidateSettings();
  revalidatePath(`/g/${guildId}/alerts/verbindungen`);
  return { ok: true, message: `${PLATFORM_LABELS[platform]}-Verbindung entfernt.` };
}

/** Neue Ping-Rolle anlegen (wie GalaxyBots „Neue Rolle erstellen“) */
export async function createPingRole(guildId: string, name: string): Promise<ActionResult & { id?: string }> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  const clean = name.trim().slice(0, 100);
  if (clean.length < 2) return { ok: false, message: 'Bitte einen Namen für die Rolle eingeben.' };
  try {
    const id = await createGuildRole(guildId, clean);
    return { ok: true, id, message: `Rolle „${clean}“ angelegt und ausgewählt.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Rolle konnte nicht angelegt werden.' };
  }
}

// ── Eigene Zugangsdaten pro Server (jeder Server-Admin) ─────────────────────

export async function saveServerConnection(guildId: string, platform: 'twitch' | 'kick', form: FormData): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  const clientId = String(form.get('clientId') ?? '').trim();
  const secret = String(form.get('clientSecret') ?? '').trim();
  const own = await loadGuildSecrets(db(), guildId);
  const useSecret = secret || (platform === 'twitch' ? own.twitchClientSecret : own.kickClientSecret) || '';
  if (!/^[\w-]{10,64}$/.test(clientId)) return { ok: false, message: 'Die Client-ID sieht nicht richtig aus – bitte genau kopieren.' };
  if (!useSecret) return { ok: false, message: 'Bitte auch das Client-Secret eintragen.' };
  const check = await testConnection(platform, clientId, useSecret);
  if (!check.ok) return check;
  await saveGuildSecret(db(), guildId, platform === 'twitch' ? 'twitchClientId' : 'kickClientId', clientId, session.userId);
  await saveGuildSecret(db(), guildId, platform === 'twitch' ? 'twitchClientSecret' : 'kickClientSecret', useSecret, session.userId);
  revalidatePath(`/g/${guildId}/alerts/verbindungen`);
  return { ok: true, message: `Eigene ${PLATFORM_LABELS[platform]}-Verbindung für diesen Server gespeichert – gilt ab der nächsten Abfrage.` };
}

export async function removeServerConnection(guildId: string, platform: 'twitch' | 'kick'): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  await saveGuildSecret(db(), guildId, platform === 'twitch' ? 'twitchClientId' : 'kickClientId', null, session.userId);
  await saveGuildSecret(db(), guildId, platform === 'twitch' ? 'twitchClientSecret' : 'kickClientSecret', null, session.userId);
  revalidatePath(`/g/${guildId}/alerts/verbindungen`);
  return { ok: true, message: `Eigene ${PLATFORM_LABELS[platform]}-Verbindung entfernt – es gilt wieder die der Instanz (falls vorhanden).` };
}
