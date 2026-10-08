import { NextResponse } from 'next/server';
import { authorizeUrl } from '@/lib/discord';
import { STATE_COOKIE, cookieOptions, newToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const state = newToken();
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set(STATE_COOKIE, state, cookieOptions(600));
  return res;
}
