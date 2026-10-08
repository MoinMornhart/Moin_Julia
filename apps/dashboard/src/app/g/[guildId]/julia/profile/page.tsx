import Link from 'next/link';
import { ActionButton } from '@/components/ActionButton';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { appSettings } from '@/lib/config';
import { db } from '@/lib/db';
import { getModuleRow } from '@/lib/modules';
import { juliaTabs } from '@/lib/tabs';
import { clearProfile, deleteProfileFact, liftUnderage } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Julia – Profile' };

const PER_PAGE = 30;
const facts = (v: unknown) => (Array.isArray(v) ? (v as { text: string; at: string }[]).filter((f) => typeof f?.text === 'string') : []);

/** Was Julia über Mitglieder weiß – einsehbar und löschbar (Datenminimierung) */
export default async function JuliaProfilesPage({ params, searchParams }: { params: Promise<{ guildId: string }>; searchParams: Promise<{ seite?: string; q?: string }> }) {
  const { guildId } = await params;
  const sp = await searchParams;
  const { session, canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'julia');
  const s = await appSettings();
  const isAdmin = !!s.instanceOwnerId && s.instanceOwnerId === session.userId;
  const q = sp.q?.trim().slice(0, 50) ?? '';
  const page = Math.max(1, Number(sp.seite) || 1);
  const where = { guildId, ...(q ? { OR: [{ userTag: { contains: q, mode: 'insensitive' as const } }, { userId: q }, { nickname: { contains: q, mode: 'insensitive' as const } }] } : {}) };
  const [profiles, total] = await Promise.all([
    db().juliaProfile.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    db().juliaProfile.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="profiles" tabs={juliaTabs(guildId)} />
      <p className="mb-4 max-w-2xl text-sm text-fog-300">
        Hier steht alles, was Julia über Mitglieder gespeichert hat. Mitglieder sehen ihr eigenes Profil mit <code>/julia profil</code> und löschen es mit <code>/julia vergessen</code>.
      </p>
      <form className="mb-4 flex flex-wrap gap-3" method="get">
        <input name="q" defaultValue={q} placeholder="Suchen (Name, Spitzname oder ID)" className="input max-w-xs" />
        <button type="submit" className="btn-ghost">
          Suchen
        </button>
      </form>
      {profiles.length === 0 ? (
        <div className="card p-8 text-fog-300">{q ? 'Niemand gefunden.' : 'Noch keine Profile – sie entstehen, sobald jemand /julia spitzname, merken o. Ä. nutzt.'}</div>
      ) : (
        <ul className="grid gap-3">
          {profiles.map((p) => {
            const list = facts(p.facts);
            return (
              <li key={p.id} className="card grid gap-3 p-5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{p.userTag || p.userId}</span>
                  {p.nickname && <span className="text-fog-300">„{p.nickname}“</span>}
                  {p.address && <span className="chip bg-ink-800 text-fog-300">{p.address === 'sie' ? 'Sie' : 'du'}</span>}
                  {p.optOut && <span className="chip bg-ink-800 text-fog-300">abgemeldet</span>}
                  {p.flirtyOptIn && !p.underage && <span className="chip bg-coral-500/15 text-coral-400">Flirt an</span>}
                  {p.underage && <span className="chip bg-danger-500/15 text-danger-500">Alters-Sperre</span>}
                </div>
                {list.length > 0 ? (
                  <ul className="grid gap-1.5">
                    {list.map((f, i) => (
                      <li key={`${f.at}-${i}`} className="flex flex-wrap items-center gap-3 rounded-lg bg-ink-850 px-3 py-2">
                        <span className="min-w-0 flex-1">🧠 {f.text}</span>
                        {canEdit && <ActionButton label="Löschen" run={deleteProfileFact.bind(null, guildId, p.id, i)} />}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-fog-500">Nichts gemerkt.</p>
                )}
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <ActionButton label="Profil leeren" run={clearProfile.bind(null, guildId, p.id)} />
                    {p.underage && isAdmin && <ActionButton label="Alters-Sperre aufheben" run={liftUnderage.bind(null, guildId, p.id)} />}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
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
    </>
  );
}
