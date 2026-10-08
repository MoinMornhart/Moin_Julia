import Link from 'next/link';
import type { ModCaseType, Prisma } from '@moin/db';
import { formatDuration } from '@moin/shared';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { getModuleRow } from '@/lib/modules';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Moderations-Fälle' };

const PAGE_SIZE = 50;

const TYPES: Record<ModCaseType, { label: string; className: string; icon: string }> = {
  WARN: { label: 'Verwarnung', className: 'bg-sun-400/15 text-sun-400', icon: '⚠️' },
  TIMEOUT: { label: 'Timeout', className: 'bg-coral-500/15 text-coral-400', icon: '⏳' },
  UNTIMEOUT: { label: 'Timeout aufgehoben', className: 'bg-sea-500/15 text-sea-400', icon: '✅' },
  KICK: { label: 'Kick', className: 'bg-coral-500/15 text-coral-400', icon: '👢' },
  BAN: { label: 'Bann', className: 'bg-danger-500/15 text-danger-500', icon: '🔨' },
  UNBAN: { label: 'Bann aufgehoben', className: 'bg-sea-500/15 text-sea-400', icon: '🕊️' },
};

const SOURCES: Record<string, string> = { automod: 'Automod', escalation: 'Eskalation' };

export default async function CasesPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ q?: string; typ?: string; seite?: string }>;
}) {
  const { guildId } = await params;
  const { q = '', typ = '', seite = '1' } = await searchParams;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'moderation');

  const query = q.trim();
  const type = typ in TYPES ? (typ as ModCaseType) : undefined;
  const page = Math.max(1, Number(seite) || 1);
  const where: Prisma.ModCaseWhereInput = {
    guildId,
    ...(type ? { type } : {}),
    ...(query
      ? /^\d+$/.test(query)
        ? { OR: [{ userId: query }, { moderatorId: query }, { number: Number(query) < 2 ** 31 ? Number(query) : -1 }] }
        : { OR: [{ userTag: { contains: query, mode: 'insensitive' } }, { moderatorTag: { contains: query, mode: 'insensitive' } }, { reason: { contains: query, mode: 'insensitive' } }] }
      : {}),
  };
  const [cases, total, all] = await Promise.all([
    db().modCase.findMany({ where, orderBy: { number: 'desc' }, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
    db().modCase.count({ where }),
    db().modCase.count({ where: { guildId } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: Record<string, string>) => {
    const params = new URLSearchParams({ ...(query ? { q: query } : {}), ...(type ? { typ: type } : {}), ...p });
    return `/g/${guildId}/moderation/faelle${params.size ? `?${params}` : ''}`;
  };

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs
        active="cases"
        tabs={[
          { key: 'settings', label: 'Einstellungen', href: `/g/${guildId}/moderation` },
          { key: 'cases', label: `Fälle (${all})`, href: `/g/${guildId}/moderation/faelle` },
        ]}
      />

      <form className="mb-5 flex flex-wrap items-end gap-3" role="search">
        <label className="grid gap-1 text-sm">
          <span className="text-fog-300">Suche</span>
          <input name="q" defaultValue={query} placeholder="Name, User-ID, Fall-Nr. oder Grund" className="input w-full max-w-72" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-fog-300">Art</span>
          <select name="typ" defaultValue={type ?? ''} className="input w-48">
            <option value="">Alle</option>
            {Object.entries(TYPES).map(([value, t]) => (
              <option key={value} value={value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-ghost">Filtern</button>
        {(query || type) && (
          <Link href={`/g/${guildId}/moderation/faelle`} className="pb-2.5 text-sm text-fog-500 hover:text-coral-400">
            Zurücksetzen
          </Link>
        )}
      </form>

      {cases.length === 0 ? (
        <div className="card p-10 text-center text-fog-300">
          {all === 0 ? (
            <>
              <p className="font-display text-xl font-semibold text-fog-100">Noch keine Fälle 🎉</p>
              <p className="mt-2 text-sm">Sobald jemand <code>/warn</code>, <code>/timeout</code>, <code>/kick</code> oder <code>/ban</code> nutzt, erscheinen die Fälle hier.</p>
            </>
          ) : (
            <p>Keine Fälle passen zu diesem Filter.</p>
          )}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-700 text-xs tracking-wider text-fog-500 uppercase">
              <tr>
                <th className="px-4 py-3">Fall</th>
                <th className="px-4 py-3">Art</th>
                <th className="px-4 py-3">Mitglied</th>
                <th className="px-4 py-3">Moderator</th>
                <th className="px-4 py-3">Grund</th>
                <th className="px-4 py-3">Datum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {cases.map((c) => {
                const info = TYPES[c.type];
                return (
                  <tr key={c.id} className={c.active ? '' : 'opacity-55'}>
                    <td className="px-4 py-3 font-mono tabular-nums text-fog-300">#{c.number}</td>
                    <td className="px-4 py-3">
                      <span className={`chip ${info.className}`}>
                        {info.icon} {info.label}
                      </span>
                      {c.durationSec ? <span className="ml-2 text-xs text-fog-500">{formatDuration(c.durationSec * 1000, 'de')}</span> : null}
                      {!c.active && <span className="ml-2 text-xs text-fog-500">↩️ zurückgenommen</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{c.userTag}</span>
                      <span className="block font-mono text-[11px] text-fog-500">{c.userId}</span>
                    </td>
                    <td className="px-4 py-3">
                      {c.moderatorTag}
                      {SOURCES[c.source] && <span className="chip ml-2 bg-ink-800 text-fog-500">{SOURCES[c.source]}</span>}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-fog-300">{c.reason ?? <span className="text-fog-500">–</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-fog-500 tabular-nums">
                      {c.createdAt.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center gap-3 text-sm" aria-label="Seiten">
          {page > 1 && (
            <Link className="btn-ghost px-3 py-1.5" href={link({ seite: String(page - 1) })}>
              ← Neuere
            </Link>
          )}
          <span className="text-fog-500">
            Seite {page} von {pages}
          </span>
          {page < pages && (
            <Link className="btn-ghost px-3 py-1.5" href={link({ seite: String(page + 1) })}>
              Ältere →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
