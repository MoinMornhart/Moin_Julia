import Link from 'next/link';
import { positionSchema, type PositionData } from '@moin/shared';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { PositionEditor } from '@/components/PositionEditor';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';
import { fetchGuildRoles, type DiscordRole } from '@/lib/discord';
import { getModuleRow } from '@/lib/modules';
import { teamTabs } from '@/lib/tabs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Stellen' };

const NEW_POSITION: PositionData = positionSchema.parse({
  title: 'Moderator:in',
  emoji: '🛡️',
  description: 'Du hilfst im Chat, behältst die Regeln im Blick und bist freundlich zu allen.',
  questions: [
    { id: 'f1', label: 'Wie alt bist du?', type: 'short', maxLength: 3 },
    { id: 'f2', label: 'Warum möchtest du ins Team?', type: 'long', minLength: 50 },
    { id: 'f3', label: 'Wie oft bist du online?', type: 'select', options: [{ label: 'Täglich' }, { label: 'Mehrmals pro Woche' }, { label: 'Am Wochenende' }] },
  ],
  probationDays: 14,
});

export default async function PositionsPage({ params, searchParams }: { params: Promise<{ guildId: string }>; searchParams: Promise<{ stelle?: string }> }) {
  const { guildId } = await params;
  const { stelle: selected } = await searchParams;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'team');
  const [positions, pending, probation] = await Promise.all([
    db().jobPosition.findMany({ where: { guildId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
    db().application.count({ where: { guildId, status: 'pending' } }),
    db().probation.count({ where: { guildId, status: 'running' } }),
  ]);
  let roles: DiscordRole[] = [];
  try {
    roles = await fetchGuildRoles(guildId);
  } catch {
    // leer
  }
  const current = selected === 'neu' ? null : positions.find((p) => p.id === selected);
  const parsed = current ? positionSchema.safeParse(current.data) : null;

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="positions" tabs={teamTabs(guildId, { pending, probation })} />
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="grid content-start gap-2">
          {positions.map((p) => {
            const d = positionSchema.safeParse(p.data);
            return (
              <Link
                key={p.id}
                href={`/g/${guildId}/team/stellen?stelle=${p.id}`}
                className={`rounded-xl border px-4 py-3 text-sm transition ${p.id === selected ? 'border-coral-500 bg-coral-500/10' : 'border-ink-700 bg-ink-900 hover:border-ink-600'}`}
              >
                <p className="font-semibold">
                  {d.success ? `${d.data.emoji} ${d.data.title}` : 'Stelle'}
                </p>
                <p className="text-xs text-fog-500">{d.success && d.data.open ? 'offen' : 'geschlossen'}</p>
              </Link>
            );
          })}
          {canEdit && (
            <Link href={`/g/${guildId}/team/stellen?stelle=neu`} className="btn-ghost">
              + Neue Stelle
            </Link>
          )}
          <a href={`/bewerben/${guildId}`} target="_blank" rel="noopener" className="px-1 text-xs text-coral-400 underline">
            Öffentliche Bewerbungsseite ansehen ↗
          </a>
        </aside>
        <section>
          {selected === 'neu' || parsed?.success ? (
            <PositionEditor
              key={selected}
              guildId={guildId}
              positionId={current?.id ?? null}
              canEdit={canEdit}
              initial={parsed?.success ? parsed.data : NEW_POSITION}
              roles={roles.map(({ id, name, color }) => ({ id, name, color }))}
            />
          ) : (
            <div className="card p-8 text-fog-300">
              <p className="font-display text-xl font-semibold text-fog-100">Stellen ausschreiben</p>
              <p className="mt-2 text-sm">
                Jede Stelle erscheint auf eurer öffentlichen Bewerbungsseite – mit eigenen Fragen, Rollen bei Annahme und optionaler Probezeit.{' '}
                {positions.length ? 'Wähle links eine Stelle aus.' : 'Leg links deine erste Stelle an.'}
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
