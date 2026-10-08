import { parseStatsConfig } from '@moin/shared';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { StatChannelsEditor } from '@/components/StatChannelsEditor';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { fetchGuildChannels, fetchGuildRoles, type ChannelOption } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';
import { statsTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Statistik-Kanäle' };

export default async function StatChannelsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'statistiken');
  let channels: ChannelOption[] = [];
  let roleCount = 0;
  let loadError = false;
  try {
    const [c, r] = await Promise.all([fetchGuildChannels(guildId), fetchGuildRoles(guildId)]);
    channels = c;
    roleCount = r.length;
  } catch {
    loadError = true;
  }
  const last = await db().guildStatDay.findFirst({ where: { guildId, memberCount: { gt: 0 } }, orderBy: { day: 'desc' } });
  const members = last?.memberCount ?? 0;
  // Vorschau-Zahlen: aus den letzten Statistiken (der Bot rechnet später genau)
  const sample = { members, humans: members, bots: 0, boosts: 0, channels: channels.filter((c) => c.type !== 4).length, roles: roleCount, voice: 0 };

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="channels" tabs={statsTabs(guildId)} />
      {loadError && <p className="mb-6 rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm">Kanäle konnten nicht geladen werden.</p>}
      <StatChannelsEditor guildId={guildId} canEdit={canEdit} config={parseStatsConfig(row.config)} channels={channels} sample={sample} />
    </>
  );
}
