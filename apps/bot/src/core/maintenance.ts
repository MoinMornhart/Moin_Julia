import { MAINTENANCE_KEEP_MODULES, maintenancePauses, type Maintenance } from '@moin/shared';

/** Aktueller Wartungsmodus (aus den Instanz-Einstellungen, siehe index.ts) */
let current: Maintenance = { on: false, message: '', since: 0, testGuildIds: [] };

export function setMaintenance(m: Maintenance): void {
  current = m;
}
export function getMaintenance(): Maintenance {
  return current;
}
export function isMaintenance(): boolean {
  return current.on;
}
/** Ist dieses Modul gerade pausiert? (Schutzfunktionen nie; auf Test-Servern auch nicht) */
export function pausedByMaintenance(moduleId: string, guildId?: string | null): boolean {
  return maintenancePauses(current, guildId) && !MAINTENANCE_KEEP_MODULES.includes(moduleId);
}

/** Läuft der Bot auf diesem Server trotz Wartung normal? (Test-Server) */
export function isTestGuild(guildId: string): boolean {
  return current.on && current.testGuildIds.includes(guildId);
}
