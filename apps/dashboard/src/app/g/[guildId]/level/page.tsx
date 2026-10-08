import Link from 'next/link';
import { parseLevelConfig } from '@moin/shared';
import { Leaderboard } from '@/components/Leaderboard';
import { ResetXp, XpEditButton } from '@/components/LevelTools';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { getModuleRow } from '@/lib/modules';
import { levelTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Level & XP' };

const PER_PAGE = 50;

export default async function LevelPage({ params, searchParams }: { params: Promise<{ guildId: string }>; searchParams: Promise<{ seite?: string; q?: string }> }) {
  const { guildId } = await params;
  const sp = await searchParams;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'level');
  const config = parseLevelConfig(row.config);
  const q = sp.q?.trim().slice(0, 50) ?? '';
  const page = Math.max(1, Number(sp.seite) || 1);
  const where = { guildId, xp: { gt: 0 }, ...(q ? { OR: [{ userTag: { contains: q, mode: 'insensitive' as const } }, { userId: q }] } : {}) };
  const [rows, total, sum] = await Promise.all([
    db().memberXp.findMany({ where, orderBy: [{ xp: 'desc' }, { userId: 'asc' }], skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    db().memberXp.count({ where }),
    db().memberXp.aggregate({ where: { guildId }, _sum: { messages: true, voiceMinutes: true } }),
  ]);
  // Bei Suche: echter Platz statt Listenposition
  const places = q ? await Promise.all(rows.map(async (r) => (await db().memberXp.count({ where: { guildId, xp: { gt: r.xp } } })) + 1)) : null;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="board" tabs={levelTabs(guildId)} />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-fog-500">Mitglieder mit XP</p>
          <p className="font-display text-2xl font-bold tabular-nums">{total.toLocaleString('de-DE')}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-fog-500">Nachrichten gezählt</p>
          <p className="font-display text-2xl font-bold tabular-nums">{(sum._sum.messages ?? 0).toLocaleString('de-DE')}</p>
        </div>
        <div className="card col-span-2 p-4 sm:col-span-1">
          <p className="text-xs text-fog-500">Stunden im Sprachkanal</p>
          <p className="font-display text-2xl font-bold tabular-nums">{Math.round((sum._sum.voiceMinutes ?? 0) / 60).toLocaleString('de-DE')}</p>
        </div>
      </div>
      <form className="mb-4 flex flex-wrap items-center gap-3" method="get">
        <input name="q" defaultValue={q} placeholder="Mitglied suchen (Name oder ID)" className="input max-w-xs" />
        <button type="submit" className="btn-ghost">
          Suchen
        </button>
        {config.publicLeaderboard ? (
          <a href={`/rangliste/${guildId}`} target="_blank" rel="noopener" className="text-sm text-coral-400 underline">
            Öffentliche Rangliste ↗
          </a>
        ) : (
          <span className="text-xs text-fog-500">Öffentliche Rangliste ist aus (Einstellungen).</span>
        )}
      </form>
      {rows.length === 0 ? (
        <div className="card p-8 text-fog-300">{q ? 'Niemand gefunden.' : row.enabled ? 'Noch hat niemand XP gesammelt – sobald geschrieben oder geredet wird, geht es los.' : 'Schalte das Modul oben ein, dann sammeln alle XP.'}</div>
      ) : (
        <Leaderboard rows={rows} places={places ?? undefined} startPlace={(page - 1) * PER_PAGE + 1} extra={canEdit ? (x) => <XpEditButton guildId={guildId} userId={x.userId} xp={x.xp} /> : undefined} />
      )}
      {pages > 1 && (
        <nav className="mt-4 flex items-center gap-3 text-sm" aria-label="Seiten">
          {page > 1 && <Link href={`?seite=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`} className="btn-ghost">← zurück</Link>}
          <span className="text-fog-500">
            Seite {page} von {pages}
          </span>
          {page < pages && <Link href={`?seite=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`} className="btn-ghost">weiter →</Link>}
        </nav>
      )}
      {canEdit && total > 0 && (
        <div className="mt-8 max-w-2xl">
          <ResetXp guildId={guildId} />
        </div>
      )}
    </>
  );
}
