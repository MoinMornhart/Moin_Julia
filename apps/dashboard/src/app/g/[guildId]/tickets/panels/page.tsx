import Link from 'next/link';
import { ticketPanelSchema, type TicketPanelData } from '@moin/shared';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { TicketPanelEditor } from '@/components/TicketPanelEditor';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { fetchGuildChannels, fetchGuildRoles, type ChannelOption, type DiscordRole } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';
import { ticketsTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ticket-Panels' };

const NEW_PANEL: TicketPanelData = ticketPanelSchema.parse({
  name: 'Support',
  reasons: [
    { id: 'g1', label: 'Frage', emoji: '❓' },
    { id: 'g2', label: 'Problem melden', emoji: '🐞', questions: [{ label: 'Was ist passiert?', long: true }] },
  ],
});

export default async function TicketPanelsPage({ params, searchParams }: { params: Promise<{ guildId: string }>; searchParams: Promise<{ panel?: string }> }) {
  const { guildId } = await params;
  const { panel: selected } = await searchParams;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'tickets');
  const [panels, open] = await Promise.all([
    db().ticketPanel.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' } }),
    db().ticket.count({ where: { guildId, status: 'open' } }),
  ]);

  let channels: ChannelOption[] = [];
  let roles: DiscordRole[] = [];
  try {
    [channels, roles] = await Promise.all([fetchGuildChannels(guildId), fetchGuildRoles(guildId)]);
  } catch {
    // leere Listen
  }
  const current = selected === 'neu' ? null : panels.find((p) => p.id === selected);
  const editing = selected === 'neu' || current;
  const data = current ? ticketPanelSchema.safeParse(current.data) : null;

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="panels" tabs={ticketsTabs(guildId, { panels: panels.length, open })} />
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="grid content-start gap-2">
          {panels.map((p) => (
            <Link
              key={p.id}
              href={`/g/${guildId}/tickets/panels?panel=${p.id}`}
              className={`rounded-xl border px-4 py-3 text-sm transition ${p.id === selected ? 'border-coral-500 bg-coral-500/10' : 'border-ink-700 bg-ink-900 hover:border-ink-600'}`}
            >
              <p className="font-semibold">{p.name}</p>
              <p className="text-xs text-fog-500">{p.messageId ? 'in Discord gesendet' : 'noch nicht gesendet'}</p>
            </Link>
          ))}
          {canEdit && (
            <Link href={`/g/${guildId}/tickets/panels?panel=neu`} className="btn-ghost">
              + Neues Panel
            </Link>
          )}
          <p className="px-1 text-xs text-fog-500">
            Panels vom alten Bot übernehmen:{' '}
            <Link href={`/g/${guildId}/vorlagen/galaxybot`} className="text-coral-400 underline">
              Vorlagen → Von GalaxyBot
            </Link>
          </p>
        </aside>
        <section>
          {editing ? (
            <TicketPanelEditor
              key={selected}
              guildId={guildId}
              panelId={current?.id ?? null}
              sent={Boolean(current?.messageId)}
              canEdit={canEdit}
              initial={data?.success ? { ...data.data, channelId: current?.channelId ?? null } : { ...NEW_PANEL, channelId: null }}
              channels={channels}
              roles={roles.map(({ id, name }) => ({ id, name }))}
            />
          ) : (
            <div className="card p-8 text-fog-300">
              <p className="font-display text-xl font-semibold text-fog-100">Ticket-Panels</p>
              <p className="mt-2 text-sm">
                Ein Panel ist eine Nachricht mit Knöpfen oder einem Menü. Wer klickt, bekommt einen privaten Kanal mit dem Team – auf Wunsch mit Fragen vorab.{' '}
                {panels.length ? 'Wähle links ein Panel aus.' : 'Leg links dein erstes Panel an.'}
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
