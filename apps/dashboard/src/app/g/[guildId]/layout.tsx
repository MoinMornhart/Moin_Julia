import Link from 'next/link';
import { MODULES, type ModuleCategory } from '@moin/shared';
import { BotStatus } from '@/components/BotStatus';
import { Logo } from '@/components/Logo';
import { NavGroup, NavLink } from '@/components/NavLink';
import { SidebarShell } from '@/components/SidebarShell';
import { UserMenu } from '@/components/UserMenu';
import { ACCESS_LABELS, requireGuildAccess } from '@/lib/access';
import { appSettings } from '@/lib/config';
import { db } from '@/lib/db';
import { guildIconUrl } from '@/lib/discord';

/** Gruppen der Seitenleiste – wie bei großen Bots nach Bereichen sortiert */
const GROUPS: { title: string; categories: ModuleCategory[] }[] = [
  { title: 'Grundlagen', categories: ['basis'] },
  { title: 'Moderation & Schutz', categories: ['sicherheit'] },
  { title: 'Community', categories: ['community'] },
  { title: 'Creator', categories: ['creator'] },
  { title: 'Julia KI', categories: ['ki'] },
];

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
  const settings = await appSettings();
  const isAdmin = !settings.instanceOwnerId || settings.instanceOwnerId === session.userId;
  const stored = await db().guildModule.findMany({ where: { guildId }, select: { moduleId: true, enabled: true } });
  const enabled = (id: string) => stored.find((s) => s.moduleId === id)?.enabled ?? MODULES.find((m) => m.id === id)?.defaultEnabled ?? false;
  const icon = guildIconUrl({ id: guild.id, icon: guild.icon });

  return (
    <div className="mx-auto flex min-h-dvh max-w-[90rem] flex-col lg:flex-row">
      <SidebarShell
        top={
          <Link href="/servers" aria-label="Zur Server-Auswahl">
            <Logo />
          </Link>
        }
      >
        <Link href="/servers" aria-label="Zur Server-Auswahl" className="block w-fit pr-12 lg:pr-0">
          <Logo />
        </Link>

        <Link
          href="/servers"
          className="lift mt-5 flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900/80 p-2.5 hover:border-ink-600"
        >
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} alt="" className="size-10 rounded-xl" />
          ) : (
            <span className="grid size-10 place-items-center rounded-xl bg-ink-700 text-sm font-bold">{guild.name.slice(0, 2).toUpperCase()}</span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{guild.name}</span>
            <span className="block text-xs text-fog-500">{ACCESS_LABELS[level]} · wechseln ⇄</span>
          </span>
        </Link>

        <nav className="mt-3 grid gap-0.5" aria-label="Server-Navigation">
          <NavGroup>
            <NavLink href={base} exact icon="🧭">
              Übersicht
            </NavLink>
          </NavGroup>
          {GROUPS.map((group) => {
            const mods = MODULES.filter((m) => group.categories.includes(m.category) && (m.hasSettings || m.status === 'planned')).sort((a, b) => a.order - b.order);
            if (!mods.length) return null;
            return (
              <NavGroup key={group.title} title={group.title}>
                {mods.map((m) =>
                  m.status === 'planned' ? (
                    <NavLink key={m.id} href="#" icon={m.icon} soon>
                      {m.name.de}
                    </NavLink>
                  ) : (
                    <NavLink key={m.id} href={`${base}/${m.id}`} icon={m.icon} state={enabled(m.id) ? 'on' : 'off'}>
                      {m.name.de}
                    </NavLink>
                  ),
                )}
              </NavGroup>
            );
          })}
          <NavGroup title="Werkzeuge">
            <NavLink href={`${base}/vorlagen`} icon="📦">
              Vorlagen
            </NavLink>
            <NavLink href={`${base}/einstellungen`} icon="⚙️">
              Einstellungen
            </NavLink>
            <NavLink href="/bauprotokoll" icon="🛠️">
              Bauprotokoll
            </NavLink>
          </NavGroup>
        </nav>

        <div className="mt-auto grid gap-3 pt-6">
          <BotStatus compact />
          <div className="lg:hidden">
            <UserMenu session={session} isAdmin={isAdmin} />
          </div>
        </div>
      </SidebarShell>

      <div className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mb-6 hidden justify-end lg:flex">
          <UserMenu session={session} isAdmin={isAdmin} />
        </div>
        {children}
      </div>
    </div>
  );
}
