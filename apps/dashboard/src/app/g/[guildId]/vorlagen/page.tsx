import { ImportWizard } from '@/components/ImportWizard';
import { ModuleTabs } from '@/components/ModuleTabs';
import { SectionCard } from '@/components/FormParts';
import { accessLevel, requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { vorlagenTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vorlagen' };

export default async function VorlagenPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { session, canEdit } = await requireGuildAccess(guildId);

  // Andere Server, auf denen der Bot ist und man Admin ist (Quelle für „vom anderen Server“)
  const known = await db().guild.findMany({ where: { id: { in: session.guilds.map((g) => g.id), not: guildId }, botPresent: true } });
  const otherGuilds: { id: string; name: string }[] = [];
  for (const g of known) {
    const level = await accessLevel(session, g);
    if (level === 'owner' || level === 'admin') otherGuilds.push({ id: g.id, name: g.name });
  }

  return (
    <>
      <div className="mb-8">
        <p className="text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Vorlagen</p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Einstellungen übertragen</h1>
        <p className="mt-2 max-w-2xl text-fog-300">
          Alle Bot-Einstellungen als Datei sichern, an Freunde weitergeben oder auf einen anderen Server übernehmen. Kanäle und Rollen werden dort per
          Name zugeordnet.
        </p>
      </div>
      <ModuleTabs active="transfer" tabs={vorlagenTabs(guildId)} />

      <div className="grid max-w-4xl gap-6">
        <SectionCard title="Exportieren" description="Lädt eine Vorlage-Datei mit allen Modul-Einstellungen, Rollen-Panels und der Bot-Sprache herunter. Tokens oder persönliche Daten (z. B. Moderations-Fälle) sind nicht enthalten.">
          {canEdit ? (
            <a href={`/g/${guildId}/vorlagen/export`} className="btn-primary w-fit" download>
              ⬇ Vorlage herunterladen
            </a>
          ) : (
            <p className="text-sm text-fog-500">Nur Owner und Admins können exportieren.</p>
          )}
        </SectionCard>

        <SectionCard title="Importieren" description="Aus einer Vorlage-Datei oder direkt von einem deiner anderen Server. Du siehst vorher genau, was übernommen wird.">
          <ImportWizard guildId={guildId} otherGuilds={otherGuilds} canEdit={canEdit} />
        </SectionCard>
      </div>
    </>
  );
}
