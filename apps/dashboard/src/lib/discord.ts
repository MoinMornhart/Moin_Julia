import 'server-only';
import { discordBotToken, discordClientId, discordClientSecret, oauthRedirectUri } from './env';
import { cacheGet, cacheSet } from './redis';
import { DEMO_GUILD_ID, DEMO_ROLES } from './demo';

const API = 'https://discord.com/api/v10';

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
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: discordClientId(),
    response_type: 'code',
    redirect_uri: oauthRedirectUri(),
    scope: OAUTH_SCOPES.join(' '),
    state,
    prompt: 'none',
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

export function inviteUrl(guildId?: string): string {
  const params = new URLSearchParams({
    client_id: discordClientId(),
    scope: 'bot applications.commands',
    permissions: BOT_INVITE_PERMISSIONS,
  });
  if (guildId) {
    params.set('guild_id', guildId);
    params.set('disable_guild_select', 'true');
  }
  return `https://discord.com/oauth2/authorize?${params}`;
}

export async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${Buffer.from(`${discordClientId()}:${discordClientSecret()}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: oauthRedirectUri() }),
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

async function botApi<T>(route: string): Promise<T> {
  const res = await fetch(`${API}${route}`, { headers: { authorization: `Bot ${discordBotToken()}` } });
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
