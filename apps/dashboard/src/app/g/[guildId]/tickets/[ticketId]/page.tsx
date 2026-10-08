import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ticket-Verlauf' };

/** Transcript eines geschlossenen Tickets – im abgeschotteten iframe (keine Skripte, kein Zugriff aufs Dashboard) */
export default async function TicketTranscriptPage({ params }: { params: Promise<{ guildId: string; ticketId: string }> }) {
  const { guildId, ticketId } = await params;
  await requireGuildAccess(guildId);
  const ticket = await db().ticket.findFirst({ where: { id: ticketId, guildId } });
  if (!ticket) notFound();
  return (
    <>
      <div className="mb-6">
        <Link href={`/g/${guildId}/tickets/liste`} className="text-sm text-coral-400 hover:text-coral-500">
          ← Alle Tickets
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          Ticket #{ticket.number} · {ticket.reasonLabel}
        </h1>
        <p className="mt-1 text-sm text-fog-500">
          {ticket.openerTag}
          {ticket.closeReason ? ` · ${ticket.closeReason}` : ''}
          {ticket.rating ? ` · ${'★'.repeat(ticket.rating)}` : ''}
        </p>
      </div>
      {ticket.transcript ? (
        <iframe title={`Verlauf Ticket ${ticket.number}`} srcDoc={ticket.transcript} sandbox="" className="h-[75dvh] w-full rounded-2xl border border-ink-700 bg-[#313338]" />
      ) : (
        <div className="card p-8 text-fog-300">Für dieses Ticket gibt es (noch) keinen Verlauf.</div>
      )}
    </>
  );
}
