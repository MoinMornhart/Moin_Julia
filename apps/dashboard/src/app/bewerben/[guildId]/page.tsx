import Link from 'next/link';
import { notFound } from 'next/navigation';
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from '@moin/shared';
import { Logo } from '@/components/Logo';
import { applyGuild, openPositions } from '@/lib/applications';
import { db } from '@/lib/db';
import { guildIconUrl } from '@/lib/discord';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bewerben' };

const STATUS_CHIP: Record<ApplicationStatus, string> = {
  pending: 'bg-sun-400/15 text-sun-400',
  accepted: 'bg-sea-500/15 text-sea-400',
  rejected: 'bg-danger-500/15 text-danger-500',
};

/** Öffentliche Bewerbungsseite eines Servers: offene Stellen + Status der eigenen Bewerbungen */
export default async function ApplyPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const target = await applyGuild(guildId);
  if (!target) notFound();
  const { guild, enabled } = target;
  const session = await getSession();
  const positions = enabled ? await openPositions(guildId) : [];
  const mine = session
    ? await db().application.findMany({
        where: { guildId, userId: session.userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, positionTitle: true, status: true, createdAt: true },
        take: 20,
      })
    : [];
  const icon = guildIconUrl({ id: guild.id, icon: guild.icon });
  const login = `/api/auth/login?next=${encodeURIComponent(`/bewerben/${guildId}`)}`;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Logo />
        {session ? <span className="text-sm text-fog-300">Angemeldet als <b className="text-fog-100">{session.username}</b></span> : <a href={login} className="btn-ghost px-3 py-1.5 text-sm">Mit Discord anmelden</a>}
      </header>

      <section className="enter mt-10 flex flex-wrap items-center gap-5">
        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" className="size-20 rounded-3xl shadow-lg" />
        ) : (
          <span className="grid size-20 place-items-center rounded-3xl bg-ink-700 font-display text-2xl font-bold">{guild.name.slice(0, 2).toUpperCase()}</span>
        )}
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Bewerbungen</p>
          <h1 className="font-display text-4xl font-bold tracking-tight">{guild.name}</h1>
          <p className="mt-1 text-fog-300">Werde Teil des Teams – such dir eine Stelle aus.</p>
        </div>
      </section>

      {mine.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-xl font-semibold">Meine Bewerbungen</h2>
          <ul className="grid gap-2">
            {mine.map((a) => (
              <li key={a.id} className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="font-semibold">{a.positionTitle}</span>
                <span className="text-fog-500">{a.createdAt.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}</span>
                <span className={`chip ${STATUS_CHIP[a.status as ApplicationStatus] ?? 'bg-ink-800 text-fog-500'}`}>{APPLICATION_STATUS_LABELS[a.status as ApplicationStatus] ?? a.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 font-display text-xl font-semibold">Offene Stellen</h2>
        {!enabled ? (
          <div className="card p-8 text-fog-300">Bewerbungen sind auf diesem Server gerade geschlossen.</div>
        ) : positions.length === 0 ? (
          <div className="card p-8 text-fog-300">Gerade sind keine Stellen ausgeschrieben – schau später nochmal vorbei.</div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {positions.map((p, i) => (
              <li key={p.id} className="enter card lift flex flex-col p-5" style={{ '--i': i } as React.CSSProperties}>
                <p className="font-display text-xl font-semibold">
                  {p.data.emoji} {p.data.title}
                </p>
                {p.data.description && <p className="mt-2 flex-1 text-sm whitespace-pre-wrap text-fog-300">{p.data.description}</p>}
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-fog-500">
                  {p.data.questions.length > 0 && <span className="chip bg-ink-800">{p.data.questions.length} Fragen</span>}
                  {p.data.probationDays > 0 && <span className="chip bg-ink-800">{p.data.probationDays} Tage Probezeit</span>}
                  {p.data.minMemberDays > 0 && <span className="chip bg-ink-800">ab {p.data.minMemberDays} Tagen auf dem Server</span>}
                </div>
                <Link href={session ? `/bewerben/${guildId}/${p.id}` : `/api/auth/login?next=${encodeURIComponent(`/bewerben/${guildId}/${p.id}`)}`} className="btn-primary shine mt-4 w-fit">
                  {session ? 'Jetzt bewerben' : 'Anmelden & bewerben'}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
