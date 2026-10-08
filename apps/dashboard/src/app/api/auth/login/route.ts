import { NextResponse, type NextRequest } from 'next/server';
import { dashboardUrl, setupComplete } from '@/lib/config';
import { authorizeUrl } from '@/lib/discord';
import { NEXT_COOKIE, STATE_COOKIE, cookieOptions, newToken, safeNextPath } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!(await setupComplete())) return NextResponse.redirect(new URL('/setup', await dashboardUrl()));
  const state = newToken();
  const res = NextResponse.redirect(await authorizeUrl(state));
  res.cookies.set(STATE_COOKIE, state, await cookieOptions(600));
  const next = safeNextPath(request.nextUrl.searchParams.get('next'));
  if (next) res.cookies.set(NEXT_COOKIE, next, await cookieOptions(600));
  return res;
}
