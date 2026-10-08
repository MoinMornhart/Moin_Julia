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
  if ((await db().jobPosition.count({ where: { guildId: DEMO_GUILD_ID } })) === 0) {
    const position = await db().jobPosition.create({
      data: {
        guildId: DEMO_GUILD_ID,
        data: {
          title: 'Moderator:in',
          emoji: '🛡️',
          description: 'Du hilfst im Chat, behältst die Regeln im Blick und bist freundlich zu allen.',
          open: true,
          questions: [
            { id: 'f1', label: 'Wie alt bist du?', type: 'short', required: true, placeholder: '', minLength: 0, maxLength: 3, options: [] },
            { id: 'f2', label: 'Warum möchtest du ins Team?', type: 'long', required: true, placeholder: '', minLength: 10, maxLength: 1000, options: [] },
            { id: 'f3', label: 'Wie oft bist du online?', type: 'select', required: true, placeholder: '', minLength: 0, maxLength: 1000, options: [{ label: 'Täglich', emoji: '' }, { label: 'Am Wochenende', emoji: '' }] },
          ],
          acceptRoleIds: [],
          removeRoleIds: [],
          probationDays: 14,
          cooldownDays: 14,
          minAccountDays: 0,
          minMemberDays: 0,
        },
      },
    });
    const sample = [
      { tag: 'lukas.gamer', status: 'pending', age: '17', why: 'Ich bin fast jeden Abend da und helfe gerne neuen Leuten.', online: 'Täglich', minutesAgo: 120 },
      { tag: 'mia_zeichnet', status: 'pending', age: '21', why: 'Ich moderiere schon einen anderen Server und kenne mich mit Discord gut aus.', online: 'Am Wochenende', minutesAgo: 600 },
      { tag: 'ben.plays', status: 'accepted', age: '19', why: 'Ich bin seit Jahren in der Community und möchte etwas zurückgeben.', online: 'Täglich', minutesAgo: 4000 },
    ];
    for (const [i, s] of sample.entries()) {
      const app = await db().application.create({
        data: {
          guildId: DEMO_GUILD_ID,
          positionId: position.id,
          positionTitle: 'Moderator:in',
          userId: `10000000000000040${i}`,
          userTag: s.tag,
          answers: [
            { fieldId: 'f1', label: 'Wie alt bist du?', value: s.age },
            { fieldId: 'f2', label: 'Warum möchtest du ins Team?', value: s.why },
            { fieldId: 'f3', label: 'Wie oft bist du online?', value: s.online },
          ],
          status: s.status,
          tag: i === 1 ? 'suitable' : null,
          createdAt: new Date(Date.now() - s.minutesAgo * 60_000),
          decidedAt: s.status === 'accepted' ? new Date() : null,
        },
      });
      if (s.status === 'accepted') {
        await db().probation.create({
          data: { guildId: DEMO_GUILD_ID, userId: app.userId, userTag: s.tag, applicationId: app.id, positionTitle: 'Moderator:in', endAt: new Date(Date.now() + 2 * 86_400_000) },
        });
      }
    }
  }
  if ((await db().socialFeed.count({ where: { guildId: DEMO_GUILD_ID } })) === 0) {
    const base = { discordChannelId: '100000000000000022', pingRoleIds: ['100000000000000014'], embed: true, endMode: 'edit' };
    await db().socialFeed.createMany({
      data: [
        {
          guildId: DEMO_GUILD_ID,
          platform: 'twitch',
          channelKey: 'moinmornhart',
          data: { ...base, platform: 'twitch', input: 'twitch.tv/moinmornhart', channelKey: 'moinmornhart', displayName: 'MoinMornhart', liveRoleId: '100000000000000015', liveMemberId: DEMO_USER_ID },
          state: { initialized: true, seen: [], live: { streamId: '1', startedAt: new Date(Date.now() - 95 * 60_000).toISOString(), title: 'Gemütlicher Abend mit Minecraft', game: 'Minecraft', messageId: '', channelId: '100000000000000022' } },
          lastCheckedAt: new Date(Date.now() - 30_000),
        },
        {
          guildId: DEMO_GUILD_ID,
          platform: 'youtube',
          channelKey: 'UCdemoMoinJulia0000000',
          data: { ...base, platform: 'youtube', input: '@MoinJulia', channelKey: 'UCdemoMoinJulia0000000', displayName: 'Moin Julia' },
          state: { initialized: true, seen: [] },
          lastCheckedAt: new Date(Date.now() - 120_000),
        },
        {
          guildId: DEMO_GUILD_ID,
          platform: 'kick',
          channelKey: 'moinmornhart',
          data: { ...base, platform: 'kick', input: 'moinmornhart', channelKey: 'moinmornhart', displayName: 'moinmornhart', pingRoleIds: [] },
          lastError: 'Kick ist noch nicht verbunden – im Dashboard unter Social Media → Verbindungen einrichten.',
          lastCheckedAt: new Date(Date.now() - 60_000),
        },
      ],
    });
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
