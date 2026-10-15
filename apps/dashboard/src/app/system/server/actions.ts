'use server';

import {
  cleanSupportReason,
  parseSupportScopes,
  PERM,
  SUPPORT_REQUEST_COOLDOWN_MS,
  supportAccessKey,
  supportActive,
  supportAllows,
  supportBlockKey,
  supportRequestKey,
  supportScopesText,
  supportUntilText,
  type SupportAccess,
  type SupportRequest,
} from '@moin/shared';
import { appSettings } from '@/lib/config';
import { db } from '@/lib/db';
import { DEMO_GUILD_ID } from '@/lib/demo';
import { botApi, botApiPost, botRest, fetchGuildChannels, fetchGuildRoles } from '@/lib/discord';
import { cacheGet, storeJson } from '@/lib/redis';
import { sendModuleAction } from '@/lib/modules';
import { getSession } from '@/lib/session';

/**
 * Server-Übersicht für den Instanz-Admin (Wunsch Philip, 13./14.10.):
 * alle Server mit dem Bot. Seit Issue #13 lädt NICHTS ohne Freigabe des Servers: Struktur, Einladung und Mitlesen
 * erst, wenn Owner/Admin den Betreiber-Zugang erlaubt haben (Anfrage mit Begründung → Knöpfe in Discord).
 */
async function instanceAdmin() {
  const session = await getSession();
  const s = await appSettings();
  if (!session || !s.instanceOwnerId || session.userId !== s.instanceOwnerId) return null;
  return session;
}

async function supportOf(guildId: string): Promise<SupportAccess | null> {
  const access = await cacheGet<SupportAccess>(supportAccessKey(guildId));
  return supportActive(access) ? access : null;
}

export interface ServerDetails {
  owner: string;
  members: number | null;
  categories: { name: string; channels: { id: string; name: string; voice: boolean }[] }[];
  roles: { name: string; color: number }[];
  /** Fehlende Bot-Rechte, die für Einladung/Mitlesen wichtig sind */
  missing: string[];
  support: { until: string; by: string } | null;
}

/** Zustand der Freigabe eines Servers für den Betreiber (für die Übersicht) */
export interface AccessState {
  granted: { scopes: string; until: string; by: string; reason: string | null } | null;
  blocked: boolean;
  requestedAt: string | null;
}

