import { SettingsForm } from '@/components/SettingsForm';
import { requireGuildAccess } from '@/lib/access';
import { fetchGuildRoles, type DiscordRole } from '@/lib/discord';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Einstellungen' };

export default async function SettingsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { guild, canEdit } = await requireGuildAccess(guildId);

  let roles: DiscordRole[] = [];
  let rolesError = false;
  try {
    roles = await fetchGuildRoles(guildId);
  } catch {
    rolesError = true;
  }

  return (
    <>
      <div className="mb-8">
        <p className="text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Einstellungen</p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Server-Einstellungen</h1>
      </div>
      <SettingsForm
        guildId={guildId}
        canEdit={canEdit}
        locale={guild.locale}
        modRoleIds={guild.modRoleIds}
        roles={roles.map(({ id, name, color }) => ({ id, name, color }))}
        rolesError={rolesError}
      />
    </>
  );
}
