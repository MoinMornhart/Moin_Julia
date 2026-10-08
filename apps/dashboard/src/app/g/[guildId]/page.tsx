import Link from 'next/link';
import { CATEGORY_LABELS, MODULES, type ModuleMeta } from '@moin/shared';
import { ModuleToggle } from '@/components/ModuleToggle';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Übersicht' };

export default async function GuildOverview({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const { guild, canEdit } = await requireGuildAccess(guildId);
  const stored = await db().guildModule.findMany({ where: { guildId } });
  const enabledOf = (m: ModuleMeta) => stored.find((s) => s.moduleId === m.id)?.enabled ?? m.defaultEnabled;

  const modules = [...MODULES].sort((a, b) => a.order - b.order);
  const activeCount = modules.filter((m) => m.status === 'available' && enabledOf(m)).length;
  const available = modules.filter((m) => m.status === 'available').length;

  return (
    <>
      <div className="mb-8">
        <p className="text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">Übersicht</p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">{guild.name}</h1>
      </div>

      <section className="mb-10 grid gap-4 sm:grid-cols-3">
        <Stat label="Module aktiv" value={`${activeCount}`} hint={`von ${available} verfügbaren`} />
        <Stat label="Im Bau" value={`${modules.length - available}`} hint="kommen Modul für Modul" />
        <Stat label="Bot-Sprache" value={guild.locale === 'en' ? 'English' : 'Deutsch'} hint="in Einstellungen änderbar" />
      </section>

      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold">Module</h2>
        {!canEdit && <p className="text-sm text-sun-400">Nur-Lesen: Du bist als Mod angemeldet.</p>}
      </div>

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((m) => {
          const planned = m.status === 'planned';
          const enabled = !planned && enabledOf(m);
          return (
            <li
              key={m.id}
              className={`card flex flex-col p-5 transition ${enabled ? 'border-sea-500/50' : ''} ${planned ? 'opacity-75' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-ink-800 text-2xl" aria-hidden>
                  {m.icon}
                </span>
                <ModuleToggle
                  guildId={guildId}
                  moduleId={m.id}
                  enabled={enabled}
                  disabled={!canEdit || planned}
                  label={m.name.de}
                />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{m.name.de}</h3>
              <p className="mt-1 flex-1 text-sm leading-6 text-fog-300">{m.description.de}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="chip bg-ink-800 text-fog-500">{CATEGORY_LABELS[m.category].de}</span>
                {planned ? (
                  <span className="chip bg-sun-400/15 text-sun-400">Kommt in Modul {m.order}</span>
                ) : enabled ? (
                  <span className="chip bg-sea-500/15 text-sea-400">Aktiv</span>
                ) : (
                  <span className="chip bg-ink-800 text-fog-500">Aus</span>
                )}
                {m.hasSettings && !planned && (
                  <Link href={`/g/${guildId}/${m.id}`} className="ml-auto text-sm font-semibold text-coral-400 hover:text-coral-500">
                    Einstellungen →
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-bold tracking-[0.15em] text-fog-500 uppercase">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-fog-500">{hint}</p>
    </div>
  );
}
