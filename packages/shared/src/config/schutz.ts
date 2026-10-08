import { z } from 'zod';

const snowflake = z.string().regex(/^\d{15,22}$/);

/** Was Anti-Nuke beobachtet (jeweils gezählt pro auslösender Person) */
export const NUKE_KINDS = ['channelDelete', 'roleDelete', 'ban', 'kick', 'webhookCreate', 'adminGrant'] as const;
export type NukeKind = (typeof NUKE_KINDS)[number];

export const schutzConfigSchema = z.object({
  /** Kanal für Schutz-Alarme (Raid, Nuke, verdächtige Accounts) */
  alertChannelId: snowflake.nullable().default(null),
  /** Rolle, die bei Alarmen angepingt wird (z. B. Moderatoren) */
  alertRoleId: snowflake.nullable().default(null),

  antiRaid: z
    .object({
      enabled: z.boolean().default(false),
      joins: z.number().int().min(3).max(100).default(10),
      seconds: z.number().int().min(3).max(300).default(10),
      /** pause = Einladungen pausieren; pause_kick = zusätzlich alle Neuen während des Raids kicken */
      action: z.enum(['pause', 'pause_kick']).default('pause'),
      durationMin: z.number().int().min(1).max(1440).default(15),
    })
    .prefault({}),

  antiNuke: z
    .object({
      enabled: z.boolean().default(false),
      /** So viele gleichartige Aktionen … */
      threshold: z.number().int().min(1).max(50).default(3),
      /** … in so vielen Sekunden lösen aus */
      seconds: z.number().int().min(3).max(600).default(15),
      punishment: z.enum(['strip_roles', 'kick', 'ban']).default('strip_roles'),
      watch: z
        .object({
          channelDelete: z.boolean().default(true),
          roleDelete: z.boolean().default(true),
          ban: z.boolean().default(true),
          kick: z.boolean().default(true),
          webhookCreate: z.boolean().default(true),
          adminGrant: z.boolean().default(true),
        })
        .prefault({}),
      whitelistUserIds: z.array(snowflake).max(25).default([]),
      whitelistRoleIds: z.array(snowflake).max(25).default([]),
    })
    .prefault({}),

  verification: z
    .object({
      enabled: z.boolean().default(false),
      /** Diese Rolle bekommt man nach der Verifizierung */
      roleId: snowflake.nullable().default(null),
      /** Kanal, in den das Panel gesendet wird */
      channelId: snowflake.nullable().default(null),
      mode: z.enum(['button', 'captcha']).default('button'),
      title: z.string().min(1).max(100).default('Willkommen! 👋'),
      message: z
        .string()
        .min(1)
        .max(1500)
        .default('Bitte bestätige kurz, dass du ein Mensch bist – danach siehst du alle Kanäle.'),
    })
    .prefault({}),

  accountAge: z
    .object({
      enabled: z.boolean().default(false),
      minDays: z.number().int().min(1).max(365).default(7),
      action: z.enum(['alert', 'timeout', 'kick']).default('alert'),
    })
    .prefault({}),
});

export type SchutzConfig = z.infer<typeof schutzConfigSchema>;

export function parseSchutzConfig(raw: unknown): SchutzConfig {
  const result = schutzConfigSchema.safeParse(raw ?? {});
  return result.success ? result.data : schutzConfigSchema.parse({});
}

/** Redis-Schlüssel für einen laufenden Raid-Modus (Wert: Ende als ISO-Zeit) */
export function raidKey(guildId: string): string {
  return `moin:raid:${guildId}`;
}
