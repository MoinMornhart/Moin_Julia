import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { saveSettings } from '@moin/db';
import { lastDays, levelFromXp } from '@moin/shared';
import { appSettings, dashboardUrl, invalidateSettings } from '@/lib/config';
import { isDemoMode } from '@/lib/env';
import { SESSION_COOKIE, cookieOptions, createSession } from '@/lib/session';
import { DEMO_CASES, DEMO_GUILD_ID, DEMO_TICKETS, DEMO_USER_ID, demoTranscript } from '@/lib/demo';

export const dynamic = 'force-dynamic';

/** Nur im Demo-Modus (DASHBOARD_DEMO=true): Login ohne Discord, für automatische Screenshots. */
export async function GET(request: Request) {
  if (!isDemoMode()) return new NextResponse('Not found', { status: 404 });
  // ?als=admin → Demo-Login als Admin (nicht Owner), z. B. um zu prüfen, dass der Owner-Bereich verborgen bleibt
  const asAdmin = new URL(request.url).searchParams.get('als') === 'admin';

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
  // Wiederholte Testläufe lehnen Bewerbungen ab – immer mindestens eine offene bereithalten
  const firstPosition = await db().jobPosition.findFirst({ where: { guildId: DEMO_GUILD_ID }, orderBy: { createdAt: 'asc' } });
  if (firstPosition && (await db().application.count({ where: { guildId: DEMO_GUILD_ID, status: 'pending', userId: { not: DEMO_USER_ID } } })) === 0) {
    await db().application.create({
      data: {
        guildId: DEMO_GUILD_ID,
        positionId: firstPosition.id,
        positionTitle: 'Moderator:in',
        userId: '100000000000000409',
        userTag: 'sophie.sun',
        answers: [{ fieldId: 'f2', label: 'Warum möchtest du ins Team?', value: 'Ich bin abends oft da und möchte helfen, dass es hier freundlich bleibt.' }],
      },
    });
  }
  if ((await db().suggestion.count({ where: { guildId: DEMO_GUILD_ID } })) === 0) {
    const now = new Date();
    const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000);
    await db().suggestion.createMany({
      data: [
        { guildId: DEMO_GUILD_ID, number: 1, userId: '100000000000000400', userTag: 'lukas.gamer', text: 'Ein wöchentlicher Spieleabend am Freitag mit Minecraft oder Among Us.', channelId: '100000000000000023', votes: { a: 1, b: 1, c: 1, d: -1 } },
        { guildId: DEMO_GUILD_ID, number: 2, userId: '100000000000000401', userTag: 'mia_zeichnet', text: 'Ein eigener Kanal für Kunst und Zeichnungen.', channelId: '100000000000000023', votes: { a: 1, b: 1 }, status: 'accepted', reason: 'Gute Idee – #kunst kommt diese Woche!' },
        { guildId: DEMO_GUILD_ID, number: 3, userId: '100000000000000402', userTag: 'ben.plays', text: 'Musik-Bot für den Sprachkanal.', channelId: '100000000000000023', votes: { a: 1, b: -1 }, status: 'considered' },
      ],
    });
    await db().guild.update({ where: { id: DEMO_GUILD_ID }, data: { suggestionCounter: 3 } });
    await db().giveaway.createMany({
      data: [
        { guildId: DEMO_GUILD_ID, channelId: '100000000000000022', prize: 'Discord Nitro (1 Monat)', winnerCount: 1, hostId: DEMO_USER_ID, entrants: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], endsAt: inDays(2) },
        { guildId: DEMO_GUILD_ID, channelId: '100000000000000022', prize: 'Steam-Gutschein 20 €', winnerCount: 2, hostId: DEMO_USER_ID, entrants: ['100000000000000400', '100000000000000401', '100000000000000402'], winnerIds: ['100000000000000401', '100000000000000402'], endsAt: inDays(-3), ended: true },
      ],
    });
    const today = new Date();
    const berlin = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric', month: 'numeric' }).formatToParts(today);
    const d = Number(berlin.find((p) => p.type === 'day')?.value);
    const m = Number(berlin.find((p) => p.type === 'month')?.value);
    await db().birthday.createMany({
      data: [
        { guildId: DEMO_GUILD_ID, userId: '100000000000000400', userTag: 'lukas.gamer', day: d, month: m, year: 2008 },
        { guildId: DEMO_GUILD_ID, userId: '100000000000000401', userTag: 'mia_zeichnet', day: 24, month: 12 },
        { guildId: DEMO_GUILD_ID, userId: '100000000000000402', userTag: 'ben.plays', day: 3, month: 3, year: 2005 },
        { guildId: DEMO_GUILD_ID, userId: DEMO_USER_ID, userTag: 'Demo-Owner', day: 14, month: 7 },
      ],
    });
    await db().countingState.create({ data: { guildId: DEMO_GUILD_ID, current: 137, lastUserId: '100000000000000400', record: 412 } });
  }
  // Demo: lukas.gamer hat immer „heute“ Geburtstag (sonst veraltet die Demo nach einem Tag)
  {
    const parts = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric', month: 'numeric' }).formatToParts(new Date());
    const day = Number(parts.find((p) => p.type === 'day')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    await db().birthday.updateMany({ where: { guildId: DEMO_GUILD_ID, userId: '100000000000000400' }, data: { day, month } });
  }
  if ((await db().juliaUsage.count({ where: { guildId: DEMO_GUILD_ID } })) === 0) {
    const months = [...Array(4)].map((_, i) => {
      const d = new Date();
      d.setUTCDate(15);
      d.setUTCMonth(d.getUTCMonth() - i);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    });
    await db().juliaUsage.createMany({
      data: months.map((month, i) => ({
        guildId: DEMO_GUILD_ID,
        month,
        requests: [212, 640, 455, 98][i] ?? 100,
        inputTokens: [380_000, 1_150_000, 820_000, 170_000][i] ?? 0,
        outputTokens: [41_000, 120_000, 88_000, 19_000][i] ?? 0,
        cacheRead: [210_000, 600_000, 400_000, 0][i] ?? 0,
        costMicroUsd: [606_000, 1_810_000, 1_280_000, 265_000][i] ?? 0,
      })),
    });
  }
  if ((await db().juliaProfile.count({ where: { guildId: DEMO_GUILD_ID } })) === 0) {
    const at = new Date().toISOString();
    await db().juliaProfile.createMany({
      data: [
        { guildId: DEMO_GUILD_ID, userId: '100000000000000400', userTag: 'lukas.gamer', nickname: 'Luki', address: 'du', facts: [{ text: 'Lukas spielt am liebsten Minecraft', at }, { text: 'Lukas hat einen Hund namens Bruno', at }] },
        { guildId: DEMO_GUILD_ID, userId: '100000000000000401', userTag: 'mia_zeichnet', address: 'sie', facts: [{ text: 'Mia zeichnet Comics', at }] },
        { guildId: DEMO_GUILD_ID, userId: '100000000000000402', userTag: 'ben.plays', underage: true },
      ],
    });
  }
  if ((await db().guildStatDay.count({ where: { guildId: DEMO_GUILD_ID } })) === 0) {
    const days = lastDays(90);
    let members = 1180;
    const guildRows = days.map((day, i) => {
      const weekend = [0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay());
      const joins = 2 + ((i * 7) % 5) + (weekend ? 3 : 0);
      const leaves = 1 + ((i * 3) % 3);
      members += joins - leaves;
      return { guildId: DEMO_GUILD_ID, day, joins, leaves, messages: 380 + ((i * 37) % 260) + (weekend ? 220 : 0), voiceMinutes: 600 + ((i * 53) % 700) + (weekend ? 900 : 0), memberCount: members };
    });
    await db().guildStatDay.createMany({ data: guildRows });
    const recent = days.slice(-30);
    const chans = ['100000000000000023', '100000000000000025', '100000000000000024', '100000000000000027'];
    await db().channelStatDay.createMany({ data: recent.flatMap((day, i) => chans.map((channelId, k) => ({ guildId: DEMO_GUILD_ID, channelId, day, messages: Math.round((220 + ((i * 17) % 90)) / (k + 1)) }))) });
    const people = ['lukas.gamer', 'mia_zeichnet', 'ben.plays', 'sophie.sun', 'kalle_kocht', 'nina.nerd', 'tom.tonic'];
    await db().memberStatDay.createMany({
      data: recent.flatMap((day, i) => people.map((userTag, k) => ({ guildId: DEMO_GUILD_ID, userId: `1000000000000004${String(k + 10).padStart(2, '0')}`, day, userTag, messages: Math.round((60 + ((i * 11) % 30)) / (k + 1)), voiceMinutes: Math.round((120 + ((i * 13) % 60)) / (k + 1)) }))),
    });
  }
  if ((await db().memberXp.count({ where: { guildId: DEMO_GUILD_ID } })) === 0) {
    const names = ['lukas.gamer', 'mia_zeichnet', 'ben.plays', 'Demo-Owner', 'sophie.sun', 'kalle_kocht', 'nina.nerd', 'tom.tonic', 'emma.exe', 'finn_fischt', 'lea.liest', 'paul.pixel'];
    await db().memberXp.createMany({
      data: names.map((userTag, i) => {
        const xp = Math.round(14_000 / (i + 1.2) + (i % 3) * 37);
        return {
          guildId: DEMO_GUILD_ID,
          userId: userTag === 'Demo-Owner' ? DEMO_USER_ID : `1000000000000004${String(i + 10).padStart(2, '0')}`,
          userTag,
          xp,
          level: levelFromXp(xp).level,
          messages: Math.round(xp / 21),
          voiceMinutes: Math.round(xp / 9),
        };
      }),
    });
  }
  // Demo-Owner ist Instanz-Admin, damit auch die System-Seite (Update-Knopf) testbar ist
  if (!(await appSettings()).instanceOwnerId) {
    await saveSettings(db(), { instanceOwnerId: DEMO_USER_ID });
    invalidateSettings();
  }
  const session = await createSession({
    userId: asAdmin ? '100000000000000004' : DEMO_USER_ID,
    username: asAdmin ? 'Demo-Admin' : 'Demo-Owner',
    avatar: null,
    guilds: [
      { id: DEMO_GUILD_ID, name: 'Moin Demo-Server', icon: null, owner: !asAdmin, permissions: '8' },
      { id: '100000000000000003', name: 'Zweiter Server (ohne Bot)', icon: null, owner: false, permissions: '32' },
    ],
    demo: true,
  });
  const res = NextResponse.redirect(new URL('/servers', await dashboardUrl()));
  res.cookies.set(SESSION_COOKIE, session.id, await cookieOptions(session.maxAge));
  return res;
}
