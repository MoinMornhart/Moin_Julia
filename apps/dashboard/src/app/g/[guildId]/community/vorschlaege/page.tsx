import Link from 'next/link';
import { parseCommunityConfig, SUGGESTION_STATUS, SUGGESTION_STATUS_LABELS, suggestionBoards, voteCounts, type SuggestionStatus } from '@moin/shared';
import { ActionButton } from '@/components/ActionButton';
import { SuggestionDecision } from '@/components/CommunityTools';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { SuggestionBoards } from '@/components/SuggestionBoards';
import { requireGuildAccess } from '@/lib/access';
import { communityCounts } from '@/lib/community';
import { db } from '@/lib/db';
import { fetchGuildChannels, fetchGuildRoles, type ChannelOption, type DiscordRole } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';
import { communityTabs } from '@/lib/tabs';
import { deleteSuggestion } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vorschläge' };

const CHIP: Record<SuggestionStatus, string> = {
  open: 'bg-coral-500/15 text-coral-400',
  accepted: 'bg-sea-500/15 text-sea-400',
  denied: 'bg-danger-500/15 text-danger-500',
  considered: 'bg-sun-400/15 text-sun-400',
};

export default async function SuggestionsPage({ params, searchParams }: { params: Promise<{ guildId: string }>; searchParams: Promise<{ status?: string }> }) {
  const { guildId } = await params;
  const sp = await searchParams;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'community');
  const status = (SUGGESTION_STATUS as readonly string[]).includes(sp.status ?? '') ? (sp.status as SuggestionStatus) : null;
  const cfg = parseCommunityConfig(row.config).suggestions;
  let channels: ChannelOption[] = [];
  let roles: DiscordRole[] = [];
  try {
    [channels, roles] = await Promise.all([fetchGuildChannels(guildId), fetchGuildRoles(guildId)]);
  } catch {
    // nur Namen fehlen
  }
  const boardName = new Map(suggestionBoards(cfg).map((b) => [b.id, b.name]));
  const [counts, list] = await Promise.all([
    communityCounts(guildId),
    db().suggestion.findMany({ where: { guildId, ...(status ? { status } : {}) }, orderBy: { createdAt: 'desc' }, take: 50 }),
  ]);

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="suggestions" tabs={communityTabs(guildId, counts)} />
      <SuggestionBoards
        guildId={guildId}
        canEdit={canEdit}
        enabled={cfg.enabled}
        main={cfg.channelId ? { name: cfg.name, channelId: cfg.channelId } : null}
        initial={cfg.boards}
        channels={channels}
        roles={roles.filter((r) => !r.managed).map(({ id, name }) => ({ id, name }))}
      />
      <nav className="mb-4 flex flex-wrap gap-2 text-sm" aria-label="Filter">
        <Link href="?" className={`chip ${!status ? 'bg-coral-500 text-ink-950' : 'bg-ink-800 text-fog-300'}`}>
          Alle
        </Link>
        {SUGGESTION_STATUS.map((s) => (
          <Link key={s} href={`?status=${s}`} className={`chip ${status === s ? 'bg-coral-500 text-ink-950' : 'bg-ink-800 text-fog-300'}`}>
            {SUGGESTION_STATUS_LABELS[s]}
          </Link>
        ))}
      </nav>
      {list.length === 0 ? (
        <div className="card p-8 text-fog-300">Noch keine Vorschläge. Mitglieder schlagen per Knopf im Kanal oder mit /vorschlag etwas vor (Kanal unter Einstellungen festlegen).</div>
      ) : (
        <ul className="grid gap-3">
          {list.map((s) => {
            const { up, down } = voteCounts((s.votes ?? {}) as Record<string, number>);
            const st = s.status as SuggestionStatus;
            return (
              <li key={s.id} className="card grid gap-3 p-5 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-display text-base font-bold">#{s.number}</span>
                  <span className={`chip ${CHIP[st]}`}>{SUGGESTION_STATUS_LABELS[st]}</span>
                  {boardName.size > 1 && <span className="chip bg-ink-800 text-fog-300">{boardName.get(s.boardId) ?? 'Bereich gelöscht'}</span>}
                  <span className="text-fog-500">
                    von {s.userTag} · {s.createdAt.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}
                  </span>
                  <span className="ml-auto tabular-nums">
                    👍 {up} · 👎 {down}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-fog-100">{s.text}</p>
                <SuggestionDecision guildId={guildId} suggestionId={s.id} status={st} reason={s.reason} />
                {canEdit && (
                  <div className="text-right">
                    <ActionButton label="Löschen" run={deleteSuggestion.bind(null, guildId, s.id)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
