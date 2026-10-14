import { getBlueprint, getModule, SERVER_BLUEPRINTS, withExtraRanks } from '@moin/shared';
import { ModuleTabs } from '@/components/ModuleTabs';
import { ServerProfiles, type BlueprintView } from '@/components/ServerProfiles';
import { requireGuildAccess } from '@/lib/access';
import { extraRanks } from '@/lib/blueprint-ranks';
import { appSettings } from '@/lib/config';
import { db } from '@/lib/db';
import { vorlagenTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Server-Profile' };

export default async function ServerProfilePage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit, session } = await requireGuildAccess(guildId);
  const isInstanceAdmin = (await appSettings()).instanceOwnerId === session.userId;
  const ranks = await extraRanks();
  const active = await db().serverProfile.findFirst({ where: { guildId, active: true }, orderBy: { createdAt: 'desc' } });
  const created = (active?.created ?? {}) as { roleIds?: string[]; channelIds?: string[] };

  const blueprints: BlueprintView[] = SERVER_BLUEPRINTS.map((base) => withExtraRanks(base, ranks)).map((b) => ({
    id: b.id,
    icon: b.icon,
    name: b.name,
    description: b.description,
    roles: b.roles.map((r) => ({ name: r.name, color: r.color, kind: r.kind, rankId: r.rankId })),
    categories: b.categories.map((c) => ({ name: c.name, team: c.access === 'team', channels: c.channels.map((ch) => ({ name: ch.name, voice: ch.type === 'voice', access: ch.access ?? c.access ?? 'all' })) })),
    modules: Object.keys(b.modules).map((id) => getModule(id)?.name.de ?? id),
  }));

  return (
    <>
      <div className="mb-8">
        <p className="text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Vorlagen</p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Server-Profile</h1>
        <p className="mt-2 max-w-2xl text-fog-300">
          Einen ganzen Server per Klick einrichten: Rollen, Kanäle mit passenden Rechten und Bot-Einstellungen. Vorher wird automatisch gesichert – beim
          Deaktivieren kommt der alte Stand zurück.
        </p>
      </div>
      <ModuleTabs active="profiles" tabs={vorlagenTabs(guildId)} />
      <ServerProfiles
        guildId={guildId}
        canEdit={canEdit}
        isInstanceAdmin={isInstanceAdmin}
        blueprints={blueprints}
        active={
          active
            ? {
                blueprintId: active.blueprintId,
                name: getBlueprint(active.blueprintId)?.name ?? active.blueprintId,
                since: active.createdAt.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }),
                createdCount: (created.roleIds?.length ?? 0) + (created.channelIds?.length ?? 0),
              }
            : null
        }
      />
    </>
  );
}
