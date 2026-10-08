import Link from 'next/link';
import { notFound } from 'next/navigation';
import { maskSecret } from '@moin/db';
import { BotStatus } from '@/components/BotStatus';
import { ClaimAdminForm } from '@/components/ClaimAdminForm';
import { Logo } from '@/components/Logo';
import { SystemForm } from '@/components/SystemForm';
import { UpdatePanel } from '@/components/UpdatePanel';
import { BotProfileForm } from '@/components/BotProfileForm';
import { parsePresence } from '@moin/shared';
import { getBotProfile, type BotProfile } from '@/lib/botProfile';
import { UserMenu } from '@/components/UserMenu';
import { appSettings } from '@/lib/config';
import { appVersion } from '@/lib/env';
import { requireSession } from '@/lib/session';
import { checkLatest, updateState } from '@/lib/update';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'System' };

export default async function SystemPage() {
  const session = await requireSession();
  const s = await appSettings();
  if (s.instanceOwnerId && session.userId !== s.instanceOwnerId) notFound();
  const claim = !s.instanceOwnerId;
  const [update, latest] = claim ? [null, null] : await Promise.all([updateState(), checkLatest()]);
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
      {update && latest && <UpdatePanel initial={{ ...update, latest }} />}
    </main>
  );
}
