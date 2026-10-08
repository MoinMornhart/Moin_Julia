import Link from 'next/link';
import { rolePanelSchema, type RolePanelData } from '@moin/shared';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { RolePanelEditor } from '@/components/RolePanelEditor';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { fetchGuildChannels, fetchGuildRoles, type ChannelOption, type DiscordRole } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rollen-Panels' };

const NEW_PANEL: RolePanelData = rolePanelSchema.parse({ name: 'Neues Panel', roles: [{ roleId: '100000000000000000', label: 'Rolle' }] });

export default async function PanelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ panel?: string }>;
}) {
  const { guildId } = await params;
  const { panel: selected } = await searchParams;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'willkommen');
  const panels = await db().rolePanel.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' } });

  let channels: ChannelOption[] = [];
  let roles: DiscordRole[] = [];
  try {
    [channels, roles] = await Promise.all([fetchGuildChannels(guildId), fetchGuildRoles(guildId)]);
  } catch {
    // leere Listen
  }

  const current = selected === 'neu' ? null : panels.find((p) => p.id === selected);
  const editing = selected === 'neu' || current;
  const data = current ? rolePanelSchema.safeParse(current.data) : null;

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs
        active="panels"
        tabs={[
          { key: 'welcome', label: 'Begrüßung', href: `/g/${guildId}/willkommen` },
          { key: 'panels', label: `Rollen-Panels (${panels.length})`, href: `/g/${guildId}/willkommen/panels` },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="grid content-start gap-2">
          {panels.map((p) => (
            <Link
              key={p.id}
              href={`/g/${guildId}/willkommen/panels?panel=${p.id}`}
              className={`rounded-xl border px-4 py-3 text-sm transition ${
                p.id === selected ? 'border-coral-500 bg-coral-500/10' : 'border-ink-700 bg-ink-900 hover:border-ink-600'
              }`}
            >
              <p className="font-semibold">{p.name}</p>
              <p className="text-xs text-fog-500">{p.messageId ? 'in Discord gesendet' : 'noch nicht gesendet'}</p>
            </Link>
          ))}
          {canEdit && (
            <Link href={`/g/${guildId}/willkommen/panels?panel=neu`} className="btn-ghost">
              + Neues Panel
            </Link>
          )}
        </aside>

        <section>
          {editing ? (
            <RolePanelEditor
              key={selected}
              guildId={guildId}
              panelId={current?.id ?? null}
              sent={Boolean(current?.messageId)}
              canEdit={canEdit}
              initial={data?.success ? { ...data.data, channelId: current?.channelId ?? null } : { ...NEW_PANEL, roles: roles[0] ? [{ roleId: roles[0].id, label: roles[0].name, emoji: '', description: '' }] : [] }}
              channels={channels}
              roles={roles.map(({ id, name, color }) => ({ id, name, color }))}
            />
          ) : (
            <div className="card p-8 text-fog-300">
              <p className="font-display text-xl font-semibold text-fog-100">Rollen zum Selbstvergeben</p>
              <p className="mt-2 text-sm">
                Ein Panel ist eine Nachricht mit Buttons oder einem Auswahlmenü. Mitglieder holen sich damit Rollen wie „Minecraft“, „Stream-Ping“ oder
                Pronomen selbst ab. {panels.length ? 'Wähle links ein Panel aus.' : 'Leg links dein erstes Panel an.'}
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
