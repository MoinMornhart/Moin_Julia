import { NextResponse, type NextRequest } from 'next/server';
import { exchangeCode, fetchCurrentUser, fetchCurrentUserGuilds, INVITE_STATE_PREFIX } from '@/lib/discord';
import { saveSettings } from '@moin/db';
import { appSettings, dashboardUrl, invalidateSettings, SETUP_COOKIE, verifySetupTicket } from '@/lib/config';
import { db } from '@/lib/db';
import { cacheDel } from '@/lib/redis';
import { NEXT_COOKIE, SESSION_COOKIE, STATE_COOKIE, cookieOptions, createSession, safeNextPath } from '@/lib/session';

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

  // Rückkehr nach „Bot einladen“: kein Login, nur zurück zur Server-Auswahl, die den neuen Server sofort erkennt
  if (state?.startsWith(INVITE_STATE_PREFIX)) {
    await cacheDel('moin:dash:bot-guilds');
    const guildId = request.nextUrl.searchParams.get('guild_id') ?? state.slice(INVITE_STATE_PREFIX.length);
    const ok = !request.nextUrl.searchParams.get('error') && /^\d{15,22}$/.test(guildId);
    return NextResponse.redirect(new URL(ok ? `/servers?eingeladen=${guildId}` : '/servers?einladung=abgebrochen', await dashboardUrl()));
  }

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
    const next = safeNextPath(request.cookies.get(NEXT_COOKIE)?.value);
    const res = NextResponse.redirect(new URL(claim ? '/servers?willkommen=1' : (next ?? '/servers'), await dashboardUrl()));
    res.cookies.delete(NEXT_COOKIE);
    if (claim) res.cookies.delete(SETUP_COOKIE);
    res.cookies.delete(STATE_COOKIE);
    res.cookies.set(SESSION_COOKIE, session.id, await cookieOptions(session.maxAge));
    return res;
  } catch (error) {
    console.error('[auth] Login fehlgeschlagen:', error);
    return await backToStart('login');
  }
}
