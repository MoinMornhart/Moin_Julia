import { z } from 'zod';
import { messageTemplateSchema } from './message.js';
import { imageSourceSchema } from './upload.js';

const snowflake = z.string().regex(/^\d{15,22}$/);

export const CARD_STYLES = ['hafen', 'koralle', 'mint', 'nacht'] as const;
export type CardStyle = (typeof CARD_STYLES)[number];

export const willkommenConfigSchema = z.object({
  welcome: z
    .object({
      enabled: z.boolean().default(false),
      channelId: snowflake.nullable().default(null),
      template: messageTemplateSchema.prefault({
        content: '{user}',
        embed: {
          title: 'Willkommen auf {server}! 👋',
          description: 'Schön, dass du da bist, **{user.name}**! Du bist Mitglied Nr. **{memberCount}**.\nSchau dich in Ruhe um und lies kurz die Regeln.',
          thumbnail: 'none',
        },
      }),
      card: z
        .object({
          enabled: z.boolean().default(true),
          style: z.enum(CARD_STYLES).default('hafen'),
          headline: z.string().max(40).default('WILLKOMMEN'),
          subline: z.string().max(60).default('Mitglied #{memberCount}'),
          /** Eigenes Hintergrundbild (https-Link oder hochgeladen, wird abgedunkelt) */
          backgroundUrl: imageSourceSchema.default(''),
        })
        .prefault({}),
    })
    .prefault({}),
  leave: z
    .object({
      enabled: z.boolean().default(false),
      channelId: snowflake.nullable().default(null),
      template: messageTemplateSchema.prefault({
        embed: { color: '#8c96ba', description: '**{user.tag}** hat den Server verlassen. Jetzt sind wir noch {memberCount}.', thumbnail: 'user' },
      }),
    })
    .prefault({}),
  dm: z
    .object({
      enabled: z.boolean().default(false),
      template: messageTemplateSchema.prefault({
        content: 'Moin {user.name}! 👋 Schön, dass du auf **{server}** bist. Bei Fragen meld dich einfach beim Team.',
        embed: { enabled: false },
      }),
    })
    .prefault({}),
  autoRoles: z
    .object({
      humans: z.array(snowflake).max(10).default([]),
      bots: z.array(snowflake).max(10).default([]),
    })
    .prefault({}),
});

export type WillkommenConfig = z.infer<typeof willkommenConfigSchema>;

export function parseWillkommenConfig(raw: unknown): WillkommenConfig {
  const result = willkommenConfigSchema.safeParse(raw ?? {});
  return result.success ? result.data : willkommenConfigSchema.parse({});
}

// ── Rollen-Panels (eigene Tabelle RolePanel) ────────────────────────────────

export const rolePanelSchema = z.object({
  name: z.string().min(1).max(60),
  channelId: snowflake.nullable().default(null),
  style: z.enum(['buttons', 'select']).default('buttons'),
  /** multi = beliebig viele, single = nur eine Rolle aus diesem Panel */
  mode: z.enum(['multi', 'single']).default('multi'),
  template: messageTemplateSchema.prefault({ embed: { title: 'Rollen wählen', description: 'Klick auf einen Button, um die Rolle zu bekommen oder wieder abzugeben.' } }),
  roles: z
    .array(
      z.object({
        roleId: snowflake,
        label: z.string().min(1).max(80),
        emoji: z.string().max(40).default(''),
        description: z.string().max(100).default(''),
      }),
    )
    .min(1)
    .max(25),
});

export type RolePanelData = z.infer<typeof rolePanelSchema>;
