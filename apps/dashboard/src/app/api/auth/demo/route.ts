import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { saveSettings } from '@moin/db';
import { appSettings, dashboardUrl, invalidateSettings } from '@/lib/config';
import { isDemoMode } from '@/lib/env';
import { SESSION_COOKIE, cookieOptions, createSession } from '@/lib/session';
import { DEMO_CASES, DEMO_GUILD_ID, DEMO_TICKETS, DEMO_USER_ID, demoTranscript } from '@/lib/demo';

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
  if ((await db().ticket.count({ where: { guildId: DEMO_GUILD_ID } })) === 0) {
    for (const t of DEMO_TICKETS) {
      const createdAt = new Date(Date.now() - t.minutesAgo * 60_000);
      await db().ticket.create({
        data: {
          guildId: DEMO_GUILD_ID,
          number: t.number,
          channelId: `1000000000000009${t.number}0`,
          openerId: '100000000000000301',
          openerTag: t.openerTag,
          reasonId: 'g1',
          reasonLabel: t.reasonLabel,
          status: t.status,
          rating: t.rating,
          closeReason: t.closeReason,
          createdAt,
          closedAt: t.status === 'closed' ? new Date(createdAt.getTime() + 3_600_000) : null,
          transcript: t.status === 'closed' ? demoTranscript(t.number, t.openerTag, t.reasonLabel) : null,
        },
      });
    }
    await db().guild.update({ where: { id: DEMO_GUILD_ID }, data: { ticketCounter: DEMO_TICKETS.length } });
  }
  // Demo-Owner ist Instanz-Admin, damit auch die System-Seite (Update-Knopf) testbar ist
  if (!(await appSettings()).instanceOwnerId) {
    await saveSettings(db(), { instanceOwnerId: DEMO_USER_ID });
    invalidateSettings();
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
