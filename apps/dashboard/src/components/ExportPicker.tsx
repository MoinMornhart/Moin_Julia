'use client';

import { useState } from 'react';

export interface ExportModule {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
}

/** Export: alles oder nur ausgewählte Module (+ Rollen-Panels) als Vorlage-Datei */
export function ExportPicker({ guildId, modules, panelCount }: { guildId: string; modules: ExportModule[]; panelCount: number }) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(modules.map((m) => m.id)));
  const [panels, setPanels] = useState(panelCount > 0);
  const all = picked.size === modules.length;

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const query = new URLSearchParams();
  if (!all) for (const id of picked) query.append('modul', id);
  query.set('panels', panels ? '1' : '0');
  const href = `/g/${guildId}/vorlagen/export?${query}`;
  const nothing = picked.size === 0 && !panels;

  if (!modules.length) return <p className="text-sm text-fog-500">Noch keine Modul-Einstellungen gespeichert – es gibt nichts zu exportieren.</p>;

  return (
    <div className="grid gap-4">
      <fieldset className="grid min-w-0 gap-2">
        <legend className="mb-2 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold">Was soll in die Datei?</span>
          <button type="button" className="text-coral-400 underline-offset-2 hover:underline" onClick={() => setPicked(new Set(modules.map((m) => m.id)))}>
            alle
          </button>
          <button type="button" className="text-coral-400 underline-offset-2 hover:underline" onClick={() => setPicked(new Set())}>
            keine
          </button>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {modules.map((m) => (
            <label key={m.id} className="flex items-center gap-2 rounded-lg border border-ink-700 px-3 py-2 text-sm">
              <input type="checkbox" checked={picked.has(m.id)} onChange={() => toggle(m.id)} className="size-4 accent-coral-500" />
              <span aria-hidden>{m.icon}</span>
              <span className="min-w-0 flex-1 truncate">{m.name}</span>
              {!m.enabled && <span className="text-xs text-fog-500">aus</span>}
            </label>
          ))}
        </div>
        {panelCount > 0 && (
          <label className="mt-1 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={panels} onChange={(e) => setPanels(e.target.checked)} className="size-4 accent-coral-500" />
            Rollen-Panels mitnehmen ({panelCount})
          </label>
        )}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        {nothing ? (
          <span className="btn-primary w-fit cursor-not-allowed opacity-50" aria-disabled="true">
            ⬇ Vorlage herunterladen
          </span>
        ) : (
          <a href={href} className="btn-primary w-fit" download>
            ⬇ {all ? 'Alles herunterladen' : `${picked.size} ${picked.size === 1 ? 'Modul' : 'Module'} herunterladen`}
          </a>
        )}
        <span className="text-xs text-fog-500">Tipp: Auf jeder Modul-Seite gibt es oben auch „Exportieren“ nur für dieses Modul.</span>
      </div>
    </div>
  );
}
