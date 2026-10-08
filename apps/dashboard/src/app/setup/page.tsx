import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { SetupWizard } from '@/components/SetupWizard';
import { appSettings, requestOrigin, setupCode, setupComplete, SETUP_COOKIE, verifySetupTicket } from '@/lib/config';
import { isDemoMode } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Einrichtung' };

export default async function SetupPage() {
  if (isDemoMode()) redirect('/');
  const complete = await setupComplete();
  const settings = await appSettings();
  if (complete && settings.instanceOwnerId) redirect('/');

  const ticket = verifySetupTicket((await cookies()).get(SETUP_COOKIE)?.value);
  const origin = await requestOrigin();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
      <header className="flex items-center justify-between">
        <Logo />
        <span className="chip bg-coral-500/15 text-coral-400">Ersteinrichtung</span>
      </header>
      <div className="mt-10 mb-8">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Moin! Lass uns deinen Bot einrichten.</h1>
        <p className="mt-3 max-w-2xl text-fog-300">
          Der Container läuft schon. Jetzt fehlen nur noch die Zugangsdaten deiner Discord-Anwendung – das dauert etwa 5 Minuten. Alles
          lässt sich später unter „System“ ändern.
        </p>
      </div>
      {!setupCode() && (
        <p className="mb-6 rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm">
          Es ist kein Einrichtungs-Code hinterlegt. Trage in der <code>.env</code> eine Zeile <code>SETUP_CODE=…</code> ein und starte neu
          (<code>moin-julia restart</code>) – der Installer macht das automatisch.
        </p>
      )}
      <SetupWizard
        initialStep={ticket ? (complete ? 'done' : 'discord') : 'code'}
        suggestedUrl={settings.dashboardUrl ?? origin}
        alreadySaved={complete}
      />
    </main>
  );
}
