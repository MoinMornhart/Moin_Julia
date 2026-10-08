import type { BotModule } from '../../core/types.js';
import { checkMessage, onNativeExecution, syncNativeRules } from './automod.js';
import { moderationCommands } from './commands.js';

export const moderationModule: BotModule = {
  id: 'moderation',
  commands: moderationCommands,

  setup({ bot, on }) {
    on('messageCreate', (m) => m.guildId, async (message) => {
      if (message.inGuild()) await checkMessage(bot, message);
    });
    on('autoModerationActionExecution', (e) => e.guild.id, (execution) => onNativeExecution(bot, execution));
  },

  // Discord-AutoMod-Regeln nach dem Start und nach jeder Änderung im Dashboard abgleichen
  async onReady(bot) {
    for (const guild of bot.client.guilds.cache.values()) {
      await syncNativeRules(bot, guild).catch((error: unknown) => bot.logger.warn({ err: error, guildId: guild.id }, 'AutoMod-Abgleich fehlgeschlagen'));
    }
  },
  async onConfigChange(bot, guildId) {
    const guild = bot.client.guilds.cache.get(guildId);
    if (guild) await syncNativeRules(bot, guild);
  },
};
