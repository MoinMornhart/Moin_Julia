import { parseLevelConfig } from '@moin/shared';
import { LevelRewardsEditor } from '@/components/LevelRewardsEditor';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { fetchGuildRoles, type DiscordRole } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';
import { levelTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Level & XP – Belohnungen' };

export default async function LevelRewardsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'level');
  const config = parseLevelConfig(row.config);
  let roles: DiscordRole[] = [];
  let loadError = false;
  try {
    roles = (await fetchGuildRoles(guildId)).filter((r) => !r.managed);
  } catch {
    loadError = true;
  }
  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="rewards" tabs={levelTabs(guildId)} />
      {loadError && <p className="mb-6 rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm">Rollen konnten nicht geladen werden.</p>}
      <p className="mb-4 max-w-2xl text-sm text-fog-300">Tipp: Die Rolle von Moin_Julia muss in den Server-Einstellungen über den Belohnungsrollen stehen, sonst darf der Bot sie nicht vergeben.</p>
      <LevelRewardsEditor
        guildId={guildId}
        canEdit={canEdit}
        initial={{ rewards: config.rewards, rewardsReplace: config.rewardsReplace, boosts: config.boosts }}
        roles={roles.map(({ id, name }) => ({ id, name }))}
      />
    </>
  );
}
