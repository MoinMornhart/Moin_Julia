import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dashboardUrl } from '@/lib/config';
import { isDemoMode } from '@/lib/env';
import { SESSION_COOKIE, cookieOptions, createSession } from '@/lib/session';
import { DEMO_CASES, DEMO_GUILD_ID, DEMO_USER_ID } from '@/lib/demo';

export const dynamic = 'force-dynamic';

/** Nur im Demo-Modus (DASHBOARD_DEMO=true): Login ohne Discord, für automatische Screenshots. */
export async function GET() {
  if (!isDemoMode()) return new NextResponse('Not found', { status: 404 });

  await db().guild.upsert({
    where: { id: DEMO_GUILD_ID },
    create: { id: DEMO_GUILD_ID, name: 'Moin Demo-Server', ownerId: DEMO_USER_ID, botPresent: true },
    update: { botPresent: true },
  });
  if ((await db().modCase.count({ where: { guildId: DEMO_GUILD_ID } })) === 0) {
    await db().$transaction([
      ...DEMO_CASES.map((c, i) =>
        db().modCase.create({
          data: {
            guildId: DEMO_GUILD_ID,
            number: i + 1,
            type: c.type,
            userId: c.userId,
            userTag: c.userTag,
            moderatorId: c.source === 'command' ? DEMO_USER_ID : '100000000000000999',
            moderatorTag: c.source === 'command' ? 'Demo-Owner' : 'Moin_Julia',
            reason: c.reason,
            source: c.source,
            active: c.active,
            durationSec: 'durationSec' in c ? c.durationSec : null,
            createdAt: new Date(Date.now() - c.minutesAgo * 60_000),
          },
        }),
      ),
      db().guild.update({ where: { id: DEMO_GUILD_ID }, data: { caseCounter: DEMO_CASES.length } }),
    ]);
  }
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
  const res = NextResponse.redirect(new URL('/servers', await dashboardUrl()));
  res.cookies.set(SESSION_COOKIE, session.id, await cookieOptions(session.maxAge));
  return res;
}
