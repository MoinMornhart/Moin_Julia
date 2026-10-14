import Link from 'next/link';
import { maskSecret } from '@moin/db';
import { BotStatus } from '@/components/BotStatus';
import { ClaimAdminForm } from '@/components/ClaimAdminForm';
import { Logo } from '@/components/Logo';
import { SystemForm } from '@/components/SystemForm';
import { UpdatePanel } from '@/components/UpdatePanel';
import { BotProfileForm } from '@/components/BotProfileForm';
import { parseMaintenance, parsePresence } from '@moin/shared';
import { MaintenanceCard } from '@/components/MaintenanceCard';
import { getBotProfile, type BotProfile } from '@/lib/botProfile';
import { UserMenu } from '@/components/UserMenu';
import { appSettings } from '@/lib/config';
import { db } from '@/lib/db';
import { appVersion } from '@/lib/env';
import { requireSession } from '@/lib/session';
import { getHealEvents } from '@/lib/redis';
import { checkLatest, updateState } from '@/lib/update';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'System' };

export default async function SystemPage() {
  const session = await requireSession();
  const s = await appSettings();
  // Kein Instanz-Admin: verständlich erklären statt einer nichtssagenden 404
  if (s.instanceOwnerId && session.userId !== s.instanceOwnerId) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-lg place-content-center gap-6 px-4 text-center">
        <Logo className="justify-center" />
        <h1 className="font-display text-3xl font-bold">Nur für den Instanz-Admin</h1>
        <p className="text-fog-300">
          Die System-Seite (Updates, Bot-Zugangsdaten, Selbstheilung) kann nur die Person öffnen, die Moin_Julia eingerichtet hat. Bitte sie, das Update zu starten – deine Server-Einstellungen findest du in der Server-Auswahl.
        </p>
        <Link href="/servers" className="btn-ghost mx-auto">
          Zur Server-Auswahl
        </Link>
      </main>
    );
  }
  const claim = !s.instanceOwnerId;
  const maint = parseMaintenance(s.maintenance);
  // Server mit Bot – zur Auswahl als Test-Server im Wartungsmodus
  const botGuilds = (await db().guild.findMany({ where: { botPresent: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } })).map((g) => ({ id: g.id, name: g.name }));
  const [update, latest] = claim ? [null, null] : await Promise.all([updateState(), checkLatest()]);
  const heals = claim ? [] : await getHealEvents();
  let profile: BotProfile | null = null;
  let profileError: string | undefined;
  if (!claim) {
    try {
      profile = await getBotProfile();
    } catch (error) {
      profileError = error instanceof Error ? error.message : 'Discord nicht erreichbar';
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Link href="/servers">
          <Logo />
        </Link>
        <UserMenu session={session} isAdmin />
      </header>
      <div className="mt-10 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Instanz · v{appVersion()}</p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">System</h1>
          <p className="mt-2 text-fog-300">Zugangsdaten für Discord und die angebundenen Dienste. Nur du als Instanz-Admin siehst diese Seite.</p>
        </div>
        <BotStatus />
      </div>
      {claim ? (
        <ClaimAdminForm />
      ) : (
      <SystemForm
        current={{
          discordClientId: s.discordClientId ?? '',
          dashboardUrl: s.dashboardUrl ?? '',
          discordToken: maskSecret(s.discordToken),
          discordClientSecret: maskSecret(s.discordClientSecret),
        }}
      />
      )}
      {!claim && (
        <BotProfileForm
          initial={profile ?? { username: '', avatarUrl: null, bannerUrl: null, description: '' }}
          presence={parsePresence(s.botPresence)}
          version={appVersion()}
          loadError={profileError}
        />
      )}
      {!claim && (
        <MaintenanceCard
          initial={{
            on: maint.on,
            message: maint.message,
            since: maint.since ? new Date(maint.since).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' }) : null,
            testGuildIds: maint.testGuildIds,
          }}
          guilds={botGuilds}
        />
      )}
      {update && latest && <UpdatePanel initial={{ ...update, latest }} />}
      {!claim && (
        <section className="card mt-8 grid gap-3 p-6 text-sm" aria-labelledby="heal-title">
          <div>
            <h2 id="heal-title" className="font-display text-lg font-semibold">
              🩹 Selbstheilung
            </h2>
            <p className="text-fog-300">
              Der Bot erkennt typische Hänger selbst und behebt sie: hängende Abfragen (Social Media, Statistik, Giveaways, Level), stillstehende Musik, verlorene
              Sprachverbindungen und nicht erreichbare Ollama-Server. Hier steht, was er zuletzt repariert hat.
            </p>
          </div>
          {heals.length ? (
            <ul className="grid gap-1.5" aria-label="Letzte Selbstheilungen">
              {heals.map((h, i) => (
                <li key={`${h.at}-${i}`} className="grid gap-0.5 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
                  <span className="text-xs text-fog-500 tabular-nums">{new Date(h.at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' })}</span>
                  <span className="break-words">
                    <b>{h.area}:</b> {h.problem} → <span className="text-sea-400">{h.action}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-ink-700 px-3 py-2 text-fog-300">Bisher musste nichts repariert werden. ✅</p>
          )}
        </section>
      )}
    </main>
  );
}
