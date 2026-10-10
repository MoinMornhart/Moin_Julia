import Link from 'next/link';
import { loadGuildSecrets } from '@moin/db';
import { DISPLAY_MODE_LABELS, feedSchema, parseFeedState, PLATFORM_LABELS, type Platform } from '@moin/shared';
import { FeedEditor, type FeedDraft } from '@/components/FeedEditor';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { appSettings } from '@/lib/config';
import { db } from '@/lib/db';
import { fetchGuildChannels, fetchGuildRoles, type ChannelOption, type DiscordRole } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';
import { alertsTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Social Media' };

const NEW_FEED: FeedDraft = (({ channelKey: _k, displayName: _d, ...rest }) => rest)(feedSchema.parse({ platform: 'twitch', channelKey: 'neu' }));

const DOT: Record<Platform, string> = { twitch: 'bg-[#9146ff]', youtube: 'bg-[#ff0033]', kick: 'bg-[#53fc18]' };

const ago = (d: Date) => {
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  return min < 1 ? 'gerade eben' : min < 60 ? `vor ${min} min` : d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' });
};

export default async function AlertsPage({ params, searchParams }: { params: Promise<{ guildId: string }>; searchParams: Promise<{ feed?: string }> }) {
  const { guildId } = await params;
  const { feed: selected } = await searchParams;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'alerts');
  const [feeds, settings, own] = await Promise.all([
    db().socialFeed.findMany({ where: { guildId }, orderBy: { createdAt: 'asc' } }),
    appSettings(),
    loadGuildSecrets(db(), guildId).catch(() => null),
  ]);
  let channels: ChannelOption[] = [];
  let roles: DiscordRole[] = [];
  let loadError = false;
  try {
    [channels, roles] = await Promise.all([fetchGuildChannels(guildId), fetchGuildRoles(guildId)]);
  } catch {
    loadError = true;
  }
  const channelName = (id: string) => channels.find((c) => c.id === id)?.name;
  // Verbunden = Instanz-Zugang ODER eigene App dieses Servers
  const connected = {
    twitch: !!(settings.twitchClientId && settings.twitchClientSecret) || !!(own?.twitchClientId && own.twitchClientSecret),
    kick: !!(settings.kickClientId && settings.kickClientSecret) || !!(own?.kickClientId && own.kickClientSecret),
  };
  const current = selected === 'neu' ? null : feeds.find((f) => f.id === selected);
  const parsed = current ? feedSchema.safeParse(current.data) : null;
  const currentState = current ? parseFeedState(current.state) : null;

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="feeds" tabs={alertsTabs(guildId, feeds.length)} />
      {!row.enabled && feeds.length > 0 && (
        <p className="mb-6 rounded-xl border border-sun-400/40 bg-sun-400/10 px-4 py-3 text-sm">Das Modul ist aus – es kommen keine Meldungen. Schalte es oben ein.</p>
      )}
      {loadError && <p className="mb-6 rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-3 text-sm">Kanäle oder Rollen konnten nicht geladen werden.</p>}
      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="grid content-start gap-2">
          {feeds.map((f) => {
            const d = feedSchema.safeParse(f.data);
            const state = parseFeedState(f.state);
            const platform = f.platform as Platform;
            return (
              <Link
                key={f.id}
                href={`/g/${guildId}/alerts?feed=${f.id}`}
                className={`rounded-xl border px-4 py-3 text-sm transition ${f.id === selected ? 'border-coral-500 bg-coral-500/10' : 'border-ink-700 bg-ink-900 hover:border-ink-600'}`}
              >
                <p className="flex items-center gap-2 font-semibold">
                  <span className={`size-2.5 shrink-0 rounded-full ${DOT[platform] ?? 'bg-fog-500'}`} aria-hidden />
                  <span className="truncate">{d.success ? d.data.displayName || d.data.channelKey : f.channelKey}</span>
                  {state.live && <span className="chip ml-auto bg-danger-500/15 text-danger-500">live</span>}
                </p>
                <p className="mt-0.5 truncate text-xs text-fog-500">
                  {PLATFORM_LABELS[platform] ?? f.platform} →{' '}
                  {d.success && platform !== 'youtube' && d.data.display !== 'classic'
                    ? `${DISPLAY_MODE_LABELS[d.data.display].label}${state.managed.channelId && channelName(state.managed.channelId) ? ` (#${channelName(state.managed.channelId)})` : ''}`
                    : `#${(d.success && channelName(d.data.discordChannelId)) || '?'}`}
                  {d.success && d.data.paused ? ' · pausiert' : ''}
                  {f.lastError ? ' · ⚠️ Problem' : ''}
                </p>
              </Link>
            );
          })}
          {canEdit && (
            <Link href={`/g/${guildId}/alerts?feed=neu`} className="btn-ghost">
              + Kanal hinzufügen
            </Link>
          )}
        </aside>
        <section className="min-w-0">
          {selected === 'neu' || parsed?.success ? (
            <>
              {current && (
                <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${current.lastError ? 'border-danger-500/40 bg-danger-500/10' : 'border-ink-700 bg-ink-900 text-fog-300'}`}>
                  {current.lastError ? (
                    <>⚠️ {current.lastError}</>
                  ) : current.lastCheckedAt ? (
                    <>
                      ✓ Zuletzt geprüft {ago(current.lastCheckedAt)}
                      {currentState?.live ? ` · gerade live: „${currentState.live.title || 'ohne Titel'}“` : ''}
                    </>
                  ) : (
                    <>⏳ Noch nicht geprüft – der Bot schaut innerhalb einer Minute nach{row.enabled ? '' : ' (sobald das Modul an ist)'}.</>
                  )}
                </div>
              )}
              <FeedEditor
                key={selected}
                guildId={guildId}
                feedId={current?.id ?? null}
                canEdit={canEdit}
                initial={parsed?.success ? (({ channelKey: _k, displayName: _d, ...rest }) => rest)(parsed.data) : NEW_FEED}
                channels={channels}
                roles={roles.map(({ id, name, color }) => ({ id, name, color }))}
                connected={connected}
              />
            </>
          ) : (
            <div className="card grid gap-3 p-8 text-fog-300">
              <p className="font-display text-xl font-semibold text-fog-100">Live-Meldungen und neue Videos</p>
              <p className="text-sm">Wie bei GalaxyBot: Sobald ein Kanal live geht oder ein neues Video hochlädt, meldet Moin_Julia das in deinem Discord – mit Rollen-Ping und schöner Karte.</p>
              <ul className="grid gap-1 text-sm">
                <li>▶️ <b className="text-fog-100">YouTube</b> – Videos, Shorts und Livestreams, ganz ohne Schlüssel.</li>
                <li>
                  🟣 <b className="text-fog-100">Twitch</b> und 🟢 <b className="text-fog-100">Kick</b> – einmalig unter{' '}
                  <Link href={`/g/${guildId}/alerts/verbindungen`} className="text-coral-400 underline">
                    Verbindungen
                  </Link>{' '}
                  einrichten (2 Minuten, mit Anleitung).
                </li>
              </ul>
              <p className="text-sm">{feeds.length ? 'Wähle links einen Kanal aus.' : 'Leg links deinen ersten Kanal an.'}</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
