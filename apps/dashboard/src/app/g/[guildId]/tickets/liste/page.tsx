import Link from 'next/link';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { getModuleRow } from '@/lib/modules';
import { ticketsTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tickets' };

const when = (d: Date) => d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' });
const FILTERS = [
  { key: 'alle', label: 'Alle' },
  { key: 'offen', label: 'Offen' },
  { key: 'geschlossen', label: 'Geschlossen' },
];

export default async function TicketListPage({ params, searchParams }: { params: Promise<{ guildId: string }>; searchParams: Promise<{ status?: string; q?: string }> }) {
  const { guildId } = await params;
  const { status = 'alle', q = '' } = await searchParams;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'tickets');
  const query = q.trim();
  const where = {
    guildId,
    ...(status === 'offen' ? { status: 'open' } : status === 'geschlossen' ? { status: 'closed' } : {}),
    ...(query ? { OR: [{ openerTag: { contains: query, mode: 'insensitive' as const } }, { reasonLabel: { contains: query, mode: 'insensitive' as const } }] } : {}),
  };
  const [tickets, panels, open, rated] = await Promise.all([
    db().ticket.findMany({
      where,
      orderBy: { number: 'desc' },
      take: 100,
      select: { id: true, number: true, openerTag: true, reasonLabel: true, status: true, claimedBy: true, createdAt: true, rating: true, channelId: true },
    }),
    db().ticketPanel.count({ where: { guildId } }),
    db().ticket.count({ where: { guildId, status: 'open' } }),
    db().ticket.aggregate({ where: { guildId, rating: { not: null } }, _avg: { rating: true }, _count: { rating: true } }),
  ]);

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="list" tabs={ticketsTabs(guildId, { panels, open })} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/g/${guildId}/tickets/liste?status=${f.key}${query ? `&q=${encodeURIComponent(query)}` : ''}`}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${status === f.key ? 'border-coral-500 bg-coral-500 text-ink-950' : 'border-ink-700 bg-ink-900 text-fog-300'}`}
          >
            {f.label}
          </Link>
        ))}
        {rated._count.rating > 0 && (
          <span className="text-sm text-fog-500">
            Ø Bewertung <b className="text-sun-400">{rated._avg.rating?.toFixed(1)} ★</b> ({rated._count.rating})
          </span>
        )}
        <form className="w-full sm:ml-auto sm:w-64" action={`/g/${guildId}/tickets/liste`}>
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={query} placeholder="Person oder Grund suchen …" aria-label="Tickets durchsuchen" className="input" />
        </form>
      </div>
      {tickets.length === 0 ? (
        <div className="card p-8 text-fog-300">Noch keine Tickets{status !== 'alle' || query ? ' für diesen Filter' : ''}.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs tracking-wider text-fog-500 uppercase">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Von</th>
                <th className="px-4 py-3">Grund</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Geöffnet</th>
                <th className="px-4 py-3">Bewertung</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t border-ink-800">
                  <td className="px-4 py-3 font-mono">{t.number}</td>
                  <td className="px-4 py-3">{t.openerTag}</td>
                  <td className="px-4 py-3">{t.reasonLabel}</td>
                  <td className="px-4 py-3">
                    {t.status === 'open' ? (
                      <span className="chip bg-sea-500/15 text-sea-400">offen{t.claimedBy ? ' · übernommen' : ''}</span>
                    ) : (
                      <span className="chip bg-ink-800 text-fog-500">geschlossen</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-fog-300">{when(t.createdAt)}</td>
                  <td className="px-4 py-3 text-sun-400">{t.rating ? '★'.repeat(t.rating) : '–'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {t.status === 'closed' ? (
                      <Link href={`/g/${guildId}/tickets/${t.id}`} className="font-semibold text-coral-400 hover:text-coral-500">
                        Verlauf →
                      </Link>
                    ) : (
                      <a href={`https://discord.com/channels/${guildId}/${t.channelId}`} className="font-semibold text-coral-400" target="_blank" rel="noopener noreferrer">
                        In Discord →
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
