import { NextResponse, type NextRequest } from 'next/server';
import { dashboardUrl } from '@/lib/config';
import { SESSION_COOKIE, deleteSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const id = request.cookies.get(SESSION_COOKIE)?.value;
  if (id) await deleteSession(id);
  const res = NextResponse.redirect(new URL('/', await dashboardUrl()), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
