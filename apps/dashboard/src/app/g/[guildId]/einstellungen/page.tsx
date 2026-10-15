import { supportBlockKey, supportRequestKey, supportScopesText, supportUntilText, type SupportRequest } from '@moin/shared';
import { GuildBotProfileForm } from '@/components/BotProfileForm';
import { OperatorAccess } from '@/components/OperatorAccess';
import { cacheGet } from '@/lib/redis';
import { SettingsForm } from '@/components/SettingsForm';
import { getBotProfile, getGuildBotProfile } from '@/lib/botProfile';
import { operatorGrant, requireGuildAccess } from '@/lib/access';
import { fetchGuildRoles, type DiscordRole } from '@/lib/discord';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Einstellungen' };

export default async function SettingsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { guild, canEdit, level, viaMaster } = await requireGuildAccess(guildId);
  const [grant, request, blocked] = await Promise.all([operatorGrant(guildId), cacheGet<SupportRequest>(supportRequestKey(guildId)), cacheGet<unknown>(supportBlockKey(guildId))]);
  const when = (ms: number) => new Date(ms).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  let roles: DiscordRole[] = [];
  let rolesError = false;
  try {
    roles = await fetchGuildRoles(guildId);
  } catch {
    rolesError = true;
  }

  let botName = 'Moin_Julia';
  let globalAvatar: string | null = null;
  let guildProfile = { nick: '', avatarUrl: null as string | null, bannerUrl: null as string | null };
  let profileError: string | undefined;
  try {
    const [p, g] = await Promise.all([getBotProfile(), getGuildBotProfile(guildId)]);
    botName = p.username;
    globalAvatar = p.avatarUrl;
    guildProfile = g;
  } catch (error) {
    profileError = error instanceof Error ? error.message : 'Discord nicht erreichbar';
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
      <GuildBotProfileForm guildId={guildId} canEdit={canEdit} botName={botName} initial={{ ...guildProfile, globalAvatarUrl: globalAvatar }} loadError={profileError} />
      <OperatorAccess
        guildId={guildId}
        canManage={!viaMaster && (level === 'owner' || level === 'admin')}
        view={{
          grant: grant ? { scopes: supportScopesText(grant), until: supportUntilText(grant), by: grant.byName, reason: grant.reason ?? null } : null,
          request: request ? { by: request.byName, reason: request.reason, scopes: request.scopes, scopesText: supportScopesText(request), at: when(request.at) } : null,
          blocked: !!blocked,
        }}
      />
    </>
  );
}
