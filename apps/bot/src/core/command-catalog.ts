import type { BotModule } from './types.js';

/**
 * Befehls-Übersicht (Wunsch Philip, 13.10.): alle Slash-Befehle als einfache Liste fürs Dashboard.
 * Wird aus den echten Befehls-Definitionen erzeugt (Test `command-catalog.test.ts` hält die Datei
 * packages/shared/src/commands.catalog.ts aktuell) – so kann die Übersicht nie veralten.
 */
export interface CatalogOption {
  name: string;
  description: string;
  required: boolean;
}
export interface CatalogEntry {
  /** z. B. „musik play“ */
  name: string;
  module: string;
  description: string;
  /** Nötiges Discord-Recht (Bitfeld als Text) oder null = alle */
  permissions: string | null;
  options: CatalogOption[];
}

type RawOption = { type: number; name: string; description: string; required?: boolean; options?: RawOption[] };

export function buildCommandCatalog(modules: readonly BotModule[]): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  for (const module of modules) {
    for (const command of module.commands ?? []) {
      const data = command.data as { name: string; description: string; default_member_permissions?: string | null; options?: RawOption[] };
      const permissions = data.default_member_permissions ?? null;
      const leaf = (name: string, description: string, options: RawOption[] = []) =>
        out.push({ name, module: module.id, description, permissions, options: options.filter((o) => o.type > 2).map((o) => ({ name: o.name, description: o.description, required: !!o.required })) });
      const subs = (data.options ?? []).filter((o) => o.type === 1 || o.type === 2);
      if (!subs.length) {
        leaf(data.name, data.description, data.options);
        continue;
      }
      for (const sub of subs) {
        if (sub.type === 1) leaf(`${data.name} ${sub.name}`, sub.description, sub.options);
        else for (const inner of sub.options ?? []) leaf(`${data.name} ${sub.name} ${inner.name}`, inner.description, inner.options);
      }
    }
  }
  return out.sort((a, b) => a.module.localeCompare(b.module) || a.name.localeCompare(b.name));
}
