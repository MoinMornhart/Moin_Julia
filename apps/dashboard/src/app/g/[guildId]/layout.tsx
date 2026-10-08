import Link from 'next/link';
import { BotStatus } from '@/components/BotStatus';
import { Logo } from '@/components/Logo';
import { NavLink } from '@/components/NavLink';
import { UserMenu } from '@/components/UserMenu';
import { ACCESS_LABELS, requireGuildAccess } from '@/lib/access';

export default async function GuildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const { session, guild, level } = await requireGuildAccess(guildId);
  const base = `/g/${guildId}`;

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col lg:flex-row">
      <aside className="border-b border-ink-800 px-4 py-4 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0 lg:px-5 lg:py-6">
        <div className="flex items-center justify-between lg:block">
          <Link href="/servers" aria-label="Zur Server-Auswahl">
            <Logo />
          </Link>
          <div className="lg:hidden">
            <UserMenu session={session} />
          </div>
        </div>

        <Link
          href="/servers"
          className="mt-5 block rounded-xl border border-ink-700 bg-ink-900 px-3 py-2.5 transition hover:border-ink-600"
        >
          <p className="truncate text-sm font-semibold">{guild.name}</p>
          <p className="text-xs text-fog-500">{ACCESS_LABELS[level]} · Server wechseln</p>
        </Link>

        <nav className="-mx-1 mt-4 flex gap-1 overflow-x-auto pb-1 lg:mx-0 lg:flex-col lg:overflow-visible">
          <NavLink href={base} exact icon="🧭">
            Übersicht
          </NavLink>
          <NavLink href={`${base}/einstellungen`} icon="⚙️">
            Einstellungen
          </NavLink>
          <NavLink href="/bauprotokoll" icon="🛠️">
            Bauprotokoll
          </NavLink>
        </nav>

        <div className="mt-6 hidden lg:block">
          <BotStatus />
        </div>
      </aside>

      <div className="flex-1 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mb-6 hidden justify-end lg:flex">
          <UserMenu session={session} />
        </div>
        {children}
      </div>
    </div>
  );
}
