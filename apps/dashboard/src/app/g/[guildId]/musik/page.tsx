import { musicStateKey, parseMusicConfig, type MusicState } from '@moin/shared';
import { ModuleHeader } from '@/components/ModuleHeader';
import { MusicSettings, NowPlaying, YoutubeSwitch } from '@/components/MusicPanel';
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
  current: { title: 'Moin Shanty – Kapitänin Julia (Official Video)', url: 'https://www.youtube.com/watch?v=demo0000001', kind: 'youtube', requestedBy: '100000000000000002', startedAt: Date.now() - 74_000, durationMs: 213_000, author: 'Moin Records' },
  queue: [
    { title: 'Radio Hamburg', url: 'https://stream.example.org/radio-hamburg.mp3', kind: 'radio', requestedBy: '100000000000000002' },
    { title: 'Lofi Beats zum Entspannen', url: 'https://www.youtube.com/watch?v=demo0000002', kind: 'youtube', requestedBy: '100000000000000002', durationMs: 184_000 },
    { title: 'Mein Lieblingslied', url: 'https://x.example.org/song.mp3', kind: 'file', requestedBy: '100000000000000002' },
  ],
  effect: 'bassboost',
  autoplay: true,
  updatedAt: Date.now(),
};

export default async function MusicPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { session, canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'musik');
  const config = parseMusicConfig(row.config);
  const state = isDemoMode() ? { ...DEMO_STATE, current: { ...DEMO_STATE.current!, startedAt: Date.now() - 74_000 }, updatedAt: Date.now() } : await cacheGet<MusicState>(musicStateKey(guildId));
  let channels: ChannelOption[] = [];
  let roles: DiscordRole[] = [];
  try {
    [channels, roles] = await Promise.all([fetchGuildChannels(guildId), fetchGuildRoles(guildId)]);
  } catch {
    // nur Namen fehlen
  }
  const { instanceOwnerId, musicYoutube } = await appSettings();
  const isInstanceAdmin = !!instanceOwnerId && instanceOwnerId === session.userId;
  const isDj = !canEdit && config.djRoleIds.length > 0 && (await fetchMemberRoleIds(guildId, session.userId).catch(() => [] as string[])).some((r) => config.djRoleIds.includes(r));

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <div className="mb-6 max-w-4xl">
        <NowPlaying guildId={guildId} state={state} channelName={channels.find((c) => c.id === state?.channelId)?.name ?? null} canControl={canEdit || isDj} />
      </div>
      <div className="mb-6">
        <YoutubeSwitch guildId={guildId} enabled={musicYoutube === 'true'} isInstanceAdmin={isInstanceAdmin} />
      </div>
      <MusicSettings guildId={guildId} canEdit={canEdit} isInstanceAdmin={isInstanceAdmin} config={config} roles={roles.filter((r) => !r.managed).map(({ id, name }) => ({ id, name }))} />
    </>
  );
}
