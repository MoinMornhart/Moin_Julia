import type { PrismaClient } from './generated/prisma/client.js';
import { decryptSecret, encryptSecret } from './settings.js';

/**
 * Eigene Schlüssel pro Server: Jeder Server kann seinen eigenen KI-Schlüssel eintragen
 * (zahlt dann selbst). Ohne eigenen Schlüssel gilt – nur bei Claude – der Schlüssel der Instanz.
 * Gespeichert verschlüsselt, ins Dashboard kommt nur die maskierte Form.
 */
export const GUILD_SECRET_KEYS = [
  'anthropicApiKey',
  'geminiApiKey',
  'openaiApiKey',
  'openrouterApiKey',
  'groqApiKey',
  'mistralApiKey',
  'xaiApiKey',
  'customApiKey',
  // Eigene Twitch-/Kick-Zugangsdaten eines Servers (sonst die der Instanz)
  'twitchClientId',
  'twitchClientSecret',
  'kickClientId',
  'kickClientSecret',
] as const;
export type GuildSecretKey = (typeof GUILD_SECRET_KEYS)[number];
export type GuildSecrets = Record<GuildSecretKey, string | null>;

export function isGuildSecretKey(key: string): key is GuildSecretKey {
  return (GUILD_SECRET_KEYS as readonly string[]).includes(key);
}

/** Alle Schlüssel eines Servers (nicht entschlüsselbare gelten als nicht gesetzt) */
export async function loadGuildSecrets(prisma: PrismaClient, guildId: string): Promise<GuildSecrets> {
  const rows = await prisma.guildSecret.findMany({ where: { guildId } });
  const result = Object.fromEntries(GUILD_SECRET_KEYS.map((k) => [k, null])) as GuildSecrets;
  for (const row of rows) {
    if (!isGuildSecretKey(row.key)) continue;
    try {
      result[row.key] = decryptSecret(row.value) || null;
    } catch {
      result[row.key] = null;
    }
  }
  return result;
}

/** Schlüssel speichern; `null`/leer löscht ihn */
export async function saveGuildSecret(prisma: PrismaClient, guildId: string, key: GuildSecretKey, value: string | null, userId?: string): Promise<void> {
  const v = value?.trim();
  if (!v) {
    await prisma.guildSecret.deleteMany({ where: { guildId, key } });
    return;
  }
  const stored = encryptSecret(v);
  await prisma.guildSecret.upsert({
    where: { guildId_key: { guildId, key } },
    create: { guildId, key, value: stored, updatedBy: userId ?? null },
    update: { value: stored, updatedBy: userId ?? null },
  });
}
