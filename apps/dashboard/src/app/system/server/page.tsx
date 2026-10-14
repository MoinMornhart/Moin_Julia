import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ServerOverview } from '@/components/ServerOverview';
import { appSettings } from '@/lib/config';
import { db } from '@/lib/db';
import { guildIconUrl } from '@/lib/discord';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Alle Server' };

/** Server-Übersicht für den Instanz-Admin (Wunsch Philip) */
export default async function ServersOverviewPage() {
  const session = await requireSession();
  const s = await appSettings();
  if (!s.instanceOwnerId || session.userId !== s.instanceOwnerId) notFound();
  const guilds = await db().guild.findMany({ where: { botPresent: true }, select: { id: true, name: true, icon: true }, orderBy: { name: 'asc' } });

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8">
      <Link href="/system" className="text-sm text-fog-500 hover:text-fog-100">
        ← System
      </Link>
      <header>
        <h1 className="font-display text-2xl font-bold">🌐 Alle Server mit dem Bot ({guilds.length})</h1>
        <p className="mt-1 text-sm text-fog-300">
          Nur für dich als Betreiber: Kanäle, Rollen und Mitgliederzahl (nur Namen). „Einladung per DM“ schickt dir einen Einladungs-Link (1× nutzbar, 1 Stunde) – das steht im
          Audit-Log und im Log-Kanal des Servers. <b>Mitlesen</b> geht nur, wenn Owner oder Admin dort <code>/moin support-zugang</code> erlaubt haben. Sprachkanäle hört der Bot
          nie mit – dafür trittst du per Einladung selbst bei.
        </p>
      </header>
      <ServerOverview guilds={guilds.map((g) => ({ id: g.id, name: g.name, icon: guildIconUrl({ id: g.id, icon: g.icon }, 64) }))} />
    </main>
  );
}
