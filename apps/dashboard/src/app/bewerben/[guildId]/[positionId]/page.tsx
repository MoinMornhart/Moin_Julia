import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { positionSchema } from '@moin/shared';
import { ApplicationForm } from '@/components/ApplicationForm';
import { Logo } from '@/components/Logo';
import { applyGuild, blockerFor } from '@/lib/applications';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bewerbung' };

export default async function ApplyFormPage({ params }: { params: Promise<{ guildId: string; positionId: string }> }) {
  const { guildId, positionId } = await params;
  const session = await getSession();
  if (!session) redirect(`/api/auth/login?next=${encodeURIComponent(`/bewerben/${guildId}/${positionId}`)}`);
  const target = await applyGuild(guildId);
  if (!target?.enabled) notFound();
  const row = await db().jobPosition.findFirst({ where: { id: positionId, guildId } });
  const parsed = row ? positionSchema.safeParse(row.data) : null;
  if (!parsed?.success) notFound();
  const position = parsed.data;
  const blocked = await blockerFor(session, guildId, positionId, position);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Logo />
        <Link href={`/bewerben/${guildId}`} className="text-sm text-coral-400 hover:text-coral-500">
          ← Alle Stellen
        </Link>
      </header>
      <section className="enter mt-10">
        <p className="text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Bewerbung · {target.guild.name}</p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">
          {position.emoji} {position.title}
        </h1>
        {position.description && <p className="mt-3 whitespace-pre-wrap text-fog-300">{position.description}</p>}
      </section>
      <section className="mt-8">
        {blocked ? (
          <div className="card border-sun-400/40 p-6 text-fog-300">{blocked}</div>
        ) : (
          <ApplicationForm guildId={guildId} positionId={positionId} questions={position.questions} />
        )}
      </section>
    </main>
  );
}
