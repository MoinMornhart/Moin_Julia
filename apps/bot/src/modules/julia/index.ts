import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type Guild, type GuildMember, type Message } from 'discord.js';
import { loadGuildSecrets, loadSettings } from '@moin/db';
import {
  budgetState,
  buildConversation,
  chunkText,
  buildSystemPrompt,
  compatBaseUrl,
  COMPAT_PROVIDERS,
  isCompatProvider,
  juliaRuler,
  costMicroUsd,
  DEFAULT_MODE_NAME,
  asksToRemember,
  extractMemory,
  flirtyAllowed,
  formatUsd,
  MAX_FACTS,
  mentionsUnderage,
  parseJuliaConfig,
  parseModeCommand,
  parseOllamaEndpoints,
  resolveOllama,
  stripBotMention,
  splitReply,
  t,
  usageMonth,
  type ClaudeModel,
  type JuliaConfig,
  type Locale,
  type TranslationKey,
} from '@moin/shared';
import type { BotContext, BotModule, CommandContext, SlashCommand } from '../../core/types.js';
import { activeMode, canSwitchMode, modeState, factsOf, getProfile, modeList, profileView, rememberFacts, switchMode, updateProfile } from './profile.js';
import { claudeComplete, compatComplete, JuliaError, ollamaComplete, type ChatMessage, type Completion, type SystemPrompt } from './providers.js';

/**
 * Julia – KI-Chat. Antwortet auf @Erwähnungen/Antworten, in Chat-Kanälen und auf /julia frage.
 * Vor jeder Anfrage (im Code, nicht im Modell): Opt-out, Sperr-Rollen, Abklingzeit, Stundenlimit,
 * Monatsbudget und die Flirt-Freigabe (Rolle + altersbeschränkter Kanal + Opt-in + keine Sperre).
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
  const recent = (hourly.get(key) ?? []).filter((x) => now - x < 3_600_000);
  if (recent.length) hourly.set(key, recent);
  else hourly.delete(key);
  if (config.perUserPerHour > 0 && recent.length >= config.perUserPerHour) return 'hourly';
  return 'ok';
}

function noteAnswer(key: string, now = Date.now()): void {
  lastAnswer.set(key, now);
  hourly.set(key, [...(hourly.get(key) ?? []), now]);
  // Aufräumen: nur Einträge älter als eine Stunde (früher wurde alles gelöscht – auch laufende Abklingzeiten)
  if (lastAnswer.size > 5_000) {
    for (const [k, at] of lastAnswer) if (now - at > 3_600_000) lastAnswer.delete(k);
    for (const [k, list] of hourly) if (!list.some((x) => now - x < 3_600_000)) hourly.delete(k);
  }
}

export function resetRateLimits(): void {
  lastAnswer.clear();
  hourly.clear();
}

// ── Anfrage an den Anbieter ─────────────────────────────────────────────────
type Outcome = { kind: 'reply'; parts: string[] } | { kind: 'notice'; key: TranslationKey } | { kind: 'silent' };

async function complete(
  bot: BotContext,
  guildId: string,
  config: JuliaConfig,
  model: ClaudeModel,
  system: SystemPrompt,
  messages: ChatMessage[],
  ollamaModeModel = '',
): Promise<{ result: Completion; cost: number } | 'not-connected'> {
  const s = await loadSettings(bot.prisma);
  if (config.provider === 'ollama') {
    // Eigener Endpunkt des Servers (sonst der erste); ein Modus kann ein anderes Modell wählen
    const target = resolveOllama(parseOllamaEndpoints(s.ollamaEndpoints, { url: s.ollamaUrl, model: s.ollamaModel }), config.ollamaEndpointId, ollamaModeModel);
    if (!target) return 'not-connected';
    return { result: await ollamaComplete({ endpoint: target.endpoint, model: target.model, system, messages }), cost: 0 };
  }
  const own = await loadGuildSecrets(bot.prisma, guildId).catch(() => null);
  if (isCompatProvider(config.provider)) {
    // Gemini, OpenAI & Co.: nur mit eigenem Schlüssel des Servers (Kosten trägt der Server beim Anbieter)
    const provider = config.provider;
    const apiKey = own?.[`${provider}ApiKey`] ?? null;
    const baseUrl = compatBaseUrl(provider, config.customBaseUrl);
    if ((!apiKey && provider !== 'custom') || !baseUrl) return 'not-connected';
    const aiModel = ollamaModeModel || config.aiModel || COMPAT_PROVIDERS[provider].defaultModel;
    if (!aiModel) return 'not-connected';
    const result = await compatComplete({ baseUrl, apiKey: apiKey ?? '', model: aiModel, label: COMPAT_PROVIDERS[provider].label, system, messages });
    return { result, cost: 0 };
  }
  // Claude: eigener Schlüssel des Servers vor dem der Instanz
  const apiKey = own?.anthropicApiKey ?? s.anthropicApiKey;
  if (!apiKey) return 'not-connected';
  const result = await claudeComplete({ apiKey, model, system, messages });
  return { result, cost: costMicroUsd(model, result.usage) };
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
 * Kern: prüft Grenzen, baut den Prompt (Modus + Profil), ruft das Modell, bucht den Verbrauch
 * und merkt sich ggf. Fakten. `quietWhenLimited`: in Chat-Kanälen bei Limits nichts schreiben.
 */
