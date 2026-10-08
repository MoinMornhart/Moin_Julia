import 'server-only';
import { appSettings, DISCORD_API as API } from './config';
import { isDemoMode } from './env';
import { DEMO_GUILD_ID } from './demo';

/**
 * Bot-Profil über die Discord-API (mit dem Bot-Token):
 * global = Name, Profilbild, Banner (PATCH /users/@me) und „Über mich“ (PATCH /applications/@me),
 * pro Server = Spitzname, Bild, Banner, Bio (PATCH /guilds/<id>/members/@me).
 * Status/Aktivität setzt der Bot selbst (Gateway) – siehe presence-Einstellung.
 */

export interface BotProfile {
  id: string;
  username: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  description: string;
}

export interface GuildBotProfile {
  nick: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
}

/** Bild als Data-URL für Discord: nur PNG, JPG, GIF, WebP, höchstens 10 MB */
const DATA_URL = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;
export function validImage(value: string | null | undefined): boolean {
  return value == null || value === '' || (DATA_URL.test(value) && value.length < 14_000_000);
}

async function token(): Promise<string> {
  const t = (await appSettings()).discordToken;
  if (!t) throw new Error('Kein Bot-Token eingetragen.');
  return t;
}

async function discord<T>(method: 'GET' | 'PATCH', route: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { authorization: `Bot ${await token()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string; errors?: unknown; retry_after?: number };
    if (res.status === 429) throw new Error(`Discord bremst: bitte in ${Math.ceil(data.retry_after ?? 60)} s nochmal (Namen lassen sich nur 2× pro Stunde ändern).`);
    throw new Error(`Discord lehnt ab (${res.status}): ${data.message ?? 'unbekannter Fehler'}${data.errors ? ` – ${JSON.stringify(data.errors).slice(0, 200)}` : ''}`);
  }
  return (await res.json()) as T;
}

const cdn = (kind: 'avatars' | 'banners', id: string, hash: string | null | undefined, size = 512) =>
  hash ? `https://cdn.discordapp.com/${kind}/${id}/${hash}.${hash.startsWith('a_') ? 'gif' : 'png'}?size=${size}` : null;

// ── Demo-Modus: nichts geht an Discord ───────────────────────────────────────
const demo: { profile: BotProfile; guild: GuildBotProfile } = {
  profile: { id: '100000000000000999', username: 'Moin_Julia', avatarUrl: '/branding/bot-avatar.png', bannerUrl: null, description: 'Ahoi! Ich bin Julia – Moderation, Willkommen, Tickets und mehr.' },
  guild: { nick: '', avatarUrl: null, bannerUrl: null },
};

export async function getBotProfile(): Promise<BotProfile> {
  if (isDemoMode()) return demo.profile;
  const [user, app] = await Promise.all([
    discord<{ id: string; username: string; avatar: string | null; banner?: string | null }>('GET', '/users/@me'),
    discord<{ description?: string }>('GET', '/applications/@me'),
  ]);
  return { id: user.id, username: user.username, avatarUrl: cdn('avatars', user.id, user.avatar), bannerUrl: cdn('banners', user.id, user.banner, 1024), description: app.description ?? '' };
}

export async function updateBotProfile(change: { username?: string; avatar?: string | null; banner?: string | null; description?: string }): Promise<string[]> {
  const done: string[] = [];
  if (isDemoMode()) {
    if (change.username) demo.profile.username = change.username;
    if (change.avatar !== undefined) demo.profile.avatarUrl = change.avatar;
    if (change.banner !== undefined) demo.profile.bannerUrl = change.banner;
    if (change.description !== undefined) demo.profile.description = change.description;
    return ['Demo-Modus: gespeichert, aber nicht an Discord gesendet.'];
  }
  const user: Record<string, string | null> = {};
  if (change.username) user.username = change.username;
  if (change.avatar !== undefined) user.avatar = change.avatar;
  if (change.banner !== undefined) user.banner = change.banner;
  if (Object.keys(user).length) {
    await discord('PATCH', '/users/@me', user);
    const parts = [change.username && 'Name', change.avatar !== undefined && 'Profilbild', change.banner !== undefined && 'Banner'].filter(Boolean);
    done.push(`${parts.join(', ')} gespeichert.`);
  }
  if (change.description !== undefined) {
    await discord('PATCH', '/applications/@me', { description: change.description });
    done.push('„Über mich“ gespeichert.');
  }
  return done;
}

export async function getGuildBotProfile(guildId: string): Promise<GuildBotProfile> {
  if (isDemoMode() || guildId === DEMO_GUILD_ID) return demo.guild;
  const botId = (await discord<{ id: string }>('GET', '/users/@me')).id;
  const member = await discord<{ nick?: string | null; avatar?: string | null; banner?: string | null }>('GET', `/guilds/${guildId}/members/${botId}`);
  return {
    nick: member.nick ?? '',
    avatarUrl: member.avatar ? `https://cdn.discordapp.com/guilds/${guildId}/users/${botId}/avatars/${member.avatar}.png?size=256` : null,
    bannerUrl: member.banner ? `https://cdn.discordapp.com/guilds/${guildId}/users/${botId}/banners/${member.banner}.png?size=1024` : null,
  };
}

export async function updateGuildBotProfile(
  guildId: string,
  change: { nick?: string; avatar?: string | null; banner?: string | null; bio?: string },
): Promise<string> {
  if (isDemoMode() || guildId === DEMO_GUILD_ID) {
    if (change.nick !== undefined) demo.guild.nick = change.nick;
    if (change.avatar !== undefined) demo.guild.avatarUrl = change.avatar;
    if (change.banner !== undefined) demo.guild.bannerUrl = change.banner;
    return 'Demo-Modus: gespeichert, aber nicht an Discord gesendet.';
  }
  const body: Record<string, string | null> = {};
  if (change.nick !== undefined) body.nick = change.nick || null;
  if (change.avatar !== undefined) body.avatar = change.avatar;
  if (change.banner !== undefined) body.banner = change.banner;
  if (change.bio !== undefined) body.bio = change.bio || null;
  if (!Object.keys(body).length) return 'Nichts geändert.';
  await discord('PATCH', `/guilds/${guildId}/members/@me`, body);
  return 'Server-Profil gespeichert.';
}
