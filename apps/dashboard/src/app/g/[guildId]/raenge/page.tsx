import { roleBlockReason } from '@moin/shared';
import { RankBuilder } from '@/components/RankBuilder';
import { RankOrder, type OrderRole } from '@/components/RankOrder';
import { requireGuildAccess } from '@/lib/access';
import { fetchGuildRoles } from '@/lib/discord';
import { actorTopPosition, botTopPosition, movableRoles, roleInfos } from '@/lib/members';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ränge' };

export default async function RanksPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { session, guild, canEdit, viaMaster } = await requireGuildAccess(guildId);
  const isOwner = viaMaster || guild.ownerId === session.userId;

  let roles: { id: string; name: string; color: number; hoist: boolean; mentionable: boolean; permissions: string; blocked: string | null }[] = [];
  let order: OrderRole[] = [];
  let error: string | null = null;
  try {
    const [raw, infos] = await Promise.all([fetchGuildRoles(guildId), roleInfos(guildId)]);
    const [botTop, actorTop] = await Promise.all([botTopPosition(guildId, infos), actorTopPosition(guildId, session.userId, isOwner, infos)]);
    order = movableRoles(infos, guildId, botTop, actorTop).map(({ id, name, position, permissions, managed, hoist, color }) => ({ id, name, position, permissions, managed, hoist, color }));
    roles = raw
      .filter((r) => r.id !== guildId)
      .map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        hoist: !!r.hoist,
        mentionable: !!r.mentionable,
        permissions: r.permissions ?? '0',
        blocked: roleBlockReason({ id: r.id, name: r.name, position: r.position, permissions: r.permissions, managed: r.managed }, guildId, botTop, actorTop),
      }));
  } catch {
    error = 'Rollen konnten nicht geladen werden.';
  }

  return (
    <div className="grid max-w-5xl gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold">🎖️ Ränge</h1>
        <p className="mt-1 text-sm text-fog-300">
          Ränge ganz einfach bauen: Emoji, Trennzeichen, Name, Farbe und ein Rechte-Paket – wie „🔨‖Mod“ oder „💎 VIP“. Vorlagen anklicken, anpassen, anlegen.
        </p>
      </header>
      {error ? (
        <p role="alert" className="rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm">
          {error}
        </p>
      ) : (
        <>
          <RankBuilder guildId={guildId} canEdit={canEdit} isOwner={isOwner} roles={roles} />
          {canEdit && <RankOrder guildId={guildId} roles={order} />}
        </>
      )}
    </div>
  );
}
