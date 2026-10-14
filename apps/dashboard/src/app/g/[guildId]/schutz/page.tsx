import { auditPermissions, isReadOnly, parseSchutzConfig, raidKey, type PermFinding } from '@moin/shared';
import { ModuleHeader } from '@/components/ModuleHeader';
import { PermissionCheck, type ReadOnlyChannel } from '@/components/PermissionCheck';
import { SchutzForm } from '@/components/SchutzForm';
import { requireGuildAccess } from '@/lib/access';
import { fetchGuildChannels, fetchGuildRoles, fetchPermissionData, type ChannelOption, type DiscordRole } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';
import { getRaw } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Server-Schutz' };

export default async function SchutzPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'schutz');
  const raidUntil = await getRaw(raidKey(guildId));

  let channels: ChannelOption[] = [];
  let roles: DiscordRole[] = [];
  let loadError = false;
  try {
    [channels, roles] = await Promise.all([fetchGuildChannels(guildId), fetchGuildRoles(guildId)]);
  } catch {
    loadError = true;
  }
  // Rechte-Check: getrennt laden – fehlt dem Bot etwas, bleibt der Rest der Seite nutzbar
  let findings: PermFinding[] | null = null;
  let readOnly: ReadOnlyChannel[] = [];
  try {
    const perms = await fetchPermissionData(guildId);
    findings = auditPermissions(guildId, perms.roles, perms.channels);
    readOnly = perms.channels.map((c) => ({ id: c.id, name: c.name, group: c.group, readOnly: isReadOnly(guildId, c) }));
  } catch {
    findings = null;
  }

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      {!row.enabled && (
        <p className="mb-6 rounded-xl border border-sun-400/40 bg-sun-400/10 px-4 py-3 text-sm">
          Das Modul ist aus – du kannst alles vorbereiten, aktiv wird es, sobald du es oben einschaltest.
        </p>
      )}
      {loadError && (
        <p className="mb-6 rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm">
          Kanäle oder Rollen konnten nicht geladen werden. Speichern ist gesperrt, damit nichts Gespeichertes verloren geht. Ist der Bot auf dem Server?
        </p>
      )}
      {findings && <PermissionCheck guildId={guildId} canEdit={canEdit} findings={findings} channels={readOnly} />}
      <SchutzForm
        guildId={guildId}
        canEdit={canEdit && !loadError}
        config={parseSchutzConfig(row.config)}
        channels={channels}
        roles={roles.map(({ id, name, color }) => ({ id, name, color }))}
        raidUntil={raidUntil}
      />
    </>
  );
}
