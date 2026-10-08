import { parseTeamConfig } from '@moin/shared';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { TeamSettingsForm } from '@/components/TeamSettingsForm';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { fetchGuildChannels, fetchGuildRoles, type ChannelOption, type DiscordRole } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';
import { teamTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Teams – Einstellungen' };

export default async function TeamSettingsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'team');
  const [pending, probation] = await Promise.all([db().application.count({ where: { guildId, status: 'pending' } }), db().probation.count({ where: { guildId, status: 'running' } })]);
  let channels: ChannelOption[] = [];
  let roles: DiscordRole[] = [];
  let loadError = false;
  try {
    [channels, roles] = await Promise.all([fetchGuildChannels(guildId), fetchGuildRoles(guildId)]);
  } catch {
    loadError = true;
  }
  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="settings" tabs={teamTabs(guildId, { pending, probation })} />
      {!row.enabled && (
        <p className="mb-6 rounded-xl border border-sun-400/40 bg-sun-400/10 px-4 py-3 text-sm">
          Das Modul ist aus – die Bewerbungsseite zeigt dann „geschlossen“. Schalte es oben ein, sobald alles vorbereitet ist.
        </p>
      )}
      {loadError && <p className="mb-6 rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm">Kanäle oder Rollen konnten nicht geladen werden.</p>}
      <TeamSettingsForm guildId={guildId} canEdit={canEdit} config={parseTeamConfig(row.config)} channels={channels} roles={roles.map(({ id, name, color }) => ({ id, name, color }))} />
    </>
  );
}
