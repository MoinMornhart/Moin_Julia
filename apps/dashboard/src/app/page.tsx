import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MODULES } from '@moin/shared';
import { BotStatus } from '@/components/BotStatus';
import { Logo } from '@/components/Logo';
import { setupComplete } from '@/lib/config';
import { isDemoMode } from '@/lib/env';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  abgebrochen: 'Login abgebrochen – kein Problem, versuch es einfach nochmal.',
  state: 'Der Login ist abgelaufen oder ungültig. Bitte nochmal starten.',
  login: 'Discord-Login fehlgeschlagen. Stimmen Client-ID, Secret und Redirect-URL?',
};

export default async function Home({ searchParams }: { searchParams: Promise<{ fehler?: string }> }) {
  if (!isDemoMode() && !(await setupComplete())) redirect('/setup');
  if (await getSession()) redirect('/servers');
  const { fehler } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between">
        <Logo />
        <BotStatus compact />
      </header>

      <section className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="chip mb-5 bg-coral-500/15 text-coral-400">Selbst gehostet · Open Source</p>
          <h1 className="font-display text-5xl leading-[1.02] font-extrabold tracking-tight sm:text-6xl">
            Dein Server.
            <br />
            Dein Bot.
            <br />
            <span className="text-coral-500">Moin, Julia.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-fog-300">
            Moderation, Tickets, Live-Alerts für Twitch, YouTube &amp; Kick – und Julia, eine KI, die deinen Server kennt.
            Alles an einem Ort, ohne Abo.
          </p>
          {fehler && ERRORS[fehler] && (
            <p className="mt-6 rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm text-fog-100">
              {ERRORS[fehler]}
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/api/auth/login" className="btn-primary px-6 py-3 text-base">
              <DiscordIcon /> Mit Discord anmelden
            </a>
            {isDemoMode() && (
              <a href="/api/auth/demo" className="btn-ghost px-6 py-3 text-base">
                Demo-Login
              </a>
            )}
            <Link href="/bauprotokoll" className="btn-ghost px-6 py-3 text-base">
              Bauprotokoll
            </Link>
          </div>
        </div>

        <div className="card relative overflow-hidden p-6">
          <p className="mb-4 text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Module an Bord</p>
          <ul className="grid grid-cols-2 gap-2.5">
            {MODULES.map((m) => (
              <li key={m.id} className="flex items-center gap-2.5 rounded-xl bg-ink-850 px-3 py-2.5 text-sm">
                <span className="text-lg" aria-hidden>
                  {m.icon}
                </span>
                <span className="truncate font-semibold">{m.name.de}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="text-xs text-fog-500">Moin_Julia · Verfasst mit Claude 🤖</footer>
    </main>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.4C.6 9 0 13.6.3 18.1a19.9 19.9 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.8 19.8 0 0 0 6-3c.4-5.2-.7-9.7-3.8-13.7ZM8.5 15.4c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm7 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z" />
    </svg>
  );
}
