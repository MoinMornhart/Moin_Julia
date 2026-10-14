'use server';

import { parseLoggingConfig, PERM, supportAccessKey, supportActive, supportUntilText, type SupportAccess } from '@moin/shared';
import { appSettings } from '@/lib/config';
import { db } from '@/lib/db';
import { DEMO_GUILD_ID } from '@/lib/demo';
import { botApi, botApiPost, botRest, fetchGuildChannels, fetchGuildRoles } from '@/lib/discord';
import { cacheGet, cacheSet } from '@/lib/redis';
import { getSession } from '@/lib/session';

/**
 * Server-Übersicht für den Instanz-Admin (Wunsch Philip, 13./14.10.):
 * alle Server mit dem Bot, Struktur (nur Namen), Einladung per DM; Mitlesen nur mit Support-Zugang des Servers.
 */
async function instanceAdmin() {
  const session = await getSession();
  const s = await appSettings();
  if (!session || !s.instanceOwnerId || session.userId !== s.instanceOwnerId) return null;
  return session;
}

/** Hinweis im Log-Kanal des Servers (Transparenz) */
async function logToServer(guildId: string, content: string): Promise<void> {
  if (guildId === DEMO_GUILD_ID) return;
  const row = await db().guildModule.findUnique({ where: { guildId_moduleId: { guildId, moduleId: 'logging' } }, select: { config: true } });
  const channelId = parseLoggingConfig(row?.config ?? {}).defaultChannelId;
  if (channelId) await botApiPost(`/channels/${channelId}/messages`, { content, allowed_mentions: { parse: [] } }).catch(() => undefined);
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

export async function serverDetails(guildId: string): Promise<{ ok: boolean; message?: string; data?: ServerDetails }> {
  if (!(await instanceAdmin())) return { ok: false, message: 'Nur für den Instanz-Admin.' };
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

/** Einladung (1× nutzbar, 1 Stunde) per DM an den Instanz-Admin – ohne Anfrage (Entscheidung Philip), im Audit-Log + Log-Kanal sichtbar */
export async function inviteMe(guildId: string): Promise<{ ok: boolean; message: string }> {
  const session = await instanceAdmin();
  if (!session) return { ok: false, message: 'Nur für den Instanz-Admin.' };
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
  await logToServer(guildId, `🎟️ Der Bot-Betreiber (<@${session.userId}>, ${session.username}) hat sich eine Einladung zu diesem Server erstellt.`);
  return sent ? { ok: true, message: `Einladung zu „${guild?.name ?? guildId}“ ist per DM unterwegs.` } : { ok: true, message: `DM ging nicht (Privatnachrichten zu?) – hier der Link: ${url}` };
}

export interface ChannelMessage {
  author: string;
  content: string;
  at: string;
}

/** Mitlesen: nur mit Support-Zugang des Servers; Zugriff wird im Log-Kanal vermerkt (höchstens alle 10 Minuten) */
export async function readChannel(guildId: string, channelId: string): Promise<{ ok: boolean; message?: string; messages?: ChannelMessage[] }> {
  const session = await instanceAdmin();
  if (!session) return { ok: false, message: 'Nur für den Instanz-Admin.' };
  if (!(await supportOf(guildId))) return { ok: false, message: 'Kein Support-Zugang: Owner oder Admin muss ihn mit /moin support-zugang erlauben.' };
  const channel = (await fetchGuildChannels(guildId).catch(() => [])).find((c) => c.id === channelId && (c.type === 0 || c.type === 5));
  if (!channel) return { ok: false, message: 'Diesen Textkanal gibt es nicht (mehr).' };
  if (guildId === DEMO_GUILD_ID) return { ok: true, messages: [{ author: 'Anna', content: 'Moin zusammen! 👋', at: '14.10., 09:00' }] };
  const raw = await botApi<{ author: { username: string; global_name?: string | null }; content: string; timestamp: string }[]>(`/channels/${channel.id}/messages?limit=50`).catch(() => null);
  if (!raw) return { ok: false, message: 'Der Bot darf diesen Kanal nicht lesen.' };
  const logKey = `moin:support:log:${guildId}`;
  if (!(await cacheGet<boolean>(logKey))) {
    await cacheSet(logKey, true, 600);
    await logToServer(guildId, `👀 Der Bot-Betreiber (${session.username}) liest per Support-Zugang mit (u. a. #${channel.name}).`);
  }
  return {
    ok: true,
    messages: raw.reverse().map((m) => ({
      author: m.author.global_name ?? m.author.username,
      content: m.content.slice(0, 1500),
      at: new Date(m.timestamp).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    })),
  };
}
