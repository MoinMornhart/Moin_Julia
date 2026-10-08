import { parseSchutzConfig, raidKey } from '@moin/shared';
import { ModuleHeader } from '@/components/ModuleHeader';
import { SchutzForm } from '@/components/SchutzForm';
import { requireGuildAccess } from '@/lib/access';
import { fetchGuildChannels, fetchGuildRoles, type ChannelOption, type DiscordRole } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';
import { getRaw } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Server-Schutz' };

export default async function SchutzPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'schutz');
  const raidUntil = await getRaw(raidKey(guildId));

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
      {!row.enabled && (
        <p className="mb-6 rounded-xl border border-sun-400/40 bg-sun-400/10 px-4 py-3 text-sm">
          Das Modul ist aus – du kannst alles vorbereiten, aktiv wird es, sobald du es oben einschaltest.
        </p>
      )}
      {loadError && (
        <p className="mb-6 rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm">
          Kanäle oder Rollen konnten nicht geladen werden. Ist der Bot auf dem Server?
        </p>
      )}
      <SchutzForm
        guildId={guildId}
        canEdit={canEdit}
        config={parseSchutzConfig(row.config)}
        channels={channels}
        roles={roles.map(({ id, name, color }) => ({ id, name, color }))}
        raidUntil={raidUntil}
      />
    </>
  );
}
