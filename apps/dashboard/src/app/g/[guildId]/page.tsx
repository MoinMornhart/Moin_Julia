import { MODULES, type ModuleMeta } from '@moin/shared';
import { BotStatus } from '@/components/BotStatus';
import { ModuleGrid } from '@/components/ModuleGrid';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Übersicht' };

export default async function GuildOverview({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { guild, canEdit } = await requireGuildAccess(guildId);
  const stored = await db().guildModule.findMany({ where: { guildId } });
  const enabledOf = (m: ModuleMeta) => m.status === 'available' && (stored.find((s) => s.moduleId === m.id)?.enabled ?? m.defaultEnabled);

  const modules = [...MODULES].sort((a, b) => a.order - b.order);
  const available = modules.filter((m) => m.status === 'available');
  const activeCount = available.filter(enabledOf).length;
  const progress = Math.round((available.length / modules.length) * 100);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Übersicht</p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">{guild.name}</h1>
        </div>
        <BotStatus />
      </div>

      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <Stat i={0} label="Module aktiv" value={`${activeCount}`} hint={`von ${available.length} verfügbaren`} bar={available.length ? (activeCount / available.length) * 100 : 0} tone="sea" />
        <Stat i={1} label="Ausbau" value={`${progress} %`} hint={`${modules.length - available.length} Module kommen noch`} bar={progress} tone="coral" />
        <Stat i={2} label="Bot-Sprache" value={guild.locale === 'en' ? 'English' : 'Deutsch'} hint="unter Einstellungen änderbar" />
      </section>

      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold">Module</h2>
        {!canEdit && <p className="text-sm text-sun-400">Nur-Lesen: Du bist als Mod angemeldet.</p>}
      </div>

      <ModuleGrid
        guildId={guildId}
        canEdit={canEdit}
        modules={modules.map((m) => ({
          id: m.id,
          icon: m.icon,
          name: m.name.de,
          description: m.description.de,
          category: m.category,
          planned: m.status === 'planned',
          order: m.order,
          enabled: enabledOf(m),
          hasSettings: m.hasSettings,
        }))}
      />
    </>
  );
}

function Stat({ i, label, value, hint, bar, tone }: { i: number; label: string; value: string; hint: string; bar?: number; tone?: 'sea' | 'coral' }) {
  return (
    <div className={`enter card p-4 sm:p-5 ${i === 2 ? 'col-span-2 sm:col-span-1' : ''}`} style={{ '--i': i } as React.CSSProperties}>
      <p className="text-xs font-bold tracking-[0.15em] text-fog-500 uppercase">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold sm:text-3xl">{value}</p>
      {bar !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-800">
          <div
            className={`grow-bar h-full rounded-full ${tone === 'sea' ? 'bg-sea-500' : 'bg-gradient-to-r from-coral-400 to-[#ee3f82]'}`}
            style={{ width: `${Math.max(2, bar)}%` }}
          />
        </div>
      )}
      <p className="mt-2 text-xs text-fog-500">{hint}</p>
    </div>
  );
}
