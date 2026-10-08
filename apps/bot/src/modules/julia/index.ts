import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type Guild, type GuildMember, type Message } from 'discord.js';
import { loadSettings } from '@moin/db';
import {
  budgetState,
  buildConversation,
  costMicroUsd,
  formatUsd,
  JULIA_RULES,
  parseJuliaConfig,
  splitReply,
  t,
  usageMonth,
  type JuliaConfig,
  type Locale,
  type TranslationKey,
} from '@moin/shared';
import type { BotContext, BotModule, CommandContext, SlashCommand } from '../../core/types.js';
import { claudeComplete, JuliaError, ollamaComplete, type ChatMessage, type Completion } from './providers.js';

/**
 * Julia – KI-Chat. Antwortet auf @Erwähnungen/Antworten, in Chat-Kanälen und auf /julia frage.
 * Vor jeder Anfrage: Sperr-Rollen, Abklingzeit, Stundenlimit und Monatsbudget (harte Grenze).
 */

function juliaConfig(bot: BotContext, guildId: string): Promise<JuliaConfig> {
  return bot.modules.config(guildId, 'julia', parseJuliaConfig);
}

// ── Rate-Limits (im Speicher) ───────────────────────────────────────────────
const lastAnswer = new Map<string, number>();
const hourly = new Map<string, number[]>();

export function rateCheck(key: string, config: Pick<JuliaConfig, 'userCooldownSeconds' | 'perUserPerHour'>, now = Date.now()): 'ok' | 'cooldown' | 'hourly' {
  const last = lastAnswer.get(key) ?? 0;
  if (now - last < config.userCooldownSeconds * 1000) return 'cooldown';
  const recent = (hourly.get(key) ?? []).filter((t) => now - t < 3_600_000);
  hourly.set(key, recent);
  if (config.perUserPerHour > 0 && recent.length >= config.perUserPerHour) return 'hourly';
  return 'ok';
}

function noteAnswer(key: string, now = Date.now()): void {
  lastAnswer.set(key, now);
  hourly.set(key, [...(hourly.get(key) ?? []), now]);
  if (lastAnswer.size > 20_000) {
    lastAnswer.clear();
    hourly.clear();
  }
}

export function resetRateLimits(): void {
  lastAnswer.clear();
  hourly.clear();
}

// ── Anfrage an den Anbieter ─────────────────────────────────────────────────
type Outcome = { kind: 'reply'; parts: string[] } | { kind: 'notice'; key: TranslationKey } | { kind: 'silent' };

async function complete(bot: BotContext, config: JuliaConfig, system: string, messages: ChatMessage[]): Promise<{ result: Completion; cost: number } | 'not-connected'> {
  const s = await loadSettings(bot.prisma);
  if (config.provider === 'ollama') {
    if (!s.ollamaUrl || !s.ollamaModel) return 'not-connected';
    return { result: await ollamaComplete({ url: s.ollamaUrl, model: s.ollamaModel, system, messages }), cost: 0 };
  }
  if (!s.anthropicApiKey) return 'not-connected';
  const result = await claudeComplete({ apiKey: s.anthropicApiKey, model: config.model, system, messages });
  return { result, cost: costMicroUsd(config.model, result.usage) };
}

async function recordUsage(bot: BotContext, guild: Guild, config: JuliaConfig, result: Completion, cost: number, locale: Locale): Promise<void> {
  const month = usageMonth(new Date());
  const row = await bot.prisma.juliaUsage.upsert({
    where: { guildId_month: { guildId: guild.id, month } },
    create: { guildId: guild.id, month, requests: 1, inputTokens: result.usage.input, outputTokens: result.usage.output, cacheRead: result.usage.cacheRead, cacheWrite: result.usage.cacheWrite, costMicroUsd: cost },
    update: {
      requests: { increment: 1 },
      inputTokens: { increment: result.usage.input },
      outputTokens: { increment: result.usage.output },
      cacheRead: { increment: result.usage.cacheRead },
      cacheWrite: { increment: result.usage.cacheWrite },
      costMicroUsd: { increment: cost },
    },
  });
  if (config.provider !== 'anthropic' || config.monthlyBudgetUsd <= 0) return;
  const percent = Math.floor((row.costMicroUsd / (config.monthlyBudgetUsd * 1_000_000)) * 100);
  const threshold = percent >= 100 ? 100 : percent >= config.warnAtPercent ? config.warnAtPercent : 0;
  if (!threshold || row.warnedPercent >= threshold) return;
  await bot.prisma.juliaUsage.update({ where: { id: row.id }, data: { warnedPercent: threshold } });
  const channel = config.logChannelId ? guild.channels.cache.get(config.logChannelId) : undefined;
  if (channel?.isSendable()) {
    await channel
      .send({ content: t(locale, 'julia.warn', { percent: String(Math.min(percent, 100)), spent: formatUsd(row.costMicroUsd), budget: formatUsd(config.monthlyBudgetUsd * 1_000_000) }), allowedMentions: { parse: [] } })
      .catch(() => undefined);
  }
}

