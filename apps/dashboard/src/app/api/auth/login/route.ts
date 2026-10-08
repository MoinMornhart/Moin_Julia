import { NextResponse } from 'next/server';
import { dashboardUrl, setupComplete } from '@/lib/config';
import { authorizeUrl } from '@/lib/discord';
import { STATE_COOKIE, cookieOptions, newToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await setupComplete())) return NextResponse.redirect(new URL('/setup', await dashboardUrl()));
  const state = newToken();
  const res = NextResponse.redirect(await authorizeUrl(state));
  res.cookies.set(STATE_COOKIE, state, await cookieOptions(600));
  return res;
}
