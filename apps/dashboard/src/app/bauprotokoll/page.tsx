import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { listDocs, renderDoc } from '@/lib/docs';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bauprotokoll' };

export default async function BauprotokollPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams;
  const slug = d ?? null;
  const [docs, html, session] = await Promise.all([listDocs(), renderDoc(slug), getSession()]);
  if (html === null) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between">
        <Link href={session ? '/servers' : '/'}>
          <Logo />
        </Link>
        <Link href={session ? '/servers' : '/'} className="text-sm font-semibold text-fog-500 hover:text-coral-400">
          ← Zurück
        </Link>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <nav aria-label="Bauprotokoll" className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-3 text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Bauprotokoll</p>
          <ol className="relative grid gap-1 border-l border-ink-700 pl-4">
            <DocLink href="/bauprotokoll" active={slug === null} label="Zeitstrahl" />
            {docs.map((doc) => (
              <DocLink key={doc.slug} href={`/bauprotokoll?d=${doc.slug}`} active={slug === doc.slug} label={doc.title} />
            ))}
          </ol>
        </nav>

        <article className="card prose-doc min-w-0 p-6 sm:p-10" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

function DocLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <li className="relative">
      <span
        className={`absolute top-1/2 -left-[1.3rem] size-2.5 -translate-y-1/2 rounded-full border-2 ${
          active ? 'border-coral-500 bg-coral-500' : 'border-ink-600 bg-ink-950'
        }`}
      />
      <Link
        href={href}
        className={`block rounded-lg px-2 py-1.5 text-sm transition ${
          active ? 'font-semibold text-coral-400' : 'text-fog-300 hover:text-fog-100'
        }`}
      >
        {label}
      </Link>
    </li>
  );
}