/**
 * Kern: prüft Grenzen, ruft das Modell und bucht den Verbrauch.
 * `quietWhenLimited`: in Chat-Kanälen bei Limits nichts schreiben (sonst Spam).
 */
export async function askJulia(
  bot: BotContext,
  input: { guild: Guild; member: GuildMember; history: { fromBot: boolean; name: string; text: string }[]; quietWhenLimited: boolean },
): Promise<Outcome> {
  const config = await juliaConfig(bot, input.guild.id);
  const locale = await bot.modules.locale(input.guild.id);
  if (config.blockedRoleIds.some((r) => input.member.roles.cache.has(r))) return input.quietWhenLimited ? { kind: 'silent' } : { kind: 'notice', key: 'julia.blocked' };

  const key = `${input.guild.id}:${input.member.id}`;
  const rate = rateCheck(key, config);
  if (rate !== 'ok') return input.quietWhenLimited ? { kind: 'silent' } : { kind: 'notice', key: rate === 'cooldown' ? 'julia.cooldown' : 'julia.hourly' };

  if (config.provider === 'anthropic') {
    const usage = await bot.prisma.juliaUsage.findUnique({ where: { guildId_month: { guildId: input.guild.id, month: usageMonth(new Date()) } } });
    if (budgetState(usage?.costMicroUsd ?? 0, config.monthlyBudgetUsd, config.warnAtPercent) === 'blocked') {
      return input.quietWhenLimited ? { kind: 'silent' } : { kind: 'notice', key: 'julia.budget' };
    }
  }

  const messages = buildConversation(input.history);
  if (!messages.length) return { kind: 'silent' };
  const system = `${JULIA_RULES}\n\nServer: ${input.guild.name}\n\n${config.persona}`;
  noteAnswer(key);
  try {
    const done = await complete(bot, config, system, messages);
    if (done === 'not-connected') return { kind: 'notice', key: 'julia.notConnected' };
    await recordUsage(bot, input.guild, config, done.result, done.cost, locale);
    if (done.result.refused || !done.result.text) return { kind: 'notice', key: 'julia.refused' };
    return { kind: 'reply', parts: splitReply(done.result.text) };
  } catch (error) {
    bot.logger.warn({ err: error, guildId: input.guild.id }, 'Julia: Anfrage fehlgeschlagen');
    if (error instanceof JuliaError && error.kind === 'auth') return { kind: 'notice', key: 'julia.notConnected' };
    return { kind: 'notice', key: 'julia.error' };
  }
}

/** Letzte Nachrichten im Kanal als Kontext (älteste zuerst) */
async function channelHistory(bot: BotContext, message: Message<true>, limit: number) {
  const botId = bot.client.user?.id;
  const before = limit > 0 ? await message.channel.messages.fetch({ limit, before: message.id }).catch(() => null) : null;
  const list = [...(before?.values() ?? [])].reverse().filter((m) => !m.system && m.cleanContent.trim());
  return [...list, message].map((m) => ({
    fromBot: m.author.id === botId,
    name: m.member?.displayName ?? m.author.displayName,
    text: (m.id === message.id ? m.cleanContent.replace(new RegExp(`@${bot.client.user?.username ?? 'Julia'}\\b`, 'gi'), '').trim() : m.cleanContent).slice(0, 2000),
  }));
}

