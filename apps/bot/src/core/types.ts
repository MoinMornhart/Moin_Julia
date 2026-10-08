import type {
  AnySelectMenuInteraction,
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
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

/** Button, Auswahlmenü oder Formular eines Moduls. customId = "<modul>:<aktion>:<weitere…>" */
export interface ComponentContext {
  interaction: ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'> | ModalSubmitInteraction<'cached'>;
  action: string;
  args: string[];
  locale: Locale;
  bot: BotContext;
}

export interface SlashCommand {
  /** Ergebnis von `new SlashCommandBuilder()...toJSON()` */
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(ctx: CommandContext): Promise<void>;
  /** Vorschläge beim Tippen (Optionen mit setAutocomplete(true)) */
  autocomplete?(ctx: { interaction: AutocompleteInteraction; locale: Locale; bot: BotContext }): Promise<void>;
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
  /** Buttons/Auswahlmenüs/Formulare, deren customId mit "<modul-id>:" beginnt */
  onComponent?(ctx: ComponentContext): Promise<void>;
  /** Knöpfe in Direktnachrichten (kein Server-Kontext), customId = "<modul-id>:<aktion>:…" */
  onDmComponent?(ctx: { interaction: ButtonInteraction; action: string; args: string[]; bot: BotContext }): Promise<void>;
  /** Auftrag aus dem Dashboard (z. B. „Panel senden“) */
  onAction?(bot: BotContext, guildId: string, action: string, by: string): Promise<void>;
}
