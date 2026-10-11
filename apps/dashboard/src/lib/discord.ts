import 'server-only';
import { appSettings, DISCORD_API as API, DISCORD_AUTHORIZE, oauthRedirectUri } from './config';
import { cacheGet, cacheSet } from './redis';
import { PERM, readOnlyOverwrite, type CheckChannel, type CheckOverwrite, type CheckRole } from '@moin/shared';
import { DEMO_CHANNELS, DEMO_GUILD_ID, DEMO_ROLES } from './demo';

/** Fehlende Einrichtung → klarer Fehler statt „undefined“ in URLs */
async function discordCredentials() {
  const s = await appSettings();
  if (!s.discordToken || !s.discordClientId || !s.discordClientSecret) throw new Error('Discord ist noch nicht eingerichtet.');
  return { token: s.discordToken, clientId: s.discordClientId, clientSecret: s.discordClientSecret };
}

export const OAUTH_SCOPES = ['identify', 'guilds'];

/** Rechte, mit denen der Bot eingeladen wird. Administrator, weil Schutz-Module (Anti-Nuke) weitreichende Rechte brauchen. */
/**
 * Rechte beim Einladen – nur, was die Module wirklich brauchen (Security-Audit), statt „Administrator“:
 * Mitglieder kicken/bannen/timeouten, Kanäle + Rollen + Server verwalten, Audit-Log, Nachrichten verwalten,
 * Senden/Embeds/Dateien/Verlauf/Reaktionen/externe Emojis/@everyone, Threads, Sprache (Verbinden, Sprechen,
 * Video, Verschieben). „Administrator ersetzen“ im Owner-Bereich kann damit nur diese Rechte vergeben.
 */
export const BOT_INVITE_PERMISSIONS = '1409038151414';

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export interface PartialGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
  /** Rechte als Bitfeld (Dezimal-String) */
  permissions?: string;
}

export async function authorizeUrl(state: string): Promise<string> {
  const { clientId } = await discordCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: await oauthRedirectUri(),
    scope: OAUTH_SCOPES.join(' '),
    state,
    prompt: 'none',
  });
  return `${DISCORD_AUTHORIZE}?${params}`;
}

/** Präfix im OAuth-„state“, an dem der Callback eine Bot-Einladung erkennt. */
export const INVITE_STATE_PREFIX = 'einladung-';

/**
 * Einladungs-Link für den Bot. Mit `redirectUri` schickt Discord nach dem Einladen zurück ins Dashboard
 * (gleiche Weiterleitungs-URL wie beim Login, muss also nicht extra eingetragen werden).
 */
export function inviteUrl(clientId: string, guildId?: string, redirectUri?: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'bot applications.commands',
    permissions: BOT_INVITE_PERMISSIONS,
  });
  if (guildId) {
    params.set('guild_id', guildId);
    params.set('disable_guild_select', 'true');
  }
  if (redirectUri) {
    params.set('redirect_uri', redirectUri);
    params.set('response_type', 'code');
    params.set('state', `${INVITE_STATE_PREFIX}${guildId ?? ''}`);
  }
  return `${DISCORD_AUTHORIZE}?${params}`;
}

export async function exchangeCode(code: string): Promise<string> {
  const { clientId, clientSecret } = await discordCredentials();
  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: await oauthRedirectUri() }),
  });
  if (!res.ok) {
    throw new Error(`Discord-Token-Austausch fehlgeschlagen (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function userApi<T>(accessToken: string, route: string): Promise<T> {
  const res = await fetch(`${API}${route}`, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Discord-API ${route} fehlgeschlagen (${res.status})`);
  return (await res.json()) as T;
}

export function fetchCurrentUser(accessToken: string): Promise<DiscordUser> {
  return userApi<DiscordUser>(accessToken, '/users/@me');
}

export function fetchCurrentUserGuilds(accessToken: string): Promise<PartialGuild[]> {
  return userApi<PartialGuild[]>(accessToken, '/users/@me/guilds');
}

export async function botApi<T>(route: string): Promise<T> {
  const { token } = await discordCredentials();
  const res = await fetch(`${API}${route}`, { headers: { authorization: `Bot ${token}` } });
  if (!res.ok) throw new Error(`Discord-API ${route} fehlgeschlagen (${res.status})`);
  return (await res.json()) as T;
}

