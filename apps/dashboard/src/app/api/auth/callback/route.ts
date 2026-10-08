import { NextResponse, type NextRequest } from 'next/server';
import { exchangeCode, fetchCurrentUser, fetchCurrentUserGuilds } from '@/lib/discord';
import { saveSettings } from '@moin/db';
import { appSettings, dashboardUrl, invalidateSettings, SETUP_COOKIE, verifySetupTicket } from '@/lib/config';
import { db } from '@/lib/db';
import { SESSION_COOKIE, STATE_COOKIE, cookieOptions, createSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function backToStart(error: string) {
  const res = NextResponse.redirect(new URL(`/?fehler=${error}`, await dashboardUrl()));
  res.cookies.delete(STATE_COOKIE);
  return res;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const expected = request.cookies.get(STATE_COOKIE)?.value;

  if (request.nextUrl.searchParams.get('error')) return await backToStart('abgebrochen');
  if (!code || !state || !expected || state !== expected) return await backToStart('state');

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
    // Wer die Einrichtung abgeschlossen hat (Einrichtungs-Ticket im Browser), wird Instanz-Admin
    const claim = !(await appSettings()).instanceOwnerId && verifySetupTicket(request.cookies.get(SETUP_COOKIE)?.value);
    if (claim) {
      await saveSettings(db(), { instanceOwnerId: user.id });
      invalidateSettings();
    }
    const res = NextResponse.redirect(new URL(claim ? '/servers?willkommen=1' : '/servers', await dashboardUrl()));
    if (claim) res.cookies.delete(SETUP_COOKIE);
    res.cookies.delete(STATE_COOKIE);
    res.cookies.set(SESSION_COOKIE, session.id, await cookieOptions(session.maxAge));
    return res;
  } catch (error) {
    console.error('[auth] Login fehlgeschlagen:', error);
    return await backToStart('login');
  }
}
