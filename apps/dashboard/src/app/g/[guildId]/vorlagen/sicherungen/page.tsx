import { ActionButton } from '@/components/ActionButton';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { vorlagenTabs } from '@/lib/tabs';
import { restoreBackup } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Backups' };

export default async function BackupsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit } = await requireGuildAccess(guildId);
  const backups = await db().configBackup.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' }, select: { id: true, reason: true, createdAt: true } });

  return (
    <>
      <div className="mb-8">
        <p className="text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Vorlagen</p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Backups</h1>
        <p className="mt-2 max-w-2xl text-fog-300">Vor jedem Import legt der Bot automatisch eine Sicherung an. Die letzten 20 bleiben erhalten.</p>
      </div>
      <ModuleTabs active="backups" tabs={vorlagenTabs(guildId)} />
      {backups.length === 0 ? (
        <div className="card max-w-4xl p-8 text-fog-300">Noch keine Backups – sie entstehen automatisch beim ersten Import.</div>
      ) : (
        <ul className="grid max-w-4xl gap-3">
          {backups.map((b) => (
            <li key={b.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{b.reason}</p>
                <p className="text-xs text-fog-500 tabular-nums">{b.createdAt.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' })}</p>
              </div>
              <ActionButton label="Wiederherstellen" disabled={!canEdit} run={restoreBackup.bind(null, guildId, b.id)} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
