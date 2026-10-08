import { GalaxyImport } from '@/components/GalaxyImport';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { vorlagenTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Von GalaxyBot übernehmen' };

export default async function GalaxyPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit } = await requireGuildAccess(guildId);
  return (
    <>
      <div className="mb-8">
        <p className="text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Vorlagen</p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Von GalaxyBot übernehmen</h1>
        <p className="mt-2 max-w-2xl text-fog-300">
          GalaxyBot bietet keinen Export. Moin_Julia liest deshalb aus, was GalaxyBot auf deinem Server hinterlassen hat: seine AutoMod-Regeln und
          seine Nachrichten (z. B. Ticket-Panels). <b>Entferne GalaxyBot erst danach</b> – er löscht deine Einstellungen 3 Tage nach dem Entfernen.
        </p>
      </div>
      <ModuleTabs active="galaxy" tabs={vorlagenTabs(guildId)} />
      <GalaxyImport guildId={guildId} canEdit={canEdit} />
    </>
  );
}
