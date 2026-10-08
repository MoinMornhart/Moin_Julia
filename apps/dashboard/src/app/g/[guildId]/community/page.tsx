import { parseCommunityConfig } from '@moin/shared';
import { CommunityForm } from '@/components/CommunityForm';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { communityCounts } from '@/lib/community';
import { db } from '@/lib/db';
import { fetchGuildChannels, fetchGuildRoles, type ChannelOption, type DiscordRole } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';
import { communityTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Community' };

export default async function CommunityPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'community');
  const [counts, counting] = await Promise.all([communityCounts(guildId), db().countingState.findUnique({ where: { guildId } })]);
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
      <ModuleTabs active="settings" tabs={communityTabs(guildId, counts)} />
      {loadError && <p className="mb-6 rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm">Kanäle oder Rollen konnten nicht geladen werden.</p>}
      <CommunityForm
        guildId={guildId}
        canEdit={canEdit}
        config={parseCommunityConfig(row.config)}
        channels={channels}
        roles={roles.map(({ id, name, color }) => ({ id, name, color }))}
        counting={{ current: counting?.current ?? 0, record: counting?.record ?? 0 }}
      />
    </>
  );
}
