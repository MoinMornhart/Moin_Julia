import type { BotContext, BotModule } from '../../core/types.js';
import { birthdayCommand, birthdayRound } from './birthdays.js';
import { onCountingMessage } from './counting.js';
import { pollCommand, remindCommand, reminderRound } from './extras.js';
import { finishGiveaway, giveawayCommand, giveawayRound, onEnter, startGiveaway } from './giveaways.js';
import { onStarReaction } from './starboard.js';
import { findSuggestionBoard } from '@moin/shared';
import { communityConfig } from './shared.js';
import { onDecide, onSuggestButton, onSuggestionDecided, onVote, postSuggestionPanel, suggestCommand } from './suggestions.js';

/**
 * Community: Geburtstage, Zähl-Kanal, Vorschläge, Starboard, Giveaways, Umfragen, Erinnerungen.
 * Erinnerungen laufen unabhängig vom Modul-Schalter weiter (sie gehören der Person, nicht dem Server).
 */

function every(bot: BotContext, ms: number, name: string, run: () => Promise<unknown>): void {
  // nie zwei Runden gleichzeitig – bei 1-s-Takt kann eine Runde (Discord-Nachricht senden) länger dauern
  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    void run()
      .catch((error: unknown) => bot.logger.warn({ err: error }, `Community: ${name} fehlgeschlagen`))
      .finally(() => (running = false));
  };
  setInterval(tick, ms).unref();
  setTimeout(tick, Math.min(ms, 15_000)).unref();
}

export const communityModule: BotModule = {
  id: 'community',
  commands: [birthdayCommand, suggestCommand, giveawayCommand, pollCommand, remindCommand],
  setup({ bot, on }) {
    on(
      'messageCreate',
      (m) => m.guildId,
      (m) => {
        if (!m.inGuild() || m.author.bot || m.webhookId || m.system) return;
        void onCountingMessage(bot, m).catch((error: unknown) => bot.logger.warn({ err: error }, 'Community: Zählen fehlgeschlagen'));
      },
    );
    const star = (reaction: Parameters<typeof onStarReaction>[1]) =>
      void onStarReaction(bot, reaction).catch((error: unknown) => bot.logger.warn({ err: error }, 'Community: Starboard fehlgeschlagen'));
    on('messageReactionAdd', (r) => r.message.guildId, (r) => star(r));
    on('messageReactionRemove', (r) => r.message.guildId, (r) => star(r));
  },
  onReady(bot) {
    // Giveaways enden und Erinnerungen kommen auf die Sekunde genau
    every(bot, 1_000, 'Giveaways', () => giveawayRound(bot));
    every(bot, 1_000, 'Erinnerungen', () => reminderRound(bot));
    // Geburtstage gelten für eine ganze Stunde – 1 Minute reicht
    every(bot, 60_000, 'Geburtstage', () => birthdayRound(bot));
  },
  async onComponent(ctx) {
    if (ctx.action === 'vote') return onVote(ctx);
    if (ctx.action === 'suggest') return onSuggestButton(ctx);
    if (ctx.action === 'decide') return onDecide(ctx);
    if (ctx.action === 'enter') return onEnter(ctx);
  },
  async onAction(bot, guildId, action, by) {
    const guild = bot.client.guilds.cache.get(guildId);
    if (!guild) return;
    const [kind, id, ...rest] = action.split(':');
    if (kind === 'suggestion' && id) return onSuggestionDecided(bot, guild, id);
    if (kind === 'suggestpanel' && id) {
      const board = findSuggestionBoard((await communityConfig(bot, guildId)).suggestions, id);
      if (board) await postSuggestionPanel(bot, guild, board, await bot.modules.locale(guildId));
      return;
    }
    if ((kind === 'giveaway-end' || kind === 'giveaway-reroll') && id) {
      const g = await bot.prisma.giveaway.findFirst({ where: { id, guildId } });
      if (g) await finishGiveaway(bot, g, kind === 'giveaway-reroll');
      return;
    }
    if (kind === 'giveaway-start' && id) {
      // Auftrag aus dem Dashboard: giveaway-start:<kanal>:<dauerMs>:<gewinner>:<rolle|->:<preis (base64url)>
      const [durationMs, winners, role, prize64] = rest;
      const prize = Buffer.from(prize64 ?? '', 'base64url').toString('utf8');
      if (!prize || !Number(durationMs)) return;
      await startGiveaway(bot, guild, { channelId: id, prize, durationMs: Number(durationMs), winnerCount: Number(winners) || 1, requiredRoleId: role && role !== '-' ? role : null, hostId: by });
    }
  },
};
