import { z } from 'zod';

/**
 * Wartungsmodus (Wunsch Philip, 13.10.): Bot und Webseite vorübergehend „offline“ nehmen.
 * Webseite: alle außer dem Instanz-Admin sehen eine Wartungsseite (er braucht Zugang zum Ausschalten).
 * Bot: erscheint offline, Befehle antworten mit „Wartung“, Julia/Musik/Runden pausieren –
 * Schutzfunktionen (Server-Schutz, Moderation, Owner-Bereich) laufen sicherheitshalber weiter.
 */
export const maintenanceSchema = z.object({
  on: z.boolean().default(false),
  /** Optionaler Text, z. B. „Bin um 20 Uhr wieder da“ */
  message: z.string().trim().max(300).default(''),
  /** Seit wann (ms) */
  since: z.number().int().min(0).default(0),
  /** Test-Server (Wunsch Philip, 13.10.): hier läuft der Bot in der Wartung ganz normal weiter */
  testGuildIds: z.array(z.string().regex(/^\d{15,22}$/)).max(25).default([]),
});
export type Maintenance = z.infer<typeof maintenanceSchema>;

export function parseMaintenance(raw: string | null | undefined): Maintenance {
  try {
    const parsed = maintenanceSchema.safeParse(raw ? JSON.parse(raw) : {});
    return parsed.success ? parsed.data : maintenanceSchema.parse({});
  } catch {
    return maintenanceSchema.parse({});
  }
}

/** Ist dieser Server in der Wartung pausiert? (Test-Server nie) */
export function maintenancePauses(m: Maintenance, guildId: string | null | undefined): boolean {
  return m.on && !(guildId && m.testGuildIds.includes(guildId));
}

/** Diese Module laufen auch in der Wartung weiter (Sicherheit) */
export const MAINTENANCE_KEEP_MODULES: readonly string[] = ['schutz', 'moderation', 'owner', 'kern'];
