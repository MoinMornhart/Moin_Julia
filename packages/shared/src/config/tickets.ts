import { z } from 'zod';
import { messageTemplateSchema } from './message.js';

const snowflake = z.string().regex(/^\d{15,22}$/);

/** Formular-Frage beim Öffnen (Discord erlaubt höchstens 5 Felder pro Formular) */
export const ticketQuestionSchema = z.object({
  label: z.string().trim().min(1).max(45),
  placeholder: z.string().max(100).default(''),
  required: z.boolean().default(true),
  /** mehrzeilig */
  long: z.boolean().default(false),
});

/** Ticket-Grund (Knopf bzw. Menü-Eintrag im Panel) */
export const ticketReasonSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{1,12}$/),
  label: z.string().trim().min(1).max(80),
  emoji: z.string().max(40).default(''),
  description: z.string().max(100).default(''),
  questions: z.array(ticketQuestionSchema).max(5).default([]),
  /** eigene Kategorie für diesen Grund (leer = Standard aus den Einstellungen) */
  categoryId: snowflake.nullable().default(null),
  /** zusätzliche Team-Rollen nur für diesen Grund */
  teamRoleIds: z.array(snowflake).max(10).default([]),
});

export const ticketPanelSchema = z.object({
  name: z.string().trim().min(1).max(60),
  channelId: snowflake.nullable().default(null),
  style: z.enum(['buttons', 'select']).default('buttons'),
  template: messageTemplateSchema.prefault({
    embed: { title: '🎫 Support', description: 'Du brauchst Hilfe? Wähl unten einen Grund – es öffnet sich ein privater Kanal mit dem Team.' },
  }),
  reasons: z.array(ticketReasonSchema).min(1).max(10),
});

export const ticketsConfigSchema = z.object({
  /** Team-Rollen: sehen alle Tickets, dürfen übernehmen und schließen */
  teamRoleIds: z.array(snowflake).max(10).default([]),
  /** Kategorie für Ticket-Kanäle */
  categoryId: snowflake.nullable().default(null),
  /** Log-Kanal: Öffnen/Schließen + Transcript */
  logChannelId: snowflake.nullable().default(null),
  /** {nr} = Ticket-Nummer, {user} = Name */
  nameTemplate: z.string().trim().min(1).max(90).default('ticket-{nr}'),
  maxOpenPerUser: z.number().int().min(1).max(10).default(1),
  pingTeam: z.boolean().default(true),
  welcomeText: z.string().max(1000).default('Danke {user}! Das Team meldet sich so schnell wie möglich. Beschreib dein Anliegen gern schon genauer.'),
  /** Transcript per DM an die Person, die das Ticket geöffnet hat */
  transcriptDm: z.boolean().default(true),
  /** Nach dem Schließen um eine Bewertung (1–5 Sterne) bitten */
  feedback: z.boolean().default(true),
  autoClose: z
    .object({
      enabled: z.boolean().default(false),
      /** ohne neue Nachricht so viele Stunden → automatisch schließen */
      hours: z.number().int().min(1).max(720).default(48),
    })
    .prefault({}),
  /** Wie lange der Kanal nach dem Schließen noch bleibt (Sekunden) */
  deleteAfterSec: z.number().int().min(0).max(300).default(10),
});

export type TicketQuestion = z.infer<typeof ticketQuestionSchema>;
export type TicketReason = z.infer<typeof ticketReasonSchema>;
export type TicketPanelData = z.infer<typeof ticketPanelSchema>;
export type TicketsConfig = z.infer<typeof ticketsConfigSchema>;

export function parseTicketsConfig(raw: unknown): TicketsConfig {
  const parsed = ticketsConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : ticketsConfigSchema.parse({});
}

/** Kanalname: Discord erlaubt nur Kleinbuchstaben, Ziffern, - und _ (max. 100) */
export function ticketChannelName(template: string, ctx: { nr: number; user: string }): string {
  const raw = template.replaceAll('{nr}', String(ctx.nr).padStart(4, '0')).replaceAll('{user}', ctx.user);
  const clean = raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (clean || `ticket-${ctx.nr}`).slice(0, 100);
}

/** IDs für neue Gründe: kurz, aus Kleinbuchstaben/Ziffern */
export function newReasonId(existing: string[]): string {
  for (let i = 1; i < 1000; i++) {
    const id = `g${i}`;
    if (!existing.includes(id)) return id;
  }
  return `g${Date.now() % 100000}`;
}
