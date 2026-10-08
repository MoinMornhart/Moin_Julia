import { notFound } from 'next/navigation';
import { parseLevelConfig } from '@moin/shared';
import { Leaderboard } from '@/components/Leaderboard';
import { Logo } from '@/components/Logo';
import { db } from '@/lib/db';
import { guildIconUrl } from '@/lib/discord';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rangliste' };

/**
 * Öffentliche Rangliste (ohne Anmeldung) – nur, wenn das Level-Modul an ist und der Server sie
 * ausdrücklich freigegeben hat. Gezeigt werden nur Name, Bild, Level und XP der Top 100.
 */
export default async function PublicLeaderboardPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  if (!/^\d{15,22}$/.test(guildId)) notFound();
  const [guild, mod] = await Promise.all([
    db().guild.findUnique({ where: { id: guildId }, select: { id: true, name: true, icon: true, botPresent: true } }),
    db().guildModule.findUnique({ where: { guildId_moduleId: { guildId, moduleId: 'level' } } }),
  ]);
  if (!guild?.botPresent || !mod?.enabled || !parseLevelConfig(mod.config).publicLeaderboard) notFound();
  const rows = await db().memberXp.findMany({
    where: { guildId, xp: { gt: 0 } },
    orderBy: [{ xp: 'desc' }, { userId: 'asc' }],
    take: 100,
    select: { userId: true, userTag: true, avatar: true, xp: true, messages: true, voiceMinutes: true },
  });
  const icon = guildIconUrl({ id: guild.id, icon: guild.icon });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Logo />
      </header>
      <section className="enter mt-10 mb-8 flex flex-wrap items-center gap-5">
        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element -- Discord-CDN
          <img src={icon} alt="" width={72} height={72} className="size-18 rounded-2xl" />
        ) : (
          <span className="grid size-18 place-items-center rounded-2xl bg-ink-800 font-display text-2xl font-bold">{guild.name.slice(0, 2).toUpperCase()}</span>
        )}
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Rangliste</p>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">🏆 {guild.name}</h1>
        </div>
      </section>
      {rows.length ? <Leaderboard rows={rows} /> : <div className="card p-8 text-fog-300">Noch hat niemand XP gesammelt.</div>}
    </main>
  );
}
