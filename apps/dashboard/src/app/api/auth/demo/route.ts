import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dashboardUrl, isDemoMode } from '@/lib/env';
import { SESSION_COOKIE, cookieOptions, createSession } from '@/lib/session';
import { DEMO_GUILD_ID, DEMO_USER_ID } from '@/lib/demo';

export const dynamic = 'force-dynamic';

/** Nur im Demo-Modus (DASHBOARD_DEMO=true): Login ohne Discord, für automatische Screenshots. */
export async function GET() {
  if (!isDemoMode()) return new NextResponse('Not found', { status: 404 });

  await db().guild.upsert({
    where: { id: DEMO_GUILD_ID },
    create: { id: DEMO_GUILD_ID, name: 'Moin Demo-Server', ownerId: DEMO_USER_ID, botPresent: true },
    update: { botPresent: true },
  });
  const session = await createSession({
    userId: DEMO_USER_ID,
    username: 'Demo-Owner',
    avatar: null,
    guilds: [
      { id: DEMO_GUILD_ID, name: 'Moin Demo-Server', icon: null, owner: true, permissions: '8' },
      { id: '100000000000000003', name: 'Zweiter Server (ohne Bot)', icon: null, owner: false, permissions: '32' },
    ],
    demo: true,
  });
  const res = NextResponse.redirect(new URL('/servers', dashboardUrl()));
  res.cookies.set(SESSION_COOKIE, session.id, cookieOptions(session.maxAge));
  return res;
}
