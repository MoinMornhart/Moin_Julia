import 'server-only';
import { revalidatePath } from 'next/cache';
import { getModule, type ModuleMeta } from '@moin/shared';
import { db } from './db';
import { publishConfig } from './redis';

export interface ModuleRow {
  meta: ModuleMeta;
  enabled: boolean;
  config: unknown;
}

/** Zustand eines Moduls auf einem Server (Standardwerte, wenn noch nie gespeichert). */
export async function getModuleRow(guildId: string, moduleId: string): Promise<ModuleRow> {
  const meta = getModule(moduleId);
  if (!meta) throw new Error(`Unbekanntes Modul: ${moduleId}`);
  const row = await db().guildModule.findUnique({ where: { guildId_moduleId: { guildId, moduleId } } });
  return { meta, enabled: row?.enabled ?? meta.defaultEnabled, config: row?.config ?? {} };
}

/** Speichert die Einstellungen eines Moduls und meldet sie dem Bot. Der An/Aus-Zustand bleibt unverändert. */
export async function saveModuleConfig(guildId: string, moduleId: string, config: object, userId: string): Promise<boolean> {
  const meta = getModule(moduleId);
  if (!meta) throw new Error(`Unbekanntes Modul: ${moduleId}`);
  await db().guildModule.upsert({
    where: { guildId_moduleId: { guildId, moduleId } },
    create: { guildId, moduleId, enabled: meta.defaultEnabled, config, updatedBy: userId },
    update: { config, updatedBy: userId },
  });
  const delivered = await publishConfig({ type: 'module-config', guildId, moduleId });
  revalidatePath(`/g/${guildId}/${moduleId}`);
  return delivered;
}

/** Formular-Helfer */
export function formString(form: FormData, key: string): string | null {
  const value = form.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function formBool(form: FormData, key: string): boolean {
  return form.get(key) === 'on';
}

export function formIds(form: FormData, key: string): string[] {
  return form.getAll(key).filter((v): v is string => typeof v === 'string' && /^\d+$/.test(v));
}
