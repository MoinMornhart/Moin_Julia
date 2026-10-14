import { copyJobKey, type CopyJob } from '@moin/shared';
import { ModuleTabs } from '@/components/ModuleTabs';
import { ServerCopy } from '@/components/ServerCopy';
import { requireGuildAccess } from '@/lib/access';
import { cacheGet } from '@/lib/redis';
import { vorlagenTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Server kopieren' };

export default async function ServerCopyPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit } = await requireGuildAccess(guildId);
  const job = canEdit ? await cacheGet<CopyJob>(copyJobKey(guildId)) : null;

  return (
    <>
      <div className="mb-8">
        <p className="text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Vorlagen</p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Server kopieren</h1>
        <p className="mt-2 max-w-2xl text-fog-300">
          Einen anderen Server hierher übertragen: Rollen, Kategorien und Kanäle mit Rechten – und auf Wunsch den Nachrichtenverlauf (mit Name, Bild und Datum der
          ursprünglichen Person). Geht nur, wenn du auf beiden Servern Owner oder Administrator bist.
        </p>
      </div>
      <ModuleTabs active="copy" tabs={vorlagenTabs(guildId)} />
      <ServerCopy guildId={guildId} canEdit={canEdit} initial={job} />
    </>
  );
}
