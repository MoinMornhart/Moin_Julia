import { ConnectionCard } from '@/components/ConnectionCard';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { appSettings, dashboardUrl } from '@/lib/config';
import { db } from '@/lib/db';
import { getModuleRow } from '@/lib/modules';
import { alertsTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Social Media – Verbindungen' };

const masked = (value: string | null) => (value ? `••••${value.slice(-4)}` : null);

export default async function ConnectionsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { session, canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'alerts');
  const [settings, feeds, base] = await Promise.all([appSettings(), db().socialFeed.count({ where: { guildId } }), dashboardUrl()]);
  const isAdmin = !!settings.instanceOwnerId && settings.instanceOwnerId === session.userId;

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="connections" tabs={alertsTabs(guildId, feeds)} />
      <div className="grid max-w-4xl gap-6">
        <div className="card flex items-center gap-4 p-5 text-sm">
          <span className="text-2xl" aria-hidden>
            ▶️
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">YouTube</p>
            <p className="text-fog-300">Braucht keine Verbindung – Videos, Shorts und Livestreams kommen über den öffentlichen Feed.</p>
          </div>
          <span className="chip bg-sea-400/15 text-sea-400">bereit</span>
        </div>
        <ConnectionCard
          guildId={guildId}
          platform="twitch"
          isAdmin={isAdmin}
          clientId={settings.twitchClientId}
          secret={masked(settings.twitchClientSecret)}
          steps={[
            <>
              Öffne die{' '}
              <a href="https://dev.twitch.tv/console/apps/create" target="_blank" rel="noopener" className="text-coral-400 underline">
                Twitch-Entwicklerkonsole
              </a>{' '}
              und melde dich mit deinem Twitch-Account an (2-Faktor-Anmeldung muss an sein).
            </>,
            <>
              <b>Name:</b> z. B. „Moin Julia Alerts“ · <b>OAuth-Redirect-URL:</b> <code>{base}</code> · <b>Kategorie:</b> „Chat Bot“ · <b>Client-Typ:</b> „Vertraulich“ → <b>Erstellen</b>.
            </>,
            <>
              Bei der neuen Anwendung auf <b>Verwalten</b>: <b>Client-ID</b> kopieren, dann <b>Neues Geheimnis</b> → das Secret kopieren.
            </>,
            <>Beides unten eintragen und auf „Prüfen und speichern“ klicken.</>,
          ]}
        />
        <ConnectionCard
          guildId={guildId}
          platform="kick"
          isAdmin={isAdmin}
          clientId={settings.kickClientId}
          secret={masked(settings.kickClientSecret)}
          steps={[
            <>
              Öffne bei Kick{' '}
              <a href="https://kick.com/settings/developer" target="_blank" rel="noopener" className="text-coral-400 underline">
                Einstellungen → Developer
              </a>{' '}
              (2-Faktor-Anmeldung muss an sein) und klicke auf <b>Create App</b>.
            </>,
            <>
              <b>Name:</b> z. B. „Moin Julia Alerts“ · <b>Redirect URL:</b> <code>{base}</code> · Häkchen sind nicht nötig → <b>Create</b>.
            </>,
            <>
              <b>Client ID</b> und <b>Client Secret</b> kopieren.
            </>,
            <>Beides unten eintragen und auf „Prüfen und speichern“ klicken.</>,
          ]}
        />
        <p className="text-xs text-fog-500">
          Die Zugangsdaten gelten für alle Server dieser Moin_Julia-Instanz und liegen verschlüsselt in deiner Datenbank. Sie erlauben nur das Lesen öffentlicher Infos (wer ist live) – kein Zugriff auf
          deinen Account.
        </p>
      </div>
    </>
  );
}
