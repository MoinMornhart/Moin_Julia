import { parseWillkommenConfig } from '@moin/shared';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { WillkommenForm } from '@/components/WillkommenForm';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { fetchGuildChannels, fetchGuildRoles, type ChannelOption, type DiscordRole } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Willkommen & Rollen' };

export default async function WillkommenPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'willkommen');
  const panelCount = await db().rolePanel.count({ where: { guildId } });

  let channels: ChannelOption[] = [];
  let roles: DiscordRole[] = [];
  try {
    [channels, roles] = await Promise.all([fetchGuildChannels(guildId), fetchGuildRoles(guildId)]);
  } catch {
    // Hinweis erscheint im Formular über leere Listen
  }

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs
        active="welcome"
        tabs={[
          { key: 'welcome', label: 'Begrüßung', href: `/g/${guildId}/willkommen` },
          { key: 'panels', label: `Rollen-Panels (${panelCount})`, href: `/g/${guildId}/willkommen/panels` },
        ]}
      />
      {!row.enabled && (
        <p className="mb-6 rounded-xl border border-sun-400/40 bg-sun-400/10 px-4 py-3 text-sm">
          Das Modul ist aus – Begrüßung, Auto-Rollen und Rollen-Panels wirken erst, wenn du es oben einschaltest.
        </p>
      )}
      <WillkommenForm
        guildId={guildId}
        canEdit={canEdit}
        config={parseWillkommenConfig(row.config)}
        channels={channels}
        roles={roles.map(({ id, name, color }) => ({ id, name, color }))}
      />
    </>
  );
}
