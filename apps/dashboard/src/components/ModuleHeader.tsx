import { CATEGORY_LABELS, type ModuleMeta } from '@moin/shared';
import { ModuleToggle } from './ModuleToggle';

/** Kopf einer Modul-Seite: Icon, Name, Beschreibung und An/Aus-Schalter. */
export function ModuleHeader({
  guildId,
  meta,
  enabled,
  canEdit,
}: {
  guildId: string;
  meta: ModuleMeta;
  enabled: boolean;
  canEdit: boolean;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
      <div className="flex items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-ink-800 text-3xl" aria-hidden>
          {meta.icon}
        </span>
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-fog-500 uppercase">{CATEGORY_LABELS[meta.category].de}</p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">{meta.name.de}</h1>
          <p className="mt-2 max-w-2xl text-fog-300">{meta.description.de}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 px-4 py-3">
        <span className={`text-sm font-semibold ${enabled ? 'text-sea-400' : 'text-fog-500'}`}>{enabled ? 'Aktiv' : 'Aus'}</span>
        <ModuleToggle guildId={guildId} moduleId={meta.id} enabled={enabled} disabled={!canEdit} label={meta.name.de} />
      </div>
    </div>
  );
}
