import { NextResponse, type NextRequest } from 'next/server';
import { exchangeCode, fetchCurrentUser, fetchCurrentUserGuilds } from '@/lib/discord';
import { dashboardUrl } from '@/lib/env';
import { SESSION_COOKIE, STATE_COOKIE, cookieOptions, createSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

function backToStart(error: string) {
  const res = NextResponse.redirect(new URL(`/?fehler=${error}`, dashboardUrl()));
  res.cookies.delete(STATE_COOKIE);
  return res;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const expected = request.cookies.get(STATE_COOKIE)?.value;

  if (request.nextUrl.searchParams.get('error')) return backToStart('abgebrochen');
  if (!code || !state || !expected || state !== expected) return backToStart('state');

  try {
    const accessToken = await exchangeCode(code);
    const [user, guilds] = await Promise.all([fetchCurrentUser(accessToken), fetchCurrentUserGuilds(accessToken)]);
    const session = await createSession({
      userId: user.id,
      username: user.global_name ?? user.username,
      avatar: user.avatar,
      guilds: guilds.map(({ id, name, icon, owner, permissions }) => ({ id, name, icon, owner, permissions })),
      demo: false,
    });
    const res = NextResponse.redirect(new URL('/servers', dashboardUrl()));
    res.cookies.delete(STATE_COOKIE);
    res.cookies.set(SESSION_COOKIE, session.id, cookieOptions(session.maxAge));
    return res;
  } catch (error) {
    console.error('[auth] Login fehlgeschlagen:', error);
    return backToStart('login');
  }
}
