import { parseModerationConfig } from '@moin/shared';
import { ModerationForm } from '@/components/ModerationForm';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { fetchGuildChannels, fetchGuildRoles, type ChannelOption, type DiscordRole } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Moderation' };

export default async function ModerationPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'moderation');
  const caseCount = await db().modCase.count({ where: { guildId } });

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
      <ModuleTabs
        active="settings"
        tabs={[
          { key: 'settings', label: 'Einstellungen', href: `/g/${guildId}/moderation` },
          { key: 'cases', label: `Fälle (${caseCount})`, href: `/g/${guildId}/moderation/faelle` },
        ]}
      />
      {!row.enabled && (
        <p className="mb-6 rounded-xl border border-sun-400/40 bg-sun-400/10 px-4 py-3 text-sm">
          Das Modul ist aus – die Befehle <code>/warn</code>, <code>/ban</code> usw. erscheinen erst, wenn du es oben einschaltest.
        </p>
      )}
      {loadError && (
        <p className="mb-6 rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm">
          Kanäle oder Rollen konnten nicht geladen werden. Ist der Bot auf dem Server und der Bot-Token korrekt?
        </p>
      )}
      <ModerationForm
        guildId={guildId}
        canEdit={canEdit}
        config={parseModerationConfig(row.config)}
        channels={channels}
        roles={roles.map(({ id, name, color }) => ({ id, name, color }))}
      />
    </>
  );
}
