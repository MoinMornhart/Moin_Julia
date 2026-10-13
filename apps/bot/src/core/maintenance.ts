import { MAINTENANCE_KEEP_MODULES, type Maintenance } from '@moin/shared';

/** Aktueller Wartungsmodus (aus den Instanz-Einstellungen, siehe index.ts) */
let current: Maintenance = { on: false, message: '', since: 0 };

export function setMaintenance(m: Maintenance): void {
  current = m;
}
export function getMaintenance(): Maintenance {
  return current;
}
export function isMaintenance(): boolean {
  return current.on;
}
/** Ist dieses Modul gerade pausiert? (Schutzfunktionen nie) */
export function pausedByMaintenance(moduleId: string): boolean {
  return current.on && !MAINTENANCE_KEEP_MODULES.includes(moduleId);
}
