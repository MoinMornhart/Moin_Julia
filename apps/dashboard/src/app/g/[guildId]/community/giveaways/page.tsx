import { ActionButton } from '@/components/ActionButton';
import { GiveawayForm } from '@/components/CommunityTools';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { communityCounts } from '@/lib/community';
import { db } from '@/lib/db';
import { fetchGuildChannels, fetchGuildRoles, type ChannelOption, type DiscordRole } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';
import { communityTabs } from '@/lib/tabs';
import { giveawayAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Giveaways' };

const when = (d: Date) => d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' });
const list = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);

export default async function GiveawaysPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'community');
  const [counts, giveaways] = await Promise.all([communityCounts(guildId), db().giveaway.findMany({ where: { guildId }, orderBy: [{ ended: 'asc' }, { endsAt: 'desc' }], take: 50 })]);
  let channels: ChannelOption[] = [];
  let roles: DiscordRole[] = [];
  try {
    [channels, roles] = await Promise.all([fetchGuildChannels(guildId), fetchGuildRoles(guildId)]);
  } catch {
    // leer lassen
  }
  const channelName = (id: string) => channels.find((c) => c.id === id)?.name ?? id;
  // Namen der Gewinner aus bekannten Einträgen (Level, Geburtstage) – sonst die ID
  const winnerIds = [...new Set(giveaways.flatMap((g) => list(g.winnerIds)))];
  const known = winnerIds.length
    ? await Promise.all([
        db().memberXp.findMany({ where: { guildId, userId: { in: winnerIds } }, select: { userId: true, userTag: true } }),
        db().birthday.findMany({ where: { guildId, userId: { in: winnerIds } }, select: { userId: true, userTag: true } }),
      ])
    : [[], []];
  const names = new Map(known.flat().filter((k) => k.userTag).map((k) => [k.userId, k.userTag]));

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="giveaways" tabs={communityTabs(guildId, counts)} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="grid content-start gap-3">
          {giveaways.length === 0 && <div className="card p-8 text-fog-300">Noch keine Giveaways – starte rechts eins oder mit /giveaway start in Discord.</div>}
          {giveaways.map((g) => {
            const entrants = list(g.entrants);
            const winners = list(g.winnerIds);
            return (
              <article key={g.id} className="card grid gap-2 p-5 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-display text-base font-bold">🎉 {g.prize}</span>
                  <span className={`chip ${g.ended ? 'bg-ink-800 text-fog-300' : 'bg-coral-500/15 text-coral-400'}`}>{g.ended ? 'beendet' : 'läuft'}</span>
                </div>
                <p className="text-fog-300">
                  #{channelName(g.channelId)} · {g.ended ? 'endete' : 'endet'} {when(g.endsAt)} · {g.winnerCount} Gewinner · {entrants.length} Teilnehmer
                </p>
                {g.ended && <p>Gewinner: {winners.length ? winners.map((w) => names.get(w) ?? w).join(', ') : 'niemand'}</p>}
                <div className="flex flex-wrap gap-2">
                  {!g.ended && <ActionButton label="Jetzt beenden" run={giveawayAction.bind(null, guildId, g.id, 'end')} />}
                  {g.ended && entrants.length > winners.length && <ActionButton label="Neu auslosen" run={giveawayAction.bind(null, guildId, g.id, 'reroll')} />}
                </div>
              </article>
            );
          })}
        </section>
        <aside>
          <GiveawayForm guildId={guildId} channels={channels} roles={roles.map(({ id, name }) => ({ id, name }))} />
        </aside>
      </div>
    </>
  );
}
