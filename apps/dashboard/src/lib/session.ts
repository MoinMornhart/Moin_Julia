import 'server-only';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';
import { dashboardUrl } from './config';
import { isDemoMode } from './env';
import type { PartialGuild } from './discord';

export const SESSION_COOKIE = 'mj_session';
export const STATE_COOKIE = 'mj_oauth_state';
/** Wohin nach dem Login (z. B. zurück zur Bewerbungsseite) – nur interne Pfade */
export const NEXT_COOKIE = 'mj_next';

export function safeNextPath(raw: string | null | undefined): string | null {
  return raw && /^\/[a-zA-Z0-9/_?=&.-]*$/.test(raw) && !raw.startsWith('//') ? raw : null;
}
const SESSION_DAYS = 7;

export interface DashboardSession {
  id: string;
  userId: string;
  username: string;
  avatar: string | null;
  guilds: PartialGuild[];
  demo: boolean;
}

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: (await dashboardUrl()).startsWith('https://'),
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export async function createSession(data: Omit<DashboardSession, 'id'>): Promise<{ id: string; maxAge: number }> {
  const id = newToken();
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  await db().session.create({
    data: {
      id,
      userId: data.userId,
      username: data.username,
      avatar: data.avatar,
      guilds: data.guilds as unknown as object,
      demo: data.demo,
      expiresAt: new Date(Date.now() + maxAge * 1000),
    },
  });
  // Abgelaufene Sitzungen nebenbei aufräumen
  await db().session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return { id, maxAge };
}

export async function getSession(): Promise<DashboardSession | null> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const row = await db().session.findUnique({ where: { id } });
  if (!row || row.expiresAt < new Date()) return null;
  // Demo-Logins gelten nur, solange der Demo-Modus an ist
  if (row.demo && !isDemoMode()) {
    await db().session.delete({ where: { id } }).catch(() => undefined);
    return null;
  }
  return {
    id: row.id,
    userId: row.userId,
    username: row.username,
    avatar: row.avatar,
    guilds: row.guilds as unknown as PartialGuild[],
    demo: row.demo,
  };
}

/** Für Seiten, die einen Login voraussetzen. */
export async function requireSession(): Promise<DashboardSession> {
  const session = await getSession();
  if (!session) redirect('/');
  return session;
}

export async function deleteSession(id: string): Promise<void> {
  await db().session.deleteMany({ where: { id } });
}