async function onMessage(bot: BotContext, message: Message): Promise<void> {
  if (!message.inGuild() || message.author.bot || message.webhookId || message.system) return;
  const botId = bot.client.user?.id;
  if (!botId) return;
  const config = await juliaConfig(bot, message.guildId);
  const channelIds = [message.channelId, message.channel.isThread() ? message.channel.parentId : null].filter(Boolean) as string[];
  const inChat = channelIds.some((id) => config.chatChannelIds.includes(id));
  const mentioned = message.mentions.users.has(botId) || message.mentions.repliedUser?.id === botId;
  if (!inChat && !(config.respondToMentions && mentioned)) return;
  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (!member) return;

  const typing = message.channel.sendTyping().catch(() => undefined);
  const outcome = await askJulia(bot, { guild: message.guild, member, history: await channelHistory(bot, message, config.contextMessages), quietWhenLimited: inChat && !mentioned });
  await typing;
  const locale = await bot.modules.locale(message.guildId);
  if (outcome.kind === 'silent') return;
  const parts = outcome.kind === 'reply' ? outcome.parts : [t(locale, outcome.key)];
  let first = true;
  for (const part of parts) {
    if (first) await message.reply({ content: part, allowedMentions: { parse: [], repliedUser: false } }).catch(() => undefined);
    else if (message.channel.isSendable()) await message.channel.send({ content: part, allowedMentions: { parse: [] } }).catch(() => undefined);
    first = false;
  }
}

function d(key: TranslationKey) {
  return { de: t('de', key), loc: { 'en-US': t('en', key), 'en-GB': t('en', key) } };
}

const juliaCommand: SlashCommand = {
  data: (() => {
    const root = d('julia.cmd.root');
    const ask = d('julia.cmd.ask');
    const q = d('julia.cmd.question');
    const status = d('julia.cmd.status');
    return new SlashCommandBuilder()
      .setName('julia')
      .setDescription(root.de)
      .setDescriptionLocalizations(root.loc)
      .setContexts(InteractionContextType.Guild)
      .addSubcommand((s) =>
        s
          .setName('frage')
          .setNameLocalizations({ 'en-US': 'ask', 'en-GB': 'ask' })
          .setDescription(ask.de)
          .setDescriptionLocalizations(ask.loc)
          .addStringOption((o) => o.setName('text').setDescription(q.de).setDescriptionLocalizations(q.loc).setRequired(true).setMaxLength(1500)),
      )
      .addSubcommand((s) => s.setName('status').setDescription(status.de).setDescriptionLocalizations(status.loc))
      .toJSON();
  })(),
  async execute({ interaction, locale, bot }: CommandContext) {
    if (!interaction.inCachedGuild()) return;
    const config = await juliaConfig(bot, interaction.guildId);
    if (interaction.options.getSubcommand() === 'status') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return void (await interaction.reply({ content: t(locale, 'julia.noPermission'), flags: MessageFlags.Ephemeral }));
      const usage = await bot.prisma.juliaUsage.findUnique({ where: { guildId_month: { guildId: interaction.guildId, month: usageMonth(new Date()) } } });
      const spent = usage?.costMicroUsd ?? 0;
      const budget = config.monthlyBudgetUsd * 1_000_000;
      return void (await interaction.reply({
        content: t(locale, 'julia.status', {
          provider: config.provider === 'ollama' ? 'Ollama (lokal)' : config.model,
          spent: formatUsd(spent),
          budget: config.provider === 'ollama' ? '–' : formatUsd(budget),
          percent: budget > 0 ? String(Math.round((spent / budget) * 100)) : '–',
          requests: String(usage?.requests ?? 0),
        }),
        flags: MessageFlags.Ephemeral,
      }));
    }
    const question = interaction.options.getString('text', true);
    await interaction.deferReply();
    const outcome = await askJulia(bot, {
      guild: interaction.guild,
      member: interaction.member,
      history: [{ fromBot: false, name: interaction.member.displayName, text: question }],
      quietWhenLimited: false,
    });
    const quote = `> ${question.slice(0, 300).replaceAll('\n', '\n> ')}\n`;
    const text = outcome.kind === 'reply' ? outcome.parts : outcome.kind === 'notice' ? [t(locale, outcome.key)] : [t(locale, 'julia.error')];
    await interaction.editReply({ content: `${quote}${text[0] ?? ''}`.slice(0, 2000), allowedMentions: { parse: [] } });
    if (text[1]) await interaction.followUp({ content: text[1], allowedMentions: { parse: [] } });
  },
};

export const juliaModule: BotModule = {
  id: 'julia',
  commands: [juliaCommand],
  setup({ bot, on }) {
    on(
      'messageCreate',
      (m) => m.guildId,
      (m) => void onMessage(bot, m).catch((error: unknown) => bot.logger.warn({ err: error }, 'Julia: Nachricht fehlgeschlagen')),
    );
  },
};
