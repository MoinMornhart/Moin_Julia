import { z } from 'zod';
import type { Locale } from '../i18n.js';

/** Kategorien des Logging-Moduls – jede lässt sich einzeln schalten und in einen eigenen Kanal leiten. */
export const LOG_CATEGORIES = ['messages', 'members', 'memberUpdates', 'moderation', 'channels', 'roles', 'voice', 'server'] as const;
export type LogCategory = (typeof LOG_CATEGORIES)[number];

export const LOG_CATEGORY_INFO: Record<LogCategory, { icon: string; name: Record<Locale, string>; description: Record<Locale, string> }> = {
  messages: {
    icon: '💬',
    name: { de: 'Nachrichten', en: 'Messages' },
    description: { de: 'Gelöschte und bearbeitete Nachrichten, Massenlöschungen', en: 'Deleted and edited messages, bulk deletes' },
  },
  members: {
    icon: '🚪',
    name: { de: 'Beitritte & Austritte', en: 'Joins & leaves' },
    description: { de: 'Wer kommt und geht – mit Account-Alter', en: 'Who joins and leaves – with account age' },
  },
  memberUpdates: {
    icon: '🏷️',
    name: { de: 'Mitglieder-Änderungen', en: 'Member updates' },
    description: { de: 'Rollen vergeben/entzogen, Nickname geändert, Timeouts', en: 'Roles added/removed, nickname changes, timeouts' },
  },
  moderation: {
    icon: '🔨',
    name: { de: 'Bans & Kicks', en: 'Bans & kicks' },
    description: { de: 'Bans, Entbannungen und Kicks mit Grund und Moderator', en: 'Bans, unbans and kicks with reason and moderator' },
  },
  channels: {
    icon: '#️⃣',
    name: { de: 'Kanäle', en: 'Channels' },
    description: { de: 'Kanäle erstellt, gelöscht oder geändert', en: 'Channels created, deleted or changed' },
  },
  roles: {
    icon: '🎭',
    name: { de: 'Rollen', en: 'Roles' },
    description: { de: 'Rollen erstellt, gelöscht oder geändert', en: 'Roles created, deleted or changed' },
  },
  voice: {
    icon: '🔊',
    name: { de: 'Sprachkanäle', en: 'Voice' },
    description: { de: 'Beitreten, Verlassen und Wechseln von Sprachkanälen', en: 'Joining, leaving and switching voice channels' },
  },
  server: {
    icon: '🏠',
    name: { de: 'Server & Einladungen', en: 'Server & invites' },
    description: { de: 'Servername/-bild geändert, Einladungen erstellt/gelöscht', en: 'Server name/icon changed, invites created/deleted' },
  },
};

const snowflake = z.string().regex(/^\d{15,22}$/);

const categorySchema = z.object({
  enabled: z.boolean().default(true),
  /** Eigener Kanal für diese Kategorie; null = Standard-Kanal */
  channelId: snowflake.nullable().default(null),
});

const category = categorySchema.prefault({});
const categoriesShape = {
  messages: category,
  members: category,
  memberUpdates: category,
  moderation: category,
  channels: category,
  roles: category,
  voice: category,
  server: category,
} satisfies Record<LogCategory, typeof category>;

export const loggingConfigSchema = z.object({
  /** Kanal für alle Kategorien ohne eigenen Kanal */
  defaultChannelId: snowflake.nullable().default(null),
  categories: z.object(categoriesShape).prefault({}),
  /** Nachrichten-Ereignisse aus diesen Kanälen werden nicht geloggt */
  ignoredChannelIds: z.array(snowflake).max(100).default([]),
  /** Nachrichten von Bots ignorieren */
  ignoreBots: z.boolean().default(true),
});

export type LoggingConfig = z.infer<typeof loggingConfigSchema>;

/** Liest eine gespeicherte Konfiguration; Unbekanntes/Kaputtes fällt auf Standardwerte zurück. */
export function parseLoggingConfig(raw: unknown): LoggingConfig {
  const result = loggingConfigSchema.safeParse(raw ?? {});
  return result.success ? result.data : loggingConfigSchema.parse({});
}

/** Zielkanal einer Kategorie oder null, wenn sie aus ist bzw. kein Kanal gesetzt ist. */
export function logTarget(config: LoggingConfig, category: LogCategory): string | null {
  const entry = config.categories[category];
  if (!entry.enabled) return null;
  return entry.channelId ?? config.defaultChannelId;
}