export async function accessState(guildId: string): Promise<AccessState> {
  const [grant, blocked, request] = await Promise.all([supportOf(guildId), cacheGet<unknown>(supportBlockKey(guildId)), cacheGet<SupportRequest>(supportRequestKey(guildId))]);
  return {
    granted: grant ? { scopes: supportScopesText(grant), until: supportUntilText(grant), by: grant.byName, reason: grant.reason ?? null } : null,
    blocked: !!blocked,
    requestedAt: request ? new Date(request.at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null,
  };
}

/** Zugang anfragen: Begründung + Umfang → Nachricht mit Knöpfen im Log-Kanal bzw. per DM an den Owner (Issue #13) */
export async function requestAccess(guildId: string, reasonRaw: string, scopesRaw: string[]): Promise<{ ok: boolean; message: string }> {
  const session = await instanceAdmin();
  if (!session) return { ok: false, message: 'Nur für den Instanz-Admin.' };
  const guild = await db().guild.findUnique({ where: { id: guildId } });
  if (!guild?.botPresent) return { ok: false, message: 'Der Bot ist auf diesem Server nicht (mehr).' };
  const reason = cleanSupportReason(reasonRaw);
  if (!reason) return { ok: false, message: 'Bitte schreib kurz, warum du Zugang brauchst (mindestens 10 Zeichen).' };
  const scopes = parseSupportScopes(scopesRaw);
  if (!scopes) return { ok: false, message: 'Bitte wähle aus, wofür du Zugang brauchst.' };
  if (await cacheGet<unknown>(supportBlockKey(guildId))) return { ok: false, message: '🚫 Dieser Server hat dich als Betreiber gesperrt – keine Anfragen möglich.' };
  const old = await cacheGet<SupportRequest>(supportRequestKey(guildId));
  if (old && Date.now() - old.at < SUPPORT_REQUEST_COOLDOWN_MS) return { ok: false, message: 'Du hast hier schon angefragt – bitte warte auf die Antwort (höchstens alle 6 Stunden).' };
  const request: SupportRequest = { by: session.userId, byName: session.username, reason, scopes, at: Date.now() };
  await storeJson(supportRequestKey(guildId), request, 7 * 86_400);
  if (guildId === DEMO_GUILD_ID) return { ok: true, message: 'Demo: Anfrage wäre jetzt im Log-Kanal bzw. per DM beim Owner.' };
  if (!(await sendModuleAction(guildId, 'kern', 'access-request', session.userId))) return { ok: false, message: 'Der Bot ist gerade nicht erreichbar.' };
  return { ok: true, message: `Anfrage an „${guild.name}“ geschickt – du bekommst eine DM, sobald entschieden ist.` };
}

export async function serverDetails(guildId: string): Promise<{ ok: boolean; message?: string; data?: ServerDetails }> {
  if (!(await instanceAdmin())) return { ok: false, message: 'Nur für den Instanz-Admin.' };
  // Ohne Freigabe wird nichts geladen (Issue #13)
  if (!(await supportOf(guildId))) return { ok: false, message: '🔒 Keine Freigabe für diesen Server – erst Zugang anfragen.' };
  const guild = await db().guild.findUnique({ where: { id: guildId } });
  if (!guild?.botPresent) return { ok: false, message: 'Der Bot ist auf diesem Server nicht (mehr).' };
  try {
    const [channels, roles, info] = await Promise.all([
      fetchGuildChannels(guildId),
      fetchGuildRoles(guildId),
      guildId === DEMO_GUILD_ID ? Promise.resolve({ approximate_member_count: 6 }) : botApi<{ approximate_member_count?: number }>(`/guilds/${guildId}?with_counts=true`).catch(() => ({ approximate_member_count: undefined })),
    ]);
    const owner = guildId === DEMO_GUILD_ID ? 'Demo-Owner' : ((await botApi<{ username: string }>(`/users/${guild.ownerId}`).catch(() => null))?.username ?? guild.ownerId);
    const groups = new Map<string, { id: string; name: string; voice: boolean }[]>();
    for (const c of channels.filter((c) => c.type !== 4)) {
      const g = c.group ?? '(ohne Kategorie)';
      groups.set(g, [...(groups.get(g) ?? []), { id: c.id, name: c.name, voice: c.type === 2 || c.type === 13 }]);
    }
    const access = await supportOf(guildId);
    const botPerms = guildId === DEMO_GUILD_ID ? PERM.Administrator : await botPermissions(guildId).catch(() => 0n);
    const missing = [
      ...(botPerms & PERM.Administrator ? [] : [...((botPerms & (1n << 0n)) === 0n ? ['Einladung erstellen'] : []), ...((botPerms & PERM.ViewChannel) === 0n ? ['Kanäle ansehen'] : []), ...((botPerms & (1n << 16n)) === 0n ? ['Nachrichtenverlauf lesen'] : [])]),
    ];
    return {
      ok: true,
      data: {
        owner,
        members: info.approximate_member_count ?? null,
        categories: [...groups].map(([name, list]) => ({ name, channels: list })),
        roles: roles.map((r) => ({ name: r.name, color: r.color })),
        missing,
        support: access ? { until: supportUntilText(access), by: access.byName } : null,
      },
    };
  } catch {
    return { ok: false, message: 'Discord ist gerade nicht erreichbar.' };
  }
}

/** Server-weite Rechte des Bots (Rollen zusammengezählt) */
async function botPermissions(guildId: string): Promise<bigint> {
  const me = await botApi<{ id: string }>('/users/@me');
  const [member, roles] = await Promise.all([botApi<{ roles: string[] }>(`/guilds/${guildId}/members/${me.id}`), botApi<{ id: string; permissions: string }[]>(`/guilds/${guildId}/roles`)]);
  const ids = new Set([...member.roles, guildId]);
  return roles.filter((r) => ids.has(r.id)).reduce((acc, r) => acc | BigInt(r.permissions), 0n);
}

/** Einladung (1× nutzbar, 1 Stunde) per DM an den Instanz-Admin – nur mit Freigabe des Servers (Issue #13), Grund im Audit-Log */
export async function inviteMe(guildId: string): Promise<{ ok: boolean; message: string }> {
  const session = await instanceAdmin();
  if (!session) return { ok: false, message: 'Nur für den Instanz-Admin.' };
  if (!(await supportOf(guildId))) return { ok: false, message: '🔒 Keine Freigabe für diesen Server – erst Zugang anfragen.' };
  if (guildId === DEMO_GUILD_ID) return { ok: true, message: 'Demo: Einladung wäre jetzt per DM unterwegs.' };
  const channels = await fetchGuildChannels(guildId).catch(() => []);
  const textChannels = channels.filter((c) => c.type === 0 || c.type === 5);
  let url: string | null = null;
  for (const c of textChannels.slice(0, 5)) {
    const invite = await botRest<{ code: string }>('POST', `/channels/${c.id}/invites`, { max_age: 3600, max_uses: 1, unique: true }, 'Einladung für den Bot-Betreiber').catch(() => null);
    if (invite?.code) {
      url = `https://discord.gg/${invite.code}`;
      break;
    }
  }
  if (!url) return { ok: false, message: 'Der Bot darf dort keine Einladung erstellen (Recht „Einladung erstellen“ fehlt).' };
  const dm = await botApiPost<{ id: string }>('/users/@me/channels', { recipient_id: session.userId }).catch(() => null);
  const sent = dm ? await botApiPost(`/channels/${dm.id}/messages`, { content: `🎟️ Deine Einladung (1× nutzbar, 1 Stunde gültig): ${url}`, allowed_mentions: { parse: [] } }).then(() => true, () => false) : false;
  const guild = await db().guild.findUnique({ where: { id: guildId }, select: { name: true } });
  return sent ? { ok: true, message: `Einladung zu „${guild?.name ?? guildId}“ ist per DM unterwegs.` } : { ok: true, message: `DM ging nicht (Privatnachrichten zu?) – hier der Link: ${url}` };
}

export interface ChannelMessage {
  author: string;
  content: string;
  at: string;
}

/** Mitlesen: nur mit Support-Zugang des Servers */
export async function readChannel(guildId: string, channelId: string): Promise<{ ok: boolean; message?: string; messages?: ChannelMessage[] }> {
  const session = await instanceAdmin();
  if (!session) return { ok: false, message: 'Nur für den Instanz-Admin.' };
  if (!supportAllows(await supportOf(guildId), 'lesen')) return { ok: false, message: 'Mitlesen ist nicht freigegeben: Owner oder Admin müssen „Kanäle mitlesen“ erlauben.' };
  const channel = (await fetchGuildChannels(guildId).catch(() => [])).find((c) => c.id === channelId && (c.type === 0 || c.type === 5));
  if (!channel) return { ok: false, message: 'Diesen Textkanal gibt es nicht (mehr).' };
  if (guildId === DEMO_GUILD_ID) return { ok: true, messages: [{ author: 'Anna', content: 'Moin zusammen! 👋', at: '14.10., 09:00' }] };
  const raw = await botApi<{ author: { username: string; global_name?: string | null }; content: string; timestamp: string }[]>(`/channels/${channel.id}/messages?limit=50`).catch(() => null);
  if (!raw) return { ok: false, message: 'Der Bot darf diesen Kanal nicht lesen.' };
  return {
    ok: true,
    messages: raw.reverse().map((m) => ({
      author: m.author.global_name ?? m.author.username,
      content: m.content.slice(0, 1500),
      at: new Date(m.timestamp).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    })),
  };
}
