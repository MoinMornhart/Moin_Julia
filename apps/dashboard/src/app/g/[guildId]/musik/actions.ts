'use server';

import { revalidatePath } from 'next/cache';
import { clearSettings, saveSettings } from '@moin/db';
import { isYtdlpUrl, LOOP_MODES, MUSIC_EFFECT_IDS, musicConfigSchema, parseMusicConfig, streamingLinkKind } from '@moin/shared';
import { requireGuildAccess } from '@/lib/access';
import { appSettings, invalidateSettings } from '@/lib/config';
import { db } from '@/lib/db';
import { fetchMemberRoleIds } from '@/lib/discord';
import { isDemoMode } from '@/lib/env';
import { getModuleRow, saveModuleConfig, sendModuleAction } from '@/lib/modules';
import type { ActionResult } from '../actions';

export async function saveMusicSettings(guildId: string, json: string): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, message: 'Nur Owner und Admins.' };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, message: 'Die Eingaben konnten nicht gelesen werden.' };
  }
  const current = parseMusicConfig((await getModuleRow(guildId, 'musik')).config);
  const parsed = musicConfigSchema.safeParse({ ...current, ...(raw as object) });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path[0] === 'presets' ? `Favorit ${Number(issue.path[1]) + 1}` : String(issue?.path.join('.'));
    return { ok: false, message: `Ungültige Eingabe (${where}): ${issue?.message}` };
  }
  // „Links ins eigene Netz“ öffnet das Heimnetz des Servers, auf dem Moin_Julia läuft – das entscheidet nur der Instanz-Admin
  const { instanceOwnerId } = await appSettings();
  if (parsed.data.allowPrivateUrls !== current.allowPrivateUrls && (!instanceOwnerId || instanceOwnerId !== session.userId)) {
    return { ok: false, message: '„Links ins eigene Netz“ darf nur der Instanz-Admin ändern (die Person, die Moin_Julia eingerichtet hat).' };
  }
  if (parsed.data.presets.some((p) => isYtdlpUrl(p.url) || streamingLinkKind(p.url)) && (await appSettings()).musicYoutube !== 'true') {
    return { ok: false, message: 'YouTube- und Spotify-Links gehen nur, wenn der Instanz-Admin oben „YouTube & Co.“ eingeschaltet hat.' };
  }
  const delivered = await saveModuleConfig(guildId, 'musik', parsed.data, session.userId);
  revalidatePath(`/g/${guildId}/musik`);
  return { ok: true, message: delivered ? 'Gespeichert – gilt ab sofort. Favoriten erscheinen in /musik play.' : 'Gespeichert.' };
}

export interface RadioHit {
  name: string;
  url: string;
  country: string;
  bitrate: number;
}

/** Sender im Verzeichnis radio-browser.info suchen (für Favoriten) */
export async function searchRadio(guildId: string, query: string): Promise<{ ok: boolean; hits: RadioHit[]; message?: string }> {
  const { canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) return { ok: false, hits: [], message: 'Nur Owner und Admins.' };
  const q = query.trim().slice(0, 60);
  if (q.length < 2) return { ok: false, hits: [], message: 'Mindestens 2 Zeichen.' };
  if (isDemoMode()) {
    return { ok: true, hits: [{ name: `${q} FM (Demo)`, url: 'https://stream.example.org/demo.mp3', country: 'DE', bitrate: 128 }] };
  }
  try {
    const params = new URLSearchParams({ name: q, limit: '12', hidebroken: 'true', order: 'clickcount', reverse: 'true' });
    const res = await fetch(`https://de1.api.radio-browser.info/json/stations/search?${params}`, {
      headers: { 'user-agent': 'MoinJulia/1.0 (Dashboard)' },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, hits: [], message: `Radio-Verzeichnis antwortet mit HTTP ${res.status}.` };
    const data = (await res.json()) as { name?: string; url_resolved?: string; url?: string; countrycode?: string; bitrate?: number }[];
    const hits = data
      .map((s) => ({ name: (s.name ?? '').trim().slice(0, 60), url: s.url_resolved || s.url || '', country: s.countrycode ?? '', bitrate: s.bitrate ?? 0 }))
      .filter((s) => s.name && /^https?:\/\//.test(s.url) && s.url.length <= 500);
    return { ok: true, hits, message: hits.length ? undefined : 'Nichts gefunden.' };
  } catch {
    return { ok: false, hits: [], message: 'Das Radio-Verzeichnis ist gerade nicht erreichbar.' };
  }
}

/** Steuerung aus dem Dashboard: Owner/Admin oder DJ-Rolle */
export async function musicControl(guildId: string, action: string): Promise<ActionResult> {
  const { session, canEdit } = await requireGuildAccess(guildId);
  if (!canEdit) {
    const config = parseMusicConfig((await getModuleRow(guildId, 'musik')).config);
    const roles = config.djRoleIds.length ? await fetchMemberRoleIds(guildId, session.userId).catch(() => [] as string[]) : [];
    if (!roles.some((r) => config.djRoleIds.includes(r))) return { ok: false, message: 'Steuern dürfen Admins und DJ-Rollen.' };
  }
  const allowed = ['pause', 'skip', 'stop', 'back', 'shuffle', 'volup', 'voldown', 'autoplay:on', 'autoplay:off', 'effect:aus', ...MUSIC_EFFECT_IDS.map((e) => `effect:${e}`), ...LOOP_MODES.map((m) => `loop:${m}`)];
  if (!allowed.includes(action) && !/^(volume|remove|jump):\d{1,3}$/.test(action)) return { ok: false, message: 'Unbekannte Aktion.' };
  const sent = await sendModuleAction(guildId, 'musik', action, session.userId);
  return sent ? { ok: true, message: 'Erledigt.' } : { ok: false, message: 'Der Bot ist gerade nicht erreichbar.' };
}

/**
 * YouTube/SoundCloud (und Spotify-/Apple-Links über die YouTube-Suche) für die ganze Instanz an/aus.
 * Verstößt gegen die Nutzungsbedingungen von YouTube/Spotify – darum nur der Instanz-Admin, auf eigenes Risiko.
 */
export async function setMusicYoutube(guildId: string, on: boolean): Promise<ActionResult> {
  const { session } = await requireGuildAccess(guildId);
  const { instanceOwnerId } = await appSettings();
  if (!instanceOwnerId || instanceOwnerId !== session.userId) return { ok: false, message: 'Das darf nur der Instanz-Admin (die Person, die Moin_Julia eingerichtet hat).' };
  if (on) await saveSettings(db(), { musicYoutube: 'true' });
  else await clearSettings(db(), ['musicYoutube']);
  invalidateSettings();
  revalidatePath(`/g/${guildId}/musik`);
  return { ok: true, message: on ? 'YouTube & Co. sind an (in spätestens 30 Sekunden auch im Bot).' : 'YouTube & Co. sind aus.' };
}
