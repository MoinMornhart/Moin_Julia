import { z } from 'zod';
import { imageSourceSchema } from './upload.js';

/**
 * Nachrichten-Vorlage aus dem Embed-Builder – genutzt von allen Modulen, die Nachrichten senden
 * (Willkommen, Abschied, Rollen-Panels, später Tickets, Alerts …).
 */
export const messageTemplateSchema = z.object({
  content: z.string().max(2000).default(''),
  embed: z
    .object({
      enabled: z.boolean().default(true),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ff7a59'),
      title: z.string().max(256).default(''),
      description: z.string().max(4096).default(''),
      /** Kleines Bild oben rechts */
      thumbnail: z.enum(['none', 'user', 'server']).default('none'),
      /** Großes Bild unten (https-Link oder hochgeladenes Bild „upload:<id>“) */
      imageUrl: imageSourceSchema.default(''),
      footer: z.string().max(2048).default(''),
      fields: z
        .array(z.object({ name: z.string().min(1).max(256), value: z.string().min(1).max(1024), inline: z.boolean().default(false) }))
        .max(10)
        .default([]),
      timestamp: z.boolean().default(false),
    })
    .prefault({}),
});

export type MessageTemplate = z.infer<typeof messageTemplateSchema>;

/** Platzhalter, die im Embed-Builder angeboten werden */
export const TEMPLATE_VARIABLES = [
  { key: '{user}', description: 'Erwähnung (@Name, pingt)' },
  { key: '{user.name}', description: 'Anzeigename' },
  { key: '{user.tag}', description: 'Benutzername' },
  { key: '{user.id}', description: 'User-ID' },
  { key: '{server}', description: 'Servername' },
  { key: '{memberCount}', description: 'Mitgliederzahl' },
  { key: '{humanCount}', description: 'Mitglieder ohne Bots' },
  { key: '{botCount}', description: 'Anzahl Bots' },
] as const;

export interface TemplateContext {
  userId: string;
  userName: string;
  userTag: string;
  userAvatarUrl: string | null;
  serverName: string;
  serverIconUrl: string | null;
  memberCount: number;
  /** Mitglieder ohne Bots (Standard: memberCount) */
  humanCount?: number;
  botCount?: number;
}

export function fillVariables(text: string, ctx: TemplateContext): string {
  const values: Record<string, string> = {
    '{user}': `<@${ctx.userId}>`,
    '{user.name}': ctx.userName,
    '{user.tag}': ctx.userTag,
    '{user.id}': ctx.userId,
    '{server}': ctx.serverName,
    '{memberCount}': ctx.memberCount.toLocaleString('de-DE'),
    '{humanCount}': (ctx.humanCount ?? ctx.memberCount).toLocaleString('de-DE'),
    '{botCount}': (ctx.botCount ?? 0).toLocaleString('de-DE'),
  };
  return text.replace(/\{(user(?:\.(?:name|tag|id))?|server|memberCount|humanCount|botCount)\}/g, (match) => values[match] ?? match);
}

/** Ein Embed in der Form, die die Discord-API erwartet (ohne discord.js-Abhängigkeit). */
export interface RenderedEmbed {
  color: number;
  title?: string;
  description?: string;
  thumbnail?: { url: string };
  image?: { url: string };
  footer?: { text: string };
  fields?: { name: string; value: string; inline: boolean }[];
  timestamp?: string;
}

/** Vorlage + Platzhalter → fertige Nachricht. Leere Embeds werden weggelassen. */
export function renderTemplate(template: MessageTemplate, ctx: TemplateContext, now = new Date()): { content: string; embed: RenderedEmbed | null } {
  const content = fillVariables(template.content, ctx).slice(0, 2000);
  const e = template.embed;
  if (!e.enabled) return { content, embed: null };
  const thumb = e.thumbnail === 'user' ? ctx.userAvatarUrl : e.thumbnail === 'server' ? ctx.serverIconUrl : null;
  const embed: RenderedEmbed = { color: Number.parseInt(e.color.slice(1), 16) };
  if (e.title) embed.title = fillVariables(e.title, ctx).slice(0, 256);
  if (e.description) embed.description = fillVariables(e.description, ctx).slice(0, 4096);
  if (thumb) embed.thumbnail = { url: thumb };
  if (e.imageUrl) embed.image = { url: e.imageUrl };
  if (e.footer) embed.footer = { text: fillVariables(e.footer, ctx).slice(0, 2048) };
  if (e.fields.length) embed.fields = e.fields.map((f) => ({ name: fillVariables(f.name, ctx), value: fillVariables(f.value, ctx), inline: f.inline }));
  if (e.timestamp) embed.timestamp = now.toISOString();
  const empty = !embed.title && !embed.description && !embed.fields && !embed.image && !embed.footer;
  return { content, embed: empty ? null : embed };
}

/** Beispiel-Kontext für Vorschauen im Dashboard */
export const PREVIEW_CONTEXT: TemplateContext = {
  userId: '100000000000000201',
  userName: 'Anna',
  userTag: 'anna.streamt',
  userAvatarUrl: null,
  serverName: 'Moin Demo-Server',
  serverIconUrl: null,
  memberCount: 1284,
};
