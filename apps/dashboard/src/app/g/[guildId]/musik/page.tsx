import { musicStateKey, parseMusicConfig, type MusicState } from '@moin/shared';
import { ModuleHeader } from '@/components/ModuleHeader';
import { MusicSettings, NowPlaying } from '@/components/MusicPanel';
import { requireGuildAccess } from '@/lib/access';
import { appSettings } from '@/lib/config';
import { fetchGuildChannels, fetchGuildRoles, fetchMemberRoleIds, type ChannelOption, type DiscordRole } from '@/lib/discord';
import { isDemoMode } from '@/lib/env';
import { getModuleRow } from '@/lib/modules';
import { cacheGet } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Musik' };

/** Demo: so sieht „Jetzt läuft“ aus */
const DEMO_STATE: MusicState = {
  channelId: '100000000000000026',
  playing: true,
  paused: false,
  volume: 50,
  loop: 'off',
  current: { title: 'Radio Hamburg', url: 'https://stream.example.org/radio-hamburg.mp3', kind: 'radio', requestedBy: '100000000000000002', startedAt: Date.now() - 754_000 },
  queue: [
    { title: 'Lofi Beats', url: 'https://stream.example.org/lofi', kind: 'radio', requestedBy: '100000000000000002' },
    { title: 'Mein Lieblingslied', url: 'https://x.example.org/song.mp3', kind: 'file', requestedBy: '100000000000000002' },
  ],
  updatedAt: Date.now(),
};

export default async function MusicPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { session, canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'musik');
  const config = parseMusicConfig(row.config);
  const state = isDemoMode() ? DEMO_STATE : await cacheGet<MusicState>(musicStateKey(guildId));
  let channels: ChannelOption[] = [];
  let roles: DiscordRole[] = [];
  try {
    [channels, roles] = await Promise.all([fetchGuildChannels(guildId), fetchGuildRoles(guildId)]);
  } catch {
    // nur Namen fehlen
  }
  const { instanceOwnerId } = await appSettings();
  const isInstanceAdmin = !!instanceOwnerId && instanceOwnerId === session.userId;
  const isDj = !canEdit && config.djRoleIds.length > 0 && (await fetchMemberRoleIds(guildId, session.userId).catch(() => [] as string[])).some((r) => config.djRoleIds.includes(r));

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <div className="mb-6 max-w-4xl">
        <NowPlaying guildId={guildId} state={state} channelName={channels.find((c) => c.id === state?.channelId)?.name ?? null} canControl={canEdit || isDj} />
      </div>
      <details className="mb-6 max-w-4xl rounded-xl border border-ink-700 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold">Warum kein YouTube oder Spotify?</summary>
        <p className="mt-2 text-fog-300">
          YouTube und Spotify verbieten in ihren Nutzungsbedingungen, ihre Musik über Bots abzuspielen – deshalb wurden bekannte Musik-Bots wie Rythm und Groovy abgeschaltet. Moin_Julia spielt
          stattdessen <b>Internet-Radio</b> (über 50.000 Sender, Suche beim Tippen von /musik play) und <b>direkte Audio-Links</b> (MP3, OGG, M4A …), z. B. eigene Dateien.
        </p>
      </details>
      <MusicSettings guildId={guildId} canEdit={canEdit} isInstanceAdmin={isInstanceAdmin} config={config} roles={roles.filter((r) => !r.managed).map(({ id, name }) => ({ id, name }))} />
    </>
  );
}
