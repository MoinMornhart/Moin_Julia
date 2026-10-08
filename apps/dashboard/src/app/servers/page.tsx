import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BotHint, BotStatus } from '@/components/BotStatus';
import { Logo } from '@/components/Logo';
import { UserMenu } from '@/components/UserMenu';
import { ACCESS_LABELS, accessLevel, hasManagePermission, type AccessLevel } from '@/lib/access';
import { appSettings, oauthRedirectUri } from '@/lib/config';
import { db } from '@/lib/db';
import { guildIconUrl, inviteUrl } from '@/lib/discord';
import { syncBotGuilds } from '@/lib/presence';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Server wählen' };

export default async function ServersPage({ searchParams }: { searchParams: Promise<{ willkommen?: string; eingeladen?: string; einladung?: string }> }) {
  const session = await requireSession();
  const settings = await appSettings();
  const clientId = settings.discordClientId ?? '';
  const isAdmin = !settings.instanceOwnerId || settings.instanceOwnerId === session.userId;
  const { willkommen, eingeladen, einladung } = await searchParams;
  const redirectUri = await oauthRedirectUri();
  const ids = session.guilds.map((g) => g.id);
  await syncBotGuilds(session.guilds.filter((g) => g.owner || hasManagePermission(g.permissions)));
  const known = await db().guild.findMany({ where: { id: { in: ids }, botPresent: true } });

  const withBot: { id: string; name: string; icon: string | null; level: AccessLevel }[] = [];
  for (const guild of known) {
    const level = await accessLevel(session, guild);
    if (level) withBot.push({ id: guild.id, name: guild.name, icon: guild.icon, level });
  }
  // Direkt nach dem Einladen: ist der Server erkannt, gleich in sein Dashboard
  if (eingeladen && withBot.some((g) => g.id === eingeladen)) redirect(`/g/${eingeladen}`);
  const knownIds = new Set(known.map((g) => g.id));
  const invitable = session.guilds.filter((g) => !knownIds.has(g.id) && (g.owner || hasManagePermission(g.permissions)));

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Logo />
        <UserMenu session={session} isAdmin={isAdmin} />
      </header>

      <div className="mt-12 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">Moin, {session.username}! 👋</h1>
          <p className="mt-2 text-fog-300">Welchen Server willst du einrichten?</p>
        </div>
        <BotStatus />
      </div>

      {willkommen && (
        <div className="card mb-8 border-sea-500/50 p-5">
          <p className="font-display text-lg font-semibold">Einrichtung abgeschlossen 🎉</p>
          <p className="mt-1 text-sm text-fog-300">
            Du bist jetzt Instanz-Admin. Lade den Bot unten auf deinen Server ein. Zugangsdaten änderst du jederzeit unter{' '}
            <a href="/system" className="text-coral-400 underline">System</a>.
          </p>
        </div>
      )}

      {!settings.instanceOwnerId && (
        <div className="card mb-8 border-sun-400/50 p-5">
          <p className="font-display text-lg font-semibold">Noch kein Instanz-Admin</p>
          <p className="mt-1 text-sm text-fog-300">
            Klick oben rechts auf <b>System</b> und gib den Einrichtungs-Code ein (im Container: <code>moin-julia setup-code</code>). Danach kannst du dort Bot-Token, Adresse und Schlüssel ändern.
          </p>
        </div>
      )}

      <BotHint />

      {eingeladen && (
        <div className="card mb-8 border-sun-400/50 p-5 text-sm text-fog-300">
          Bot eingeladen ✅ – Discord braucht manchmal ein paar Sekunden. <a href={`/servers?eingeladen=${eingeladen}`} className="text-coral-400 underline">Nochmal prüfen</a>
        </div>
      )}
      {einladung === 'abgebrochen' && <div className="card mb-8 p-5 text-sm text-fog-300">Einladung abgebrochen – du kannst es unten jederzeit nochmal versuchen.</div>}

      {withBot.length === 0 ? (
        <div className="card p-8 text-center text-fog-300">
          Auf keinem deiner Server ist der Bot schon – lade ihn unten ein.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {withBot.map((g) => (
            <li key={g.id}>
              <Link
                href={`/g/${g.id}`}
                className="card group flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:border-coral-500/60"
              >
                <GuildIcon id={g.id} name={g.name} icon={g.icon} />
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-semibold">{g.name}</p>
                  <p className="text-xs text-fog-500">{ACCESS_LABELS[g.level]}</p>
                </div>
                <span className="ml-auto text-fog-500 transition group-hover:translate-x-1 group-hover:text-coral-400">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {invitable.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Bot einladen</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {invitable.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-2xl border border-dashed border-ink-600 p-4">
                <GuildIcon id={g.id} name={g.name} icon={g.icon} small />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-fog-300">{g.name}</p>
                <a href={inviteUrl(clientId, g.id, redirectUri)} className="btn-ghost px-3 py-1.5 text-xs">
                  Einladen
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-fog-500">Nach dem Einladen geht es automatisch zurück hierher und direkt ins Server-Dashboard.</p>
        </section>
      )}
    </main>
  );
}

function GuildIcon({ id, name, icon, small = false }: { id: string; name: string; icon: string | null; small?: boolean }) {
  const url = guildIconUrl({ id, icon });
  const size = small ? 'size-9 text-sm' : 'size-12 text-lg';
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`${size} shrink-0 rounded-2xl`} />;
  }
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={`${size} grid shrink-0 place-items-center rounded-2xl bg-ink-700 font-display font-bold text-fog-300`}>
      {initials}
    </span>
  );
}
