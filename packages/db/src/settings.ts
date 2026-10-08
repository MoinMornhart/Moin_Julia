import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from './generated/prisma/client.js';

/**
 * Instanz-Einstellungen: zuerst aus der Datenbank (Einrichtungs-Assistent), sonst aus der .env.
 * So funktionieren sowohl die Einrichtung über die Webseite als auch klassische .env-Installationen.
 */
export const SETTINGS = {
  discordToken: { env: 'DISCORD_TOKEN', secret: true },
  discordClientId: { env: 'DISCORD_CLIENT_ID', secret: false },
  discordClientSecret: { env: 'DISCORD_CLIENT_SECRET', secret: true },
  dashboardUrl: { env: 'DASHBOARD_URL', secret: false },
  anthropicApiKey: { env: 'ANTHROPIC_API_KEY', secret: true },
  /** Ollama (lokale KI ohne Schlüssel), z. B. http://192.168.1.20:11434 */
  ollamaUrl: { env: 'OLLAMA_URL', secret: false },
  ollamaModel: { env: 'OLLAMA_MODEL', secret: false },
  twitchClientId: { env: 'TWITCH_CLIENT_ID', secret: false },
  twitchClientSecret: { env: 'TWITCH_CLIENT_SECRET', secret: true },
  kickClientId: { env: 'KICK_CLIENT_ID', secret: false },
  kickClientSecret: { env: 'KICK_CLIENT_SECRET', secret: true },
  youtubeApiKey: { env: 'YOUTUBE_API_KEY', secret: true },
  /** Discord-User-ID der Person, die die Einrichtung abgeschlossen hat (darf /system öffnen) */
  instanceOwnerId: { env: 'INSTANCE_OWNER_ID', secret: false },
  /** Status + Aktivität des Bots als JSON (System → Bot-Profil), siehe presenceSchema */
  botPresence: { env: 'BOT_PRESENCE', secret: false },
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type AppSettings = Record<SettingKey, string | null>;

function encryptionKey(): Buffer {
  const material = process.env.SECRETS_KEY || process.env.POSTGRES_PASSWORD || process.env.DATABASE_URL;
  if (!material) throw new Error('SECRETS_KEY (oder POSTGRES_PASSWORD) fehlt – Geheimnisse können nicht verschlüsselt werden.');
  return createHash('sha256').update(`moin-julia:${material}`).digest();
}

/** AES-256-GCM: „v1:<iv>:<tag>:<daten>“ (Base64) */
export function encryptSecret(plain: string, key = encryptionKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decryptSecret(stored: string, key = encryptionKey()): string {
  const [version, iv, tag, data] = stored.split(':');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unbekanntes Format eines gespeicherten Geheimnisses.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

/** Alle Einstellungen (DB vor .env). Nicht entschlüsselbare Werte gelten als nicht gesetzt. */
export async function loadSettings(prisma: PrismaClient): Promise<AppSettings> {
  const rows = await prisma.appSetting.findMany();
  const fromDb = new Map(rows.map((r) => [r.key, r]));
  const result = {} as AppSettings;
  for (const [key, def] of Object.entries(SETTINGS) as [SettingKey, (typeof SETTINGS)[SettingKey]][]) {
    const row = fromDb.get(key);
    let value: string | null = null;
    if (row) {
      try {
        value = row.secret ? decryptSecret(row.value) : row.value;
      } catch {
        value = null;
      }
    }
    result[key] = value || process.env[def.env] || null;
  }
  return result;
}

/** Speichert Einstellungen. `null` oder leerer Text löscht den DB-Wert (dann gilt wieder die .env). */
export async function saveSettings(prisma: PrismaClient, values: Partial<AppSettings>): Promise<void> {
  const operations = [];
  for (const [key, value] of Object.entries(values) as [SettingKey, string | null | undefined][]) {
    if (value === undefined) continue;
    const secret = SETTINGS[key].secret;
    if (value === null || value.trim() === '') {
      operations.push(prisma.appSetting.deleteMany({ where: { key } }));
    } else {
      const stored = secret ? encryptSecret(value.trim()) : value.trim();
      operations.push(prisma.appSetting.upsert({ where: { key }, create: { key, value: stored, secret }, update: { value: stored, secret } }));
    }
  }
  await prisma.$transaction(operations);
}

/** Ist der Bot startklar? (Discord-Token, Application-ID und Client-Secret vorhanden) */
export function isSetupComplete(s: AppSettings): boolean {
  return Boolean(s.discordToken && s.discordClientId && s.discordClientSecret);
}

/** Für Anzeigen: „••••••abcd“ */
export function maskSecret(value: string | null): string | null {
  if (!value) return null;
  return `••••••${value.slice(-4)}`;
}
