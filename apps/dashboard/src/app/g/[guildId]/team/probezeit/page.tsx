import { ActionButton } from '@/components/ActionButton';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { canReviewApplications, requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { getModuleRow } from '@/lib/modules';
import { teamTabs } from '@/lib/tabs';
import { decideProbation } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Probezeit' };

const date = (d: Date) => d.toLocaleDateString('de-DE', { dateStyle: 'medium', timeZone: 'Europe/Berlin' });

export default async function ProbationPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const access = await requireGuildAccess(guildId);
  const canReview = await canReviewApplications(access);
  const row = await getModuleRow(guildId, 'team');
  const [running, done, pending] = await Promise.all([
    db().probation.findMany({ where: { guildId, status: 'running' }, orderBy: { endAt: 'asc' } }),
    db().probation.findMany({ where: { guildId, status: { not: 'running' } }, orderBy: { endAt: 'desc' }, take: 20 }),
    db().application.count({ where: { guildId, status: 'pending' } }),
  ]);
  const now = Date.now();

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={access.canEdit} />
      <ModuleTabs active="probation" tabs={teamTabs(guildId, { pending, probation: running.length })} />
      <p className="mb-4 max-w-2xl text-sm text-fog-300">
        Laufende Probezeiten nach angenommenen Bewerbungen. Vor dem Ende erinnert der Bot im Log-Kanal – danach alle 3 Tage, bis hier entschieden ist.
      </p>
      {running.length === 0 ? (
        <div className="card p-8 text-fog-300">Gerade läuft keine Probezeit.</div>
      ) : (
        <ul className="grid gap-3">
          {running.map((p) => {
            const daysLeft = Math.ceil((p.endAt.getTime() - now) / 86_400_000);
            return (
              <li key={p.id} className="card flex flex-wrap items-center gap-4 p-4 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{p.userTag}</span>
                  <span className="block text-xs text-fog-500">
                    {p.positionTitle} · {date(p.startAt)} – {date(p.endAt)}
                  </span>
                </span>
                <span className={`chip ${daysLeft <= 0 ? 'bg-danger-500/15 text-danger-500' : daysLeft <= 3 ? 'bg-sun-400/15 text-sun-400' : 'bg-ink-800 text-fog-300'}`}>
                  {daysLeft <= 0 ? 'abgelaufen – bitte entscheiden' : `noch ${daysLeft} Tag(e)`}
                </span>
                {canReview && (
                  <span className="flex gap-2">
                    <ActionButton label="🎓 Bestanden" run={decideProbation.bind(null, guildId, p.id, true)} />
                    <ActionButton label="Nicht bestanden" run={decideProbation.bind(null, guildId, p.id, false)} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {done.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-semibold">Entschieden</h2>
          <ul className="grid gap-2 text-sm">
            {done.map((p) => (
              <li key={p.id} className="flex flex-wrap gap-3 rounded-xl border border-ink-800 px-4 py-2 text-fog-300">
                <span className="font-semibold text-fog-100">{p.userTag}</span>
                <span>{p.positionTitle}</span>
                <span className={p.status === 'passed' ? 'text-sea-400' : 'text-danger-500'}>{p.status === 'passed' ? 'bestanden' : 'nicht bestanden'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
