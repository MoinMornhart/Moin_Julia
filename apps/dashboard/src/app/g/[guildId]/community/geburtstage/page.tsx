import { berlinParts, daysUntilBirthday } from '@moin/shared';
import { ActionButton } from '@/components/ActionButton';
import { ModuleHeader } from '@/components/ModuleHeader';
import { ModuleTabs } from '@/components/ModuleTabs';
import { requireGuildAccess } from '@/lib/access';
import { communityCounts } from '@/lib/community';
import { db } from '@/lib/db';
import { getModuleRow } from '@/lib/modules';
import { communityTabs } from '@/lib/tabs';
import { deleteBirthday } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Geburtstage' };

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** Kommende Geburtstage – ohne Geburtsjahr (das bleibt privat) */
export default async function BirthdaysPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { canEdit } = await requireGuildAccess(guildId);
  const row = await getModuleRow(guildId, 'community');
  const [counts, rows] = await Promise.all([communityCounts(guildId), db().birthday.findMany({ where: { guildId }, select: { id: true, userTag: true, day: true, month: true } })]);
  const today = berlinParts(new Date());
  const sorted = rows.map((b) => ({ ...b, days: daysUntilBirthday(b, today) })).sort((a, b) => a.days - b.days);

  return (
    <>
      <ModuleHeader guildId={guildId} meta={row.meta} enabled={row.enabled} canEdit={canEdit} />
      <ModuleTabs active="birthdays" tabs={communityTabs(guildId, counts)} />
      <p className="mb-4 text-sm text-fog-300">{rows.length} Geburtstage eingetragen. Mitglieder tragen sich selbst mit /geburtstag setzen ein – das Jahr bleibt privat.</p>
      {sorted.length === 0 ? (
        <div className="card p-8 text-fog-300">Noch niemand eingetragen.</div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {sorted.map((b) => (
            <li key={b.id} className={`card flex items-center gap-3 px-4 py-3 text-sm ${b.days === 0 ? 'border-coral-500' : ''}`}>
              <span className="text-xl" aria-hidden>
                {b.days === 0 ? '🎉' : '🎂'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{b.userTag}</span>
                <span className="text-xs text-fog-500">
                  {b.day}. {MONTHS[b.month - 1]} · {b.days === 0 ? 'heute!' : b.days === 1 ? 'morgen' : `in ${b.days} Tagen`}
                </span>
              </span>
              {canEdit && <ActionButton label="Entfernen" run={deleteBirthday.bind(null, guildId, b.id)} />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