/** POST an die Discord-API mit dem Bot-Token (z. B. Hinweis in einen Kanal) */
export async function botApiPost<T = unknown>(route: string, body: unknown): Promise<T> {
  const { token } = await discordCredentials();
  const res = await fetch(`${API}${route}`, { method: 'POST', headers: { authorization: `Bot ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Discord-API ${route} fehlgeschlagen (${res.status})`);
  return (await res.json()) as T;
}

/** Rollen eines Servers (über den Bot-Token, 60 s zwischengespeichert). */
export async function fetchGuildRoles(guildId: string): Promise<DiscordRole[]> {
  if (guildId === DEMO_GUILD_ID) return DEMO_ROLES;
  const key = `moin:dash:roles:${guildId}`;
  const cached = await cacheGet<DiscordRole[]>(key);
  if (cached) return cached;
  const roles = (await botApi<DiscordRole[]>(`/guilds/${guildId}/roles`))
    .filter((r) => r.id !== guildId && !r.managed)
    .sort((a, b) => b.position - a.position);
  // Discord-Daten 5 s zwischenspeichern: bei 1-s-Aktualisierung sonst Sperre durch Discords Limits
  await cacheSet(key, roles, 5);
  return roles;
}

export interface ChannelOption {
  id: string;
  name: string;
  type: number;
  /** Name der Kategorie, unter der der Kanal steht */
  group: string | null;
  /** Altersbeschränkt (NSFW) */
  nsfw?: boolean;
}

interface RawChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
  nsfw?: boolean;
}

/** Kanaltypen: 0 Text, 2 Voice, 4 Kategorie, 5 Ankündigung, 13 Stage, 15 Forum */
export const TEXT_CHANNEL_TYPES = [0, 5];
export const VOICE_CHANNEL_TYPES = [2, 13];

/** Kanäle eines Servers, sortiert wie in Discord und nach Kategorie gruppiert (60 s zwischengespeichert). */
export async function fetchGuildChannels(guildId: string): Promise<ChannelOption[]> {
  if (guildId === DEMO_GUILD_ID) return DEMO_CHANNELS;
  const key = `moin:dash:channels:${guildId}`;
  const cached = await cacheGet<ChannelOption[]>(key);
  if (cached) return cached;
  const raw = await botApi<RawChannel[]>(`/guilds/${guildId}/channels`);
  const categories = new Map(raw.filter((c) => c.type === 4).map((c) => [c.id, c]));
  const sortKey = (c: RawChannel) => {
    const parent = c.parent_id ? categories.get(c.parent_id) : undefined;
    return [parent ? parent.position + 1 : 0, c.type === 2 || c.type === 13 ? 1 : 0, c.position];
  };
  // Kategorien (Typ 4) bleiben drin – z. B. „Neue Kanäle in Kategorie“ bei eigenen Sprachkanälen
  const channels = raw
    .sort((a, b) => {
      const [a1, a2, a3] = sortKey(a);
      const [b1, b2, b3] = sortKey(b);
      return a1! - b1! || a2! - b2! || a3! - b3!;
    })
    .map((c) => ({ id: c.id, name: c.name, type: c.type, group: c.parent_id ? (categories.get(c.parent_id)?.name ?? null) : null, ...(c.nsfw ? { nsfw: true } : {}) }));
  await cacheSet(key, channels, 5);
  return channels;
}

/** Rollen-IDs eines Mitglieds (über den Bot-Token, 60 s zwischengespeichert). */
export async function fetchMemberRoleIds(guildId: string, userId: string): Promise<string[]> {
  const key = `moin:dash:member:${guildId}:${userId}`;
  const cached = await cacheGet<string[]>(key);
  if (cached) return cached;
  try {
    const member = await botApi<{ roles: string[] }>(`/guilds/${guildId}/members/${userId}`);
    await cacheSet(key, member.roles, 5);
    return member.roles;
  } catch {
    return [];
  }
}

export function guildIconUrl(guild: { id: string; icon: string | null }, size = 128): string | null {
  return guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=${size}` : null;
}

export function userAvatarUrl(user: { userId: string; avatar: string | null }, size = 64): string {
  return user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png?size=${size}`
    : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.userId) >> 22n) % 6}.png`;
}

/**
 * Sprachkanal für die Statistik anlegen (ganz oben, sichtbar, aber niemand kann beitreten).
 * Gibt die neue Kanal-ID zurück. Demo: erfundene ID.
 */
export async function createStatVoiceChannel(guildId: string, name: string): Promise<string> {
  if (guildId === DEMO_GUILD_ID) return `9${Date.now()}${Math.floor(Math.random() * 1e4)}`.padEnd(18, '0').slice(0, 18);
  const { token, clientId } = await discordCredentials();
  const VIEW = 1 << 10;
  const CONNECT = 1 << 20;
  const MANAGE_CHANNELS = 1 << 4;
  const res = await fetch(`${API}/guilds/${guildId}/channels`, {
    method: 'POST',
    headers: { authorization: `Bot ${token}`, 'content-type': 'application/json', 'x-audit-log-reason': 'Statistik-Kanal (Dashboard)' },
    body: JSON.stringify({
      name: name.slice(0, 100),
      type: 2,
      position: 0,
      permission_overwrites: [
        { id: guildId, type: 0, allow: String(VIEW), deny: String(CONNECT) },
        { id: clientId, type: 1, allow: String(VIEW | CONNECT | MANAGE_CHANNELS), deny: '0' },
      ],
    }),
  });
  if (!res.ok) throw new Error(res.status === 403 ? 'Moin_Julia darf hier keine Kanäle anlegen (Recht „Kanäle verwalten“ fehlt).' : `Discord-Fehler ${res.status}`);
  await cacheSet(`moin:dash:channels:${guildId}`, null, 1).catch(() => undefined);
  return ((await res.json()) as { id: string }).id;
}

/** Rolle anlegen (z. B. Ping-Rolle für Live-Meldungen) – erwähnbar, ohne Rechte */
export async function createGuildRole(guildId: string, name: string): Promise<string> {
  if (guildId === DEMO_GUILD_ID) return `8${Date.now()}${Math.floor(Math.random() * 1e4)}`.padEnd(18, '0').slice(0, 18);
  const { token } = await discordCredentials();
  const res = await fetch(`${API}/guilds/${guildId}/roles`, {
    method: 'POST',
    headers: { authorization: `Bot ${token}`, 'content-type': 'application/json', 'x-audit-log-reason': 'Ping-Rolle für Live-Meldungen (Dashboard)' },
    body: JSON.stringify({ name: name.slice(0, 100), permissions: '0', mentionable: true }),
  });
  if (!res.ok) throw new Error(res.status === 403 ? 'Moin_Julia darf keine Rollen anlegen (Recht „Rollen verwalten“ fehlt).' : `Discord-Fehler ${res.status}`);
  await cacheSet(`moin:dash:roles:${guildId}`, null, 1).catch(() => undefined);
  return ((await res.json()) as { id: string }).id;
}

export interface MemberOption {
  id: string;
  name: string;
}

type RawMember = { user: { id: string; username: string; global_name?: string | null; bot?: boolean }; nick?: string | null };
const memberName = (m: RawMember) => m.nick || m.user.global_name || m.user.username;

const DEMO_MEMBERS: MemberOption[] = [
  { id: '100000000000000300', name: 'Anna' },
  { id: '100000000000000301', name: 'lukas.gamer' },
  { id: '100000000000000302', name: 'ben.plays' },
  { id: '100000000000000303', name: 'Ozzy' },
  { id: '100000000000000304', name: 'MoinMornhart' },
];

/** Mitglieder suchen (Name/Spitzname beginnt mit …) – für Personen-Auswahl im Dashboard */
export async function searchGuildMembers(guildId: string, query: string): Promise<MemberOption[]> {
  const q = query.trim().slice(0, 50);
  if (!q) return [];
  if (guildId === DEMO_GUILD_ID) return DEMO_MEMBERS.filter((m) => m.name.toLowerCase().startsWith(q.toLowerCase()));
  const members = await botApi<RawMember[]>(`/guilds/${guildId}/members/search?query=${encodeURIComponent(q)}&limit=10`);
  return members.filter((m) => !m.user.bot).map((m) => ({ id: m.user.id, name: memberName(m) }));
}

/** Namen zu gespeicherten Personen-IDs (je 1 h zwischengespeichert; unbekannte zeigen die ID) */
export async function memberNames(guildId: string, ids: readonly string[]): Promise<MemberOption[]> {
  const unique = [...new Set(ids)].slice(0, 100);
  if (guildId === DEMO_GUILD_ID) return unique.map((id) => DEMO_MEMBERS.find((m) => m.id === id) ?? { id, name: id });
  const out: MemberOption[] = [];
  for (let i = 0; i < unique.length; i += 5) {
    const part = await Promise.all(
      unique.slice(i, i + 5).map(async (id) => {
        const key = `moin:dash:member-name:${guildId}:${id}`;
        const cached = await cacheGet<{ name: string }>(key);
        if (cached) return { id, name: cached.name };
        const m = await botApi<RawMember>(`/guilds/${guildId}/members/${id}`).catch(() => null);
        const name = m ? memberName(m) : id;
        await cacheSet(key, { name }, 3600);
        return { id, name };
      }),
    );
    out.push(...part);
  }
  return out;
}

// ── Rechte-Check (Issue #5) ─────────────────────────────────────────────────

type RawPermChannel = RawChannel & { permission_overwrites?: CheckOverwrite[] };
const demoReadOnlyKey = (guildId: string) => `moin:demo:readonly:${guildId}`;

/** Rollen (mit @everyone und Bot-Rollen) und Text-Kanäle samt Ausnahmen – für den Rechte-Check */
export async function fetchPermissionData(guildId: string): Promise<{ roles: CheckRole[]; channels: (CheckChannel & { group: string | null })[] }> {
  if (guildId === DEMO_GUILD_ID) {
    const readOnly = new Set((await cacheGet<string[]>(demoReadOnlyKey(guildId))) ?? ['100000000000000021']);
    const deny = readOnlyOverwrite(undefined, true).deny;
    return {
      roles: [{ id: guildId, name: '@everyone', permissions: String(PERM.ViewChannel | PERM.SendMessages | PERM.MentionEveryone) }, ...DEMO_ROLES.map((r) => ({ id: r.id, name: r.name, permissions: r.permissions ?? '0', managed: r.managed }))],
      channels: DEMO_CHANNELS.filter((c) => TEXT_CHANNEL_TYPES.includes(c.type)).map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        group: c.group,
        overwrites: readOnly.has(c.id) ? [{ id: guildId, type: 0, allow: '0', deny }] : [],
      })),
    };
  }
  const [roles, raw] = await Promise.all([botApi<(DiscordRole & { permissions: string })[]>(`/guilds/${guildId}/roles`), botApi<RawPermChannel[]>(`/guilds/${guildId}/channels`)]);
  const categories = new Map(raw.filter((c) => c.type === 4).map((c) => [c.id, c]));
  const channels = raw
    .filter((c) => TEXT_CHANNEL_TYPES.includes(c.type) || c.type === 15)
    .sort((a, b) => (a.parent_id ? (categories.get(a.parent_id)?.position ?? 0) + 1 : 0) - (b.parent_id ? (categories.get(b.parent_id)?.position ?? 0) + 1 : 0) || a.position - b.position)
    .map((c) => ({ id: c.id, name: c.name, type: c.type, group: c.parent_id ? (categories.get(c.parent_id)?.name ?? null) : null, overwrites: c.permission_overwrites ?? [] }));
  return { roles: roles.sort((a, b) => b.position - a.position).map((r) => ({ id: r.id, name: r.name, permissions: r.permissions, managed: r.managed })), channels };
}

/** „Nur lesen“ für @everyone in einem Kanal an/aus (andere Rechte bleiben, wie sie sind) */
export async function setChannelReadOnly(guildId: string, channelId: string, on: boolean, by: string): Promise<void> {
  if (guildId === DEMO_GUILD_ID) {
    const set = new Set((await cacheGet<string[]>(demoReadOnlyKey(guildId))) ?? ['100000000000000021']);
    if (on) set.add(channelId);
    else set.delete(channelId);
    await cacheSet(demoReadOnlyKey(guildId), [...set], 86_400);
    return;
  }
  const channel = await botApi<RawPermChannel & { guild_id?: string }>(`/channels/${channelId}`);
  if (channel.guild_id !== guildId) throw new Error('Kanal gehört nicht zu diesem Server.');
  const current = channel.permission_overwrites?.find((o) => o.type === 0 && o.id === guildId);
  const { token } = await discordCredentials();
  const res = await fetch(`${API}/channels/${channelId}/permissions/${guildId}`, {
    method: 'PUT',
    headers: { authorization: `Bot ${token}`, 'content-type': 'application/json', 'x-audit-log-reason': encodeURIComponent(`Nur lesen ${on ? 'an' : 'aus'} (Dashboard, ${by})`).slice(0, 500) },
    body: JSON.stringify({ type: 0, ...readOnlyOverwrite(current, on) }),
  });
  if (!res.ok) throw new Error(res.status === 403 ? 'Moin_Julia darf die Rechte in diesem Kanal nicht ändern (Recht „Rollen verwalten“ bzw. „Berechtigungen verwalten“ fehlt).' : `Discord-Fehler ${res.status}`);
}
