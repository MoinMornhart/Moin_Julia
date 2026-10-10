import { MessageFlags, REST, Routes, type ChatInputCommandInteraction, type Interaction, type RepliableInteraction } from 'discord.js';
import { getModule, t } from '@moin/shared';
import type { BotContext, BotModule, GatedOn, SlashCommand } from './types.js';

interface RegisteredCommand {
  module: BotModule;
  command: SlashCommand;
}

/** Hält alle Module, verteilt Slash-Commands und registriert sie pro Server bei Discord. */
export class ModuleRegistry {
  private readonly commands = new Map<string, RegisteredCommand>();
  private readonly rest: REST;

  constructor(
    private readonly bot: BotContext,
    private readonly modules: BotModule[],
    token: string,
    private readonly applicationId: string,
  ) {
    this.rest = new REST().setToken(token);
    for (const module of modules) {
      if (!getModule(module.id)) {
        throw new Error(`Modul "${module.id}" fehlt im Modul-Katalog (@moin/shared).`);
      }
      for (const command of module.commands ?? []) {
        if (this.commands.has(command.data.name)) {
          throw new Error(`Befehl /${command.data.name} ist doppelt vergeben.`);
        }
        this.commands.set(command.data.name, { module, command });
      }
    }
  }

  async setupModules(): Promise<void> {
    for (const module of this.modules) {
      await module.setup?.({ bot: this.bot, on: this.gatedOn(module.id) });
    }
  }

  async runReady(): Promise<void> {
    for (const module of this.modules) {
      try {
        await module.onReady?.(this.bot);
      } catch (error) {
        this.bot.logger.error({ err: error, moduleId: module.id }, 'onReady fehlgeschlagen');
      }
    }
  }

  /** Meldet Modulen eine Änderung; ohne moduleId alle Module (z. B. Sprache geändert, neuer Server). */
  async runConfigChange(guildId: string, moduleId?: string): Promise<void> {
    for (const module of this.modules) {
      if (moduleId && module.id !== moduleId) continue;
      try {
        await module.onConfigChange?.(this.bot, guildId);
      } catch (error) {
        this.bot.logger.error({ err: error, moduleId: module.id, guildId }, 'onConfigChange fehlgeschlagen');
      }
    }
  }

  /** Registriert die Befehle aller auf diesem Server aktiven Module (Guild-Commands greifen sofort). */
  async syncGuildCommands(guildId: string): Promise<void> {
    const body = [];
    for (const module of this.modules) {
      if (await this.bot.modules.isEnabled(guildId, module.id)) {
        body.push(...(module.commands ?? []).map((c) => c.data));
      }
    }
    await this.rest.put(Routes.applicationGuildCommands(this.applicationId, guildId), { body });
    this.bot.logger.debug({ guildId, commands: body.map((c) => c.name) }, 'Befehle registriert');
  }

  /** Auftrag aus dem Dashboard an ein Modul weiterreichen */
  async runAction(guildId: string, moduleId: string, action: string, by: string): Promise<void> {
    const module = this.modules.find((m) => m.id === moduleId);
    if (!module?.onAction) return;
    try {
      await module.onAction(this.bot, guildId, action, by);
    } catch (error) {
      this.bot.logger.error({ err: error, moduleId, action, guildId }, 'Dashboard-Auftrag fehlgeschlagen');
    }
  }

  async handleInteraction(interaction: Interaction): Promise<void> {
    if ((interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) && interaction.inCachedGuild()) {
      await this.handleComponent(interaction);
      return;
    }
    // Knöpfe in Direktnachrichten (z. B. Ticket-Bewertung) – Modul entscheidet selbst
    if (interaction.isButton() && !interaction.inGuild()) {
      const [moduleId, action = '', ...args] = interaction.customId.split(':');
      const module = this.modules.find((m) => m.id === moduleId);
      if (!module?.onDmComponent) return;
      try {
        await module.onDmComponent({ interaction, action, args, bot: this.bot });
      } catch (error) {
        this.bot.logger.error({ err: error, customId: interaction.customId }, 'DM-Komponente fehlgeschlagen');
      }
      return;
    }
    // Vorschläge beim Tippen (z. B. Radiosender) – Fehler still schlucken, Discord zeigt dann einfach nichts
    if (interaction.isAutocomplete()) {
      const entry = this.commands.get(interaction.commandName);
      if (!entry?.command.autocomplete || !interaction.guildId || !(await this.bot.modules.isEnabled(interaction.guildId, entry.module.id))) return;
      const locale = await this.bot.modules.locale(interaction.guildId).catch(() => 'de' as const);
      await entry.command.autocomplete({ interaction, locale, bot: this.bot }).catch((error: unknown) => {
        this.bot.logger.warn({ err: error, command: interaction.commandName }, 'Autovervollständigung fehlgeschlagen');
        return interaction.respond([]).catch(() => undefined);
      });
      return;
    }
    if (!interaction.isChatInputCommand()) return;
    const entry = this.commands.get(interaction.commandName);
    if (!entry) return;

    const locale = await this.bot.modules.locale(interaction.guildId).catch(() => 'de' as const);
    try {
      if (!interaction.guildId) {
        await interaction.reply({ content: t(locale, 'common.guildOnly'), flags: MessageFlags.Ephemeral });
        return;
      }
      if (!(await this.bot.modules.isEnabled(interaction.guildId, entry.module.id))) {
        const name = getModule(entry.module.id)?.name[locale] ?? entry.module.id;
        await interaction.reply({ content: t(locale, 'common.moduleDisabled', { module: name }), flags: MessageFlags.Ephemeral });
        return;
      }
      await entry.command.execute({ interaction, locale, bot: this.bot });
    } catch (error) {
      this.bot.logger.error({ err: error, command: interaction.commandName, guildId: interaction.guildId }, 'Befehl fehlgeschlagen');
      await this.replyError(interaction, t(locale, 'common.error'));
    }
  }

  private async handleComponent(
    interaction: Parameters<NonNullable<BotModule['onComponent']>>[0]['interaction'],
  ): Promise<void> {
    const [moduleId, action = '', ...args] = interaction.customId.split(':');
    const module = this.modules.find((m) => m.id === moduleId);
    if (!module?.onComponent) return;
    const locale = await this.bot.modules.locale(interaction.guildId).catch(() => 'de' as const);
    try {
      if (!(await this.bot.modules.isEnabled(interaction.guildId, module.id))) {
        const name = getModule(module.id)?.name[locale] ?? module.id;
        await interaction.reply({ content: t(locale, 'common.moduleDisabled', { module: name }), flags: MessageFlags.Ephemeral });
        return;
      }
      await module.onComponent({ interaction, action, args, locale, bot: this.bot });
    } catch (error) {
      this.bot.logger.error({ err: error, customId: interaction.customId }, 'Komponente fehlgeschlagen');
      await this.replyError(interaction, t(locale, 'common.error'));
    }
  }

  private async replyError(interaction: RepliableInteraction, content: string): Promise<void> {
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }
    } catch {
      // Interaktion ist abgelaufen – nichts mehr zu tun.
    }
  }

  private gatedOn(moduleId: string): GatedOn {
    return (event, guildOf, handler) => {
      this.bot.client.on(event, async (...args) => {
        try {
          const guildId = guildOf(...args);
          if (!guildId || !(await this.bot.modules.isEnabled(guildId, moduleId))) return;
          await handler(...args);
        } catch (error) {
          this.bot.logger.error({ err: error, moduleId, event }, 'Fehler im Modul-Event');
        }
      });
    };
  }
}
