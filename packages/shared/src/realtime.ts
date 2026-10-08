/** Redis-Pub/Sub-Kanal: Dashboard → Bot, damit Änderungen ohne Neustart greifen. */
export const CONFIG_CHANNEL = 'moin:config';

/** Redis-Key, unter dem der Bot regelmäßig seinen Status ablegt. */
export const BOT_HEARTBEAT_KEY = 'moin:bot:heartbeat';
export const BOT_HEARTBEAT_TTL_SECONDS = 60;

export type ConfigEvent =
  | { type: 'module'; guildId: string; moduleId: string; enabled: boolean }
  | { type: 'module-config'; guildId: string; moduleId: string }
  | { type: 'guild-settings'; guildId: string }
  /** Auftrag aus dem Dashboard an ein Modul, z. B. „Verifizierungs-Panel senden“ */
  | { type: 'module-action'; guildId: string; moduleId: string; action: string; by: string }
  /** Tokens/Schlüssel geändert (Einrichtung, System-Seite) → Bot startet neu */
  | { type: 'system' }
  /** Status/Aktivität des Bots geändert (System → Bot-Profil) */
  | { type: 'presence' };

/**
 * online = verbunden; connecting = Anmeldung bei Discord läuft; setup = Einrichtung fehlt;
 * token-invalid / intents-missing = Discord lehnt ab; error = anderer Fehler (Text in `error`)
 */
export type BotState = 'online' | 'connecting' | 'setup' | 'token-invalid' | 'intents-missing' | 'error';

export interface BotHeartbeat {
  state: BotState;
  version: string;
  startedAt: string;
  updatedAt: string;
  guilds: number;
  pingMs: number;
  user: string;
  /** Letzte Fehlermeldung bei state = error */
  error?: string;
}
