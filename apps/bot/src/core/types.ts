import type {
  ChatInputCommandInteraction,
  Client,
  ClientEvents,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import type { Redis } from 'ioredis';
import type { PrismaClient } from '@moin/db';
import type { Locale } from '@moin/shared';
import type { Logger } from '../logger.js';
import type { ModuleState } from './module-state.js';

/** Alles, was Module vom Bot-Kern brauchen. */
export interface BotContext {
  client: Client;
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
  modules: ModuleState;
  version: string;
}

export interface CommandContext {
  interaction: ChatInputCommandInteraction;
  locale: Locale;
  bot: BotContext;
}

export interface SlashCommand {
  /** Ergebnis von `new SlashCommandBuilder()...toJSON()` */
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(ctx: CommandContext): Promise<void>;
}

/**
 * Registriert einen Event-Listener, der nur läuft, wenn das Modul auf dem Server aktiv ist.
 * `guildOf` liefert die Server-ID aus den Event-Argumenten (oder null für DMs).
 */
export type GatedOn = <K extends keyof ClientEvents>(
  event: K,
  guildOf: (...args: ClientEvents[K]) => string | null | undefined,
  handler: (...args: ClientEvents[K]) => unknown,
) => void;

export interface ModuleSetup {
  bot: BotContext;
  on: GatedOn;
}

/** Ein Feature-Modul. `id` muss zu einem Eintrag in `MODULES` (@moin/shared) passen. */
export interface BotModule {
  id: string;
  commands?: SlashCommand[];
  setup?(ctx: ModuleSetup): void | Promise<void>;
  /** Einmal nach dem Login, wenn alle Server bekannt sind */
  onReady?(bot: BotContext): void | Promise<void>;
  /** Nach Änderungen im Dashboard (An/Aus, Einstellungen, Server-Sprache) und beim Beitritt zu einem Server */
  onConfigChange?(bot: BotContext, guildId: string): void | Promise<void>;
}