export async function askJulia(
  bot: BotContext,
  input: {
    guild: Guild;
    member: GuildMember;
    channel: { ids: string[]; nsfw: boolean };
    history: { fromBot: boolean; name: string; text: string }[];
    quietWhenLimited: boolean;
  },
): Promise<Outcome> {
  const config = await juliaConfig(bot, input.guild.id);
  const locale = await bot.modules.locale(input.guild.id);
  let profile = await getProfile(bot, input.guild.id, input.member.id);
  if (profile?.optOut) return { kind: 'silent' };
  if (config.blockedRoleIds.some((r) => input.member.roles.cache.has(r))) return input.quietWhenLimited ? { kind: 'silent' } : { kind: 'notice', key: 'julia.blocked' };

  // Altersangabe < 18 → Flirt dauerhaft gesperrt (Code-Entscheidung, nicht Modell)
  const ownText = input.history.at(-1)?.text ?? '';
  if (mentionsUnderage(ownText) && !profile?.underage) profile = await updateProfile(bot, input.member, { underage: true, flirtyOptIn: false });

  const key = `${input.guild.id}:${input.member.id}`;
  const rate = rateCheck(key, config);
  if (rate !== 'ok') return input.quietWhenLimited ? { kind: 'silent' } : { kind: 'notice', key: rate === 'cooldown' ? 'julia.cooldown' : 'julia.hourly' };
  // Platz sofort reservieren: Zwei schnelle Nachrichten derselben Person kämen sonst beide durch (= zwei bezahlte Anfragen)
  noteAnswer(key);

  if (config.provider === 'anthropic') {
    const usage = await bot.prisma.juliaUsage.findUnique({ where: { guildId_month: { guildId: input.guild.id, month: usageMonth(new Date()) } } });
    if (budgetState(usage?.costMicroUsd ?? 0, config.monthlyBudgetUsd, config.warnAtPercent) === 'blocked') {
      return input.quietWhenLimited ? { kind: 'silent' } : { kind: 'notice', key: 'julia.budget' };
    }
  }

  const messages = buildConversation(input.history);
  if (!messages.length) return { kind: 'silent' };
  const mode = await activeMode(bot, config, input.guild.id, input.channel.ids);
  const flirty = flirtyAllowed({
    enabled: config.flirty.enabled,
    adultRoleId: config.flirty.adultRoleId,
    hasAdultRole: !!config.flirty.adultRoleId && input.member.roles.cache.has(config.flirty.adultRoleId),
    nsfwChannel: input.channel.nsfw,
    optIn: profile?.flirtyOptIn ?? false,
    underage: profile?.underage ?? false,
  });
  const system = buildSystemPrompt({
    serverName: input.guild.name,
    persona: mode?.persona ?? config.persona,
    length: mode?.length ?? 'kurz',
    creativity: mode?.creativity ?? 'normal',
    memoryEnabled: config.memoryEnabled,
    speaker: { name: input.member.displayName, profile: profileView(profile) },
    flirty,
    ruler: juliaRuler(config, {
      userId: input.member.id,
      instanceOwnerId: (await loadSettings(bot.prisma).catch(() => null))?.instanceOwnerId ?? null,
      guildOwnerId: input.guild.ownerId,
    }),
  });
  try {
    const done = await complete(bot, input.guild.id, config, mode?.model || config.model, system, messages, mode?.ollamaModel);
    if (done === 'not-connected') return { kind: 'notice', key: 'julia.notConnected' };
    await recordUsage(bot, input.guild, config, done.result, done.cost, locale);
    if (done.result.refused || !done.result.text) return { kind: 'notice', key: 'julia.refused' };
    const { text, facts } = extractMemory(done.result.text);
    if (config.memoryEnabled && facts.length && asksToRemember(ownText)) await rememberFacts(bot, input.member, facts);
    return text ? { kind: 'reply', parts: splitReply(text) } : { kind: 'notice', key: 'julia.profile.saved' };
  } catch (error) {
    bot.logger.warn({ err: error, guildId: input.guild.id }, 'Julia: Anfrage fehlgeschlagen');
    if (error instanceof JuliaError && error.kind === 'auth') return { kind: 'notice', key: 'julia.notConnected' };
    return { kind: 'notice', key: 'julia.error' };
  }
}

