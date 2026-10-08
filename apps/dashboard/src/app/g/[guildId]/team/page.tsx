import Link from 'next/link';
import { APPLICATION_STATUS, APPLICATION_STATUS_LABELS, TAG_LABELS, type ApplicationStatus, type ApplicationTag } from '@moin/shared';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { getModuleRow } from '@/lib/modules';
import { teamTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bewerbungen' };

const PER_PAGE = 30;

/** Posteingang: Ausstehend (Standard) / Angenommen / Abgelehnt, 30 pro Seite */
export default async function InboxPage({ params, searchParams }: { params: Promise<{ guildId: string }>; searchParams: Promise<{ status?: string; seite?: string }> }) {
  const { guildId } = await params;
  const sp = await searchParams;
  const status: ApplicationStatus = (APPLICATION_STATUS as readonly string[]).includes(sp.status ?? '') ? (sp.status as ApplicationStatus) : 'pending';
  const page = Math.max(1, Number(sp.seite) || 1);
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'team');
  const [apps, total, counts, probation] = await Promise.all([
    db().application.findMany({
      where: { guildId, status },
      orderBy: { createdAt: status === 'pending' ? 'asc' : 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: { id: true, positionTitle: true, userTag: true, userId: true, userAvatar: true, createdAt: true, tag: true, handlerTag: true, interview: true },
    }),
    db().application.count({ where: { guildId, status } }),
    db().application.groupBy({ by: ['status'], where: { guildId }, _count: true }),
    db().probation.count({ where: { guildId, status: 'running' } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="inbox" tabs={teamTabs(guildId, { pending: count('pending'), probation })} />
      <div className="mb-4 flex flex-wrap gap-2">
        {APPLICATION_STATUS.map((s) => (
          <Link
            key={s}
            href={`/g/${guildId}/team?status=${s}`}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${status === s ? 'border-coral-500 bg-coral-500 text-ink-950' : 'border-ink-700 bg-ink-900 text-fog-300'}`}
          >
            {APPLICATION_STATUS_LABELS[s]}
            <span className={`rounded-full px-1.5 text-xs ${status === s ? 'bg-ink-950/20' : 'bg-ink-800 text-fog-500'}`}>{count(s)}</span>
          </Link>
        ))}
        <a href={`/bewerben/${guildId}`} target="_blank" rel="noopener" className="ml-auto self-center text-sm text-coral-400 underline">
          Bewerbungsseite ↗
        </a>
      </div>
      {apps.length === 0 ? (
        <div className="card p-8 text-fog-300">
          {status === 'pending' ? 'Keine offenen Bewerbungen. 🎉' : `Noch keine ${APPLICATION_STATUS_LABELS[status].toLowerCase()}en Bewerbungen.`}
        </div>
      ) : (
        <ul className="grid gap-2">
          {apps.map((a, i) => {
            const iv = a.interview as { status?: string } | null;
            return (
              <li key={a.id} className="enter" style={{ '--i': i } as React.CSSProperties}>
                <Link href={`/g/${guildId}/team/bewerbung/${a.id}`} className="card lift flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:border-ink-600">
                  {a.userAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`https://cdn.discordapp.com/avatars/${a.userId}/${a.userAvatar}.png?size=64`} alt="" className="size-9 rounded-full" />
                  ) : (
                    <span className="grid size-9 place-items-center rounded-full bg-ink-700 text-xs font-bold">{a.userTag.slice(0, 2).toUpperCase()}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{a.userTag}</span>
                    <span className="block text-xs text-fog-500">
                      {a.positionTitle} · {a.createdAt.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' })}
                    </span>
                  </span>
                  {a.tag && <span className="chip bg-ink-800 text-fog-300">{TAG_LABELS[a.tag as ApplicationTag]}</span>}
                  {iv?.status && <span className="chip bg-[#2f8bff]/15 text-[#7cb6ff]">🗓️ Gespräch {iv.status === 'accepted' ? 'zugesagt' : iv.status === 'declined' ? 'abgesagt' : 'eingeladen'}</span>}
                  <span className="text-xs text-fog-500">{a.handlerTag ? `👤 ${a.handlerTag}` : 'nicht übernommen'}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link href={`/g/${guildId}/team?status=${status}&seite=${page - 1}`} className="btn-ghost px-3 py-1.5">← Zurück</Link>}
          <span className="text-fog-500">
            Seite {page} von {pages}
          </span>
          {page < pages && <Link href={`/g/${guildId}/team?status=${status}&seite=${page + 1}`} className="btn-ghost px-3 py-1.5">Weiter →</Link>}
        </div>
      )}
    </>
  );
}
