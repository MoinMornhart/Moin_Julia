import { roleBlockReason, roleWarning } from '@moin/shared';
import { MemberManager } from '@/components/MemberManager';
import { requireGuildAccess } from '@/lib/access';
import { actorTopPosition, botTopPosition, fetchMemberRows, roleInfos, type MemberRow } from '@/lib/members';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mitglieder' };

export default async function MembersPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { session, guild, canEdit, viaMaster } = await requireGuildAccess(guildId);

  let members: MemberRow[] = [];
  let error: string | null = null;
  let roles: Awaited<ReturnType<typeof roleInfos>> = [];
  let botTop = 0;
  let actorTop: number | null = null;
  try {
    roles = await roleInfos(guildId);
    [members, botTop, actorTop] = await Promise.all([fetchMemberRows(guildId), botTopPosition(guildId, roles), actorTopPosition(guildId, session.userId, viaMaster || guild.ownerId === session.userId, roles)]);
  } catch {
    error = 'Mitglieder konnten nicht geladen werden. Der Bot braucht im Discord-Entwicklerportal den „Server Members Intent“.';
  }

  return (
    <div className="grid max-w-5xl gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold">👥 Mitglieder</h1>
        <p className="mt-1 text-sm text-fog-300">
          Alle Mitglieder wie in Discord – suchen, sortieren und Rollen vergeben. Bevor jemand gefährliche Rechte bekommt, warnt das Dashboard.
        </p>
      </header>
      {error ? (
        <p role="alert" className="rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm">
          {error}
        </p>
      ) : (
        <MemberManager
          guildId={guildId}
          canEdit={canEdit}
          members={members}
          roles={roles
            .filter((r) => r.id !== guildId)
            .sort((a, b) => b.position - a.position)
            .map((r) => ({ id: r.id, name: r.name, color: r.color, blocked: roleBlockReason(r, guildId, botTop, actorTop), warning: roleWarning(r)?.perms.map((p) => p.label) ?? [] }))}
        />
      )}
    </div>
  );
}
