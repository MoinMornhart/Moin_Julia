import 'server-only';
import { appSettings, DISCORD_API as API, DISCORD_AUTHORIZE, oauthRedirectUri } from './config';
import { cacheGet, cacheSet } from './redis';
import { DEMO_CHANNELS, DEMO_GUILD_ID, DEMO_ROLES } from './demo';

/** Fehlende Einrichtung → klarer Fehler statt „undefined“ in URLs */
async function discordCredentials() {
  const s = await appSettings();
  if (!s.discordToken || !s.discordClientId || !s.discordClientSecret) throw new Error('Discord ist noch nicht eingerichtet.');
  return { token: s.discordToken, clientId: s.discordClientId, clientSecret: s.discordClientSecret };
}

export const OAUTH_SCOPES = ['identify', 'guilds'];

/** Rechte, mit denen der Bot eingeladen wird. Administrator, weil Schutz-Module (Anti-Nuke) weitreichende Rechte brauchen. */
export const BOT_INVITE_PERMISSIONS = '8';

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

/** Rollen eines Servers (über den Bot-Token, 60 s zwischengespeichert). */
export async function fetchGuildRoles(guildId: string): Promise<DiscordRole[]> {
  if (guildId === DEMO_GUILD_ID) return DEMO_ROLES;
  const key = `moin:dash:roles:${guildId}`;
  const cached = await cacheGet<DiscordRole[]>(key);
  if (cached) return cached;
  const roles = (await botApi<DiscordRole[]>(`/guilds/${guildId}/roles`))
    .filter((r) => r.id !== guildId && !r.managed)
    .sort((a, b) => b.position - a.position);
  await cacheSet(key, roles, 60);
  return roles;
}

export interface ChannelOption {
  id: string;
  name: string;
  type: number;
  /** Name der Kategorie, unter der der Kanal steht */
  group: string | null;
}

interface RawChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
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
    .map((c) => ({ id: c.id, name: c.name, type: c.type, group: c.parent_id ? (categories.get(c.parent_id)?.name ?? null) : null }));
  await cacheSet(key, channels, 60);
  return channels;
}

/** Rollen-IDs eines Mitglieds (über den Bot-Token, 60 s zwischengespeichert). */
export async function fetchMemberRoleIds(guildId: string, userId: string): Promise<string[]> {
  const key = `moin:dash:member:${guildId}:${userId}`;
  const cached = await cacheGet<string[]>(key);
  if (cached) return cached;
  try {
    const member = await botApi<{ roles: string[] }>(`/guilds/${guildId}/members/${userId}`);
    await cacheSet(key, member.roles, 60);
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
