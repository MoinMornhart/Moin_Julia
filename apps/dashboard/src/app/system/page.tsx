import Link from 'next/link';
import { notFound } from 'next/navigation';
import { maskSecret } from '@moin/db';
import { BotStatus } from '@/components/BotStatus';
import { Logo } from '@/components/Logo';
import { SystemForm } from '@/components/SystemForm';
import { UserMenu } from '@/components/UserMenu';
import { appSettings } from '@/lib/config';
import { appVersion } from '@/lib/env';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'System' };

export default async function SystemPage() {
  const session = await requireSession();
  const s = await appSettings();
  if (!s.instanceOwnerId || session.userId !== s.instanceOwnerId) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Link href="/servers">
          <Logo />
        </Link>
        <UserMenu session={session} />
      </header>
      <div className="mt-10 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Instanz · v{appVersion()}</p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">System</h1>
          <p className="mt-2 text-fog-300">Zugangsdaten für Discord und die angebundenen Dienste. Nur du als Instanz-Admin siehst diese Seite.</p>
        </div>
        <BotStatus />
      </div>
      <SystemForm
        current={{
          discordClientId: s.discordClientId ?? '',
          dashboardUrl: s.dashboardUrl ?? '',
          twitchClientId: s.twitchClientId ?? '',
          discordToken: maskSecret(s.discordToken),
          discordClientSecret: maskSecret(s.discordClientSecret),
          anthropicApiKey: maskSecret(s.anthropicApiKey),
          twitchClientSecret: maskSecret(s.twitchClientSecret),
          youtubeApiKey: maskSecret(s.youtubeApiKey),
        }}
      />
    </main>
  );
}