/**
 * Letzte Nachrichten im Kanal als Kontext (älteste zuerst). Nachrichten von vor dem letzten Modus-Wechsel
 * bleiben draußen – sonst redet Julia im Stil des alten Modus weiter.
 */
async function channelHistory(bot: BotContext, message: Message<true>, limit: number, ownText: string, since: Date | null = null) {
  const botId = bot.client.user?.id;
  const before = limit > 0 ? await message.channel.messages.fetch({ limit, before: message.id }).catch(() => null) : null;
  const after = since ? since.getTime() + 3000 : 0; // + die Bestätigung „Modus gewechselt“ direkt danach
  const list = [...(before?.values() ?? [])].reverse().filter((m) => !m.system && m.cleanContent.trim() && m.createdTimestamp > after);
  return [
    ...list.map((m) => ({ fromBot: m.author.id === botId, name: m.member?.displayName ?? m.author.displayName, text: m.cleanContent.slice(0, 2000) })),
    { fromBot: false, name: message.member?.displayName ?? message.author.displayName, text: ownText.slice(0, 2000) },
  ];
}

const channelIdsOf = (channel: Message<true>['channel']) => [channel.id, channel.isThread() ? channel.parentId : null].filter((x): x is string => !!x);
const isNsfw = (channel: Message<true>['channel']) => (channel.isThread() ? !!channel.parent && 'nsfw' in channel.parent && channel.parent.nsfw : 'nsfw' in channel && !!channel.nsfw);

async function send(message: Message<true>, parts: string[]): Promise<void> {
  let first = true;
  for (const part of parts) {
    if (first) await message.reply({ content: part, allowedMentions: { parse: [], repliedUser: false } }).catch(() => undefined);
    else if (message.channel.isSendable()) await message.channel.send({ content: part, allowedMentions: { parse: [] } }).catch(() => undefined);
    first = false;
  }
}

async function onMessage(bot: BotContext, message: Message): Promise<void> {
  if (!message.inGuild() || message.author.bot || message.webhookId || message.system) return;
  const botId = bot.client.user?.id;
  if (!botId) return;
  const config = await juliaConfig(bot, message.guildId);
  const ids = channelIdsOf(message.channel);
  const inChat = ids.some((id) => config.chatChannelIds.includes(id));
  const mentioned = message.mentions.users.has(botId) || message.mentions.repliedUser?.id === botId;
  if (!inChat && !(config.respondToMentions && mentioned)) return;
  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (!member) return;
  const locale = await bot.modules.locale(message.guildId);
  // Discord zeigt die Erwähnung als „@Spitzname“ – Server-Spitzname, Anzeigename oder Benutzername
  const botNames = [message.guild.members.me?.displayName, bot.client.user?.globalName, bot.client.user?.username, 'Julia'].filter((n): n is string => !!n);
  const ownText = stripBotMention(message.cleanContent, botNames);

  // „modus <Name>“ (auch „Julia, modus <Name>“) – kein KI-Aufruf, nur umschalten
  const wanted = parseModeCommand(ownText, botNames);
  if (wanted) {
    if (!canSwitchMode(member, config)) return send(message, [t(locale, 'julia.mode.noPermission')]);
    const name = await switchMode(bot, config, message.guildId, message.channelId, wanted, member.id);
    return send(message, [name ? t(locale, 'julia.mode.switched', { mode: name }) : t(locale, 'julia.mode.unknown', { name: wanted.slice(0, 30), list: modeList(config) })]);
  }

  // Limit schon hier prüfen – sonst kostet jede (ohnehin abgelehnte) Nachricht im Chat-Kanal einen Discord-Abruf des Verlaufs
  if (inChat && !mentioned && rateCheck(`${message.guildId}:${member.id}`, config) !== 'ok') return;

  const typing = message.channel.sendTyping().catch(() => undefined);
  const outcome = await askJulia(bot, {
    guild: message.guild,
    member,
    channel: { ids, nsfw: isNsfw(message.channel) },
    history: await channelHistory(bot, message, config.contextMessages, ownText, (await modeState(bot, config, message.guildId, ids)).since),
    quietWhenLimited: inChat && !mentioned,
  });
  await typing;
  if (outcome.kind === 'silent') return;
  await send(message, outcome.kind === 'reply' ? outcome.parts : [t(locale, outcome.key)]);
}

