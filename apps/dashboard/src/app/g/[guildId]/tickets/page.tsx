import { parseTicketsConfig } from '@moin/shared';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { TicketsForm } from '@/components/TicketsForm';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { fetchGuildChannels, fetchGuildRoles, type ChannelOption, type DiscordRole } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';
import { ticketsTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tickets' };

export default async function TicketsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'tickets');
  const [panels, open] = await Promise.all([db().ticketPanel.count({ where: { guildId } }), db().ticket.count({ where: { guildId, status: 'open' } })]);

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
      <ModuleTabs active="settings" tabs={ticketsTabs(guildId, { panels, open })} />
      {!row.enabled && (
        <p className="mb-6 rounded-xl border border-sun-400/40 bg-sun-400/10 px-4 py-3 text-sm">
          Das Modul ist aus – du kannst alles vorbereiten, aktiv wird es, sobald du es oben einschaltest.
        </p>
      )}
      {loadError && (
        <p className="mb-6 rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm">Kanäle oder Rollen konnten nicht geladen werden. Ist der Bot auf dem Server?</p>
      )}
      <TicketsForm guildId={guildId} canEdit={canEdit} config={parseTicketsConfig(row.config)} channels={channels} roles={roles.map(({ id, name, color }) => ({ id, name, color }))} />
    </>
  );
}
