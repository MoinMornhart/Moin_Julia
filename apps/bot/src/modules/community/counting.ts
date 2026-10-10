import type { Message } from 'discord.js';
import { checkCount, parseCount, t } from '@moin/shared';
import type { BotContext } from '../../core/types.js';
import { communityConfig } from './shared.js';

/** Zähl-Kanal: jede Nachricht muss die nächste Zahl sein; Fehler → Hinweis und ggf. Neustart bei 1 */
/**
 * Nachrichten eines Servers nacheinander prüfen: Kommen „5“ und „6“ fast gleichzeitig, läsen sonst beide
 * denselben alten Stand – und die richtige „6“ würde als falsch gewertet (und der Zähler zurückgesetzt).
 */
const queues = new Map<string, Promise<void>>();
export function onCountingMessage(bot: BotContext, message: Message<true>): Promise<void> {
  const previous = queues.get(message.guildId) ?? Promise.resolve();
  const next = previous.then(() => handleCount(bot, message)).catch((error: unknown) => bot.logger.warn({ err: error }, 'Community: Zählen fehlgeschlagen'));
  queues.set(message.guildId, next);
  void next.finally(() => {
    if (queues.get(message.guildId) === next) queues.delete(message.guildId);
  });
  return next;
}

async function handleCount(bot: BotContext, message: Message<true>): Promise<void> {
  const config = await communityConfig(bot, message.guildId);
  const cfg = config.counting;
  if (!cfg.enabled || cfg.channelId !== message.channelId) return;
  const state = (await bot.prisma.countingState.findUnique({ where: { guildId: message.guildId } })) ?? { current: 0, lastUserId: null, record: 0 };
  const value = parseCount(message.content);
  const result = checkCount(state, value, message.author.id, cfg.allowDouble);
  if (result === 'ignore') {
    // Text ohne Zahl stört das Zählen nicht – nur löschen, wenn gewünscht
    if (cfg.deleteWrong) await message.delete().catch(() => undefined);
    return;
  }
  if (result === 'ok') {
    const next = state.current + 1;
    const record = Math.max(state.record, next);
    await bot.prisma.countingState.upsert({
      where: { guildId: message.guildId },
      create: { guildId: message.guildId, current: next, lastUserId: message.author.id, record },
      update: { current: next, lastUserId: message.author.id, record },
    });
    // 💯 an jeder Hunderter-Marke, sonst ✅
    await message.react(next % 100 === 0 ? '💯' : '✅').catch(() => undefined);
    return;
  }
  const locale = await bot.modules.locale(message.guildId);
  const expected = state.current + 1;
  const reset = cfg.resetOnFail;
  await bot.prisma.countingState.upsert({
    where: { guildId: message.guildId },
    create: { guildId: message.guildId, current: 0, lastUserId: null, record: state.record },
    update: reset ? { current: 0, lastUserId: null } : {},
  });
  if (cfg.deleteWrong) await message.delete().catch(() => undefined);
  else await message.react('❌').catch(() => undefined);
  const resetText = reset ? t(locale, 'community.count.reset') : t(locale, 'community.count.keep', { expected: String(expected) });
  const text = result === 'double'
    ? t(locale, 'community.count.double', { user: `<@${message.author.id}>`, reset: resetText })
    : t(locale, 'community.count.wrong', { user: `<@${message.author.id}>`, expected: String(expected), reset: resetText });
  await message.channel.send({ content: text, allowedMentions: { users: [message.author.id] } }).catch(() => undefined);
}