// ── /julia ──────────────────────────────────────────────────────────────────
function d(key: TranslationKey) {
  return { de: t('de', key), loc: { 'en-US': t('en', key), 'en-GB': t('en', key) } };
}
const en = (name: string) => ({ 'en-US': name, 'en-GB': name });

const juliaCommand: SlashCommand = {
  data: (() => {
    const x = (k: TranslationKey) => d(k);
    return new SlashCommandBuilder()
      .setName('julia')
      .setDescription(x('julia.cmd.root').de)
      .setDescriptionLocalizations(x('julia.cmd.root').loc)
      .setContexts(InteractionContextType.Guild)
      .addSubcommand((s) =>
        s
          .setName('frage')
          .setNameLocalizations(en('ask'))
          .setDescription(x('julia.cmd.ask').de)
          .setDescriptionLocalizations(x('julia.cmd.ask').loc)
          .addStringOption((o) => o.setName('text').setDescription(x('julia.cmd.question').de).setDescriptionLocalizations(x('julia.cmd.question').loc).setRequired(true).setMaxLength(1500)),
      )
      .addSubcommand((s) =>
        s
          .setName('modus')
          .setNameLocalizations(en('mode'))
          .setDescription(x('julia.cmd.mode').de)
          .setDescriptionLocalizations(x('julia.cmd.mode').loc)
          .addStringOption((o) => o.setName('name').setDescription(x('julia.cmd.modeName').de).setDescriptionLocalizations(x('julia.cmd.modeName').loc).setMaxLength(30)),
      )
      .addSubcommand((s) => s.setName('profil').setNameLocalizations(en('profile')).setDescription(x('julia.cmd.profile').de).setDescriptionLocalizations(x('julia.cmd.profile').loc))
      .addSubcommand((s) =>
        s
          .setName('spitzname')
          .setNameLocalizations(en('nickname'))
          .setDescription(x('julia.cmd.nickname').de)
          .setDescriptionLocalizations(x('julia.cmd.nickname').loc)
          .addStringOption((o) => o.setName('name').setDescription(x('julia.cmd.nicknameName').de).setDescriptionLocalizations(x('julia.cmd.nicknameName').loc).setMaxLength(32)),
      )
      .addSubcommand((s) =>
        s
          .setName('anrede')
          .setNameLocalizations(en('address'))
          .setDescription(x('julia.cmd.address').de)
          .setDescriptionLocalizations(x('julia.cmd.address').loc)
          .addStringOption((o) =>
            o
              .setName('anrede')
              .setNameLocalizations(en('address'))
              .setDescription(x('julia.cmd.addressValue').de)
              .setDescriptionLocalizations(x('julia.cmd.addressValue').loc)
              .setRequired(true)
              .addChoices({ name: 'du', value: 'du' }, { name: 'Sie', value: 'sie' }, { name: 'egal', value: 'egal' }),
          ),
      )
      .addSubcommand((s) =>
        s
          .setName('merken')
          .setNameLocalizations(en('remember'))
          .setDescription(x('julia.cmd.remember').de)
          .setDescriptionLocalizations(x('julia.cmd.remember').loc)
          .addStringOption((o) => o.setName('text').setDescription(x('julia.cmd.fact').de).setDescriptionLocalizations(x('julia.cmd.fact').loc).setRequired(true).setMaxLength(200)),
      )
      .addSubcommand((s) => s.setName('vergessen').setNameLocalizations(en('forget')).setDescription(x('julia.cmd.forget').de).setDescriptionLocalizations(x('julia.cmd.forget').loc))
      .addSubcommand((s) => s.setName('optout').setDescription(x('julia.cmd.optout').de).setDescriptionLocalizations(x('julia.cmd.optout').loc))
      .addSubcommand((s) => s.setName('optin').setDescription(x('julia.cmd.optin').de).setDescriptionLocalizations(x('julia.cmd.optin').loc))
      .addSubcommand((s) =>
        s
          .setName('flirty')
          .setDescription(x('julia.cmd.flirty').de)
          .setDescriptionLocalizations(x('julia.cmd.flirty').loc)
          .addStringOption((o) =>
            o
              .setName('status')
              .setDescription(x('julia.cmd.flirtyOn').de)
              .setDescriptionLocalizations(x('julia.cmd.flirtyOn').loc)
              .setRequired(true)
              .addChoices({ name: 'an', name_localizations: en('on'), value: 'an' }, { name: 'aus', name_localizations: en('off'), value: 'aus' }),
          )
          .addIntegerOption((o) => o.setName('alter').setNameLocalizations(en('age')).setDescription(x('julia.cmd.age').de).setDescriptionLocalizations(x('julia.cmd.age').loc).setMinValue(1).setMaxValue(120)),
      )
      .addSubcommand((s) => s.setName('status').setDescription(x('julia.cmd.status').de).setDescriptionLocalizations(x('julia.cmd.status').loc))
      .toJSON();
  })(),
  async execute({ interaction, locale, bot }: CommandContext) {
    if (!interaction.inCachedGuild()) return;
    const config = await juliaConfig(bot, interaction.guildId);
    const member = interaction.member;
    const sub = interaction.options.getSubcommand();
    const ephemeral = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

    if (sub === 'status') {
      if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) return void (await ephemeral(t(locale, 'julia.noPermission')));
      const usage = await bot.prisma.juliaUsage.findUnique({ where: { guildId_month: { guildId: interaction.guildId, month: usageMonth(new Date()) } } });
      const spent = usage?.costMicroUsd ?? 0;
      const budget = config.monthlyBudgetUsd * 1_000_000;
      return void (await ephemeral(
        t(locale, 'julia.status', {
          provider: config.provider === 'ollama' ? 'Ollama (lokal)' : config.model,
          spent: formatUsd(spent),
          budget: config.provider === 'ollama' ? '–' : formatUsd(budget),
          percent: budget > 0 ? String(Math.round((spent / budget) * 100)) : '–',
          requests: String(usage?.requests ?? 0),
        }),
      ));
    }

    if (sub === 'modus') {
      const wanted = interaction.options.getString('name');
      if (!wanted) {
        const current = await activeMode(bot, config, interaction.guildId, interaction.channel ? channelIdsOf(interaction.channel) : [interaction.channelId]);
        return void (await ephemeral(t(locale, 'julia.mode.list', { mode: current?.name ?? DEFAULT_MODE_NAME, list: modeList(config) })));
      }
      if (!canSwitchMode(member, config)) return void (await ephemeral(t(locale, 'julia.mode.noPermission')));
      const name = await switchMode(bot, config, interaction.guildId, interaction.channelId, wanted, member.id);
      if (!name) return void (await ephemeral(t(locale, 'julia.mode.unknown', { name: wanted, list: modeList(config) })));
      return void (await interaction.reply({ content: t(locale, 'julia.mode.switched', { mode: name }), allowedMentions: { parse: [] } }));
    }

    if (sub === 'profil') {
      const p = await getProfile(bot, interaction.guildId, member.id);
      const facts = factsOf(p);
      return void (await ephemeral(
        t(locale, 'julia.profile.show', {
          nickname: p?.nickname ?? t(locale, 'julia.profile.none'),
          address: p?.address === 'sie' ? 'Sie' : p?.address === 'du' ? 'du' : t(locale, 'julia.profile.none'),
          count: String(facts.length),
          facts: facts.length ? facts.map((f) => `• ${f.text}`).join('\n') : t(locale, 'julia.profile.none'),
        }).slice(0, 2000),
      ));
    }
    if (sub === 'spitzname') {
      const name = interaction.options.getString('name')?.trim() || null;
      await updateProfile(bot, member, { nickname: name ? name.replace(/[[\]"\n@]/g, '').slice(0, 32) : null });
      return void (await ephemeral(t(locale, 'julia.profile.saved')));
    }
    if (sub === 'anrede') {
      const value = interaction.options.getString('anrede', true);
      await updateProfile(bot, member, { address: value === 'du' || value === 'sie' ? value : null });
      return void (await ephemeral(t(locale, 'julia.profile.saved')));
    }
    if (sub === 'merken') {
      if (!config.memoryEnabled) return void (await ephemeral(t(locale, 'julia.profile.memoryOff')));
      const fact = interaction.options.getString('text', true).trim();
      const before = factsOf(await getProfile(bot, interaction.guildId, member.id));
      if (before.length >= MAX_FACTS) return void (await ephemeral(t(locale, 'julia.profile.full', { max: String(MAX_FACTS) })));
      await rememberFacts(bot, member, [fact]);
      return void (await ephemeral(t(locale, 'julia.profile.remembered', { fact: fact.slice(0, 200) })));
    }
    if (sub === 'vergessen') {
      // Spitzname, Anrede, Gedächtnis und Flirt-Opt-in weg – Opt-out und Alters-Sperre bleiben (Schutz)
      await updateProfile(bot, member, { nickname: null, address: null, facts: [], flirtyOptIn: false });
      return void (await ephemeral(t(locale, 'julia.profile.forgotten')));
    }
    if (sub === 'optout' || sub === 'optin') {
      await updateProfile(bot, member, { optOut: sub === 'optout' });
      return void (await ephemeral(t(locale, sub === 'optout' ? 'julia.optout.done' : 'julia.optin.done')));
    }
    if (sub === 'flirty') {
      if (interaction.options.getString('status', true) === 'aus') {
        await updateProfile(bot, member, { flirtyOptIn: false });
        return void (await ephemeral(t(locale, 'julia.flirty.off')));
      }
      if (!config.flirty.enabled || !config.flirty.adultRoleId) return void (await ephemeral(t(locale, 'julia.flirty.disabled')));
      const profile = await getProfile(bot, interaction.guildId, member.id);
      if (profile?.underage) return void (await ephemeral(t(locale, 'julia.flirty.blocked')));
      const age = interaction.options.getInteger('alter');
      if (age !== null && age < 18) {
        await updateProfile(bot, member, { underage: true, flirtyOptIn: false });
        return void (await ephemeral(t(locale, 'julia.flirty.underage')));
      }
      if (!member.roles.cache.has(config.flirty.adultRoleId)) return void (await ephemeral(t(locale, 'julia.flirty.needRole', { role: `<@&${config.flirty.adultRoleId}>` })));
      if (age === null) return void (await ephemeral(t(locale, 'julia.cmd.age')));
      await updateProfile(bot, member, { flirtyOptIn: true });
      return void (await ephemeral(t(locale, 'julia.flirty.on')));
    }

    // frage
    const question = interaction.options.getString('text', true);
    await interaction.deferReply();
    const channel = interaction.channel;
    const outcome = await askJulia(bot, {
      guild: interaction.guild,
      member,
      channel: { ids: channel ? channelIdsOf(channel) : [interaction.channelId], nsfw: channel ? isNsfw(channel) : false },
      history: [{ fromBot: false, name: member.displayName, text: question }],
      quietWhenLimited: false,
    });
    const quote = `> ${question.slice(0, 300).replaceAll('\n', '\n> ')}\n`;
    const text = outcome.kind === 'reply' ? outcome.parts : outcome.kind === 'notice' ? [t(locale, outcome.key)] : [t(locale, 'julia.optout.done')];
    // Zitat + Antwort neu auf Nachrichten à 2000 Zeichen verteilen – nichts darf in der Mitte wegfallen
    const chunks = chunkText(`${quote}${text.join('\n')}`, 2000);
    await interaction.editReply({ content: chunks[0] ?? quote, allowedMentions: { parse: [] } });
    for (const chunk of chunks.slice(1, 3)) await interaction.followUp({ content: chunk, allowedMentions: { parse: [] } });
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
