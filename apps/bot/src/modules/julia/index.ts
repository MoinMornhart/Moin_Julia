import { ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type Guild, type GuildMember, type Message } from 'discord.js';
import { loadGuildSecrets, loadSettings, saveSettings } from '@moin/db';
import {
  budgetState,
  buildConversation,
  chunkText,
  buildSystemPrompt,
  dashboardGuide,
  settingsToolPrompt,
  wantsDashboardHelp,
  compatBaseUrl,
  COMPAT_PROVIDERS,
  isCompatProvider,
  addRuler,
  juliaUserAllowed,
  findInsult,
  actionAllowed,
  extractActions,
  toolsFor,
  type JuliaAction,
  matchKeywordRules,
  effectiveLimit,
  LIMIT_PERIOD_LABELS,
  LIMIT_UNIT_LABELS,
  limitCheck,
  wordCount,
  type LimitRule,
  parseRoyal,
  parseRoyalCommand,
  removeRuler,
  royalNames,
  royalRuler,
  type JuliaRoyal,
  costMicroUsd,
  DEFAULT_MODE_NAME,
  asksToRemember,
  extractMemory,
  flirtyAllowed,
  flirtyBlockers,
  shouldOfferFlirtyConsent,
  type FlirtyContext,
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
import { recordHeal } from '../../core/self-heal.js';
import { actionPrompt, canCreateAdminRole, juliaHas, onActionButton } from './actions.js';
import { applySetting, canConfigure, isSensitiveSetting, onUndoButton, settingResult, settingsCatalog } from './settings.js';
import { conversationIn, startConversation, stopAllConversations } from './conversation.js';
import { speak } from './voice.js';
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

// ── Limits (im Speicher) ────────────────────────────────────────────────────
const lastAnswer = new Map<string, number>();
const usedMap = new Map<string, { at: number; words: number }[]>();
const DAY = 86_400_000;

/** Darf die Person jetzt fragen? (Regel aus effectiveLimit: pro Person/Rolle/allgemein) */
export function rateCheck(key: string, rule: LimitRule, now = Date.now(), words = 0): 'ok' | 'cooldown' | 'limit' {
  const used = (usedMap.get(key) ?? []).filter((u) => now - u.at < DAY);
  if (used.length) usedMap.set(key, used);
  else usedMap.delete(key);
  return limitCheck(used, lastAnswer.get(key) ?? 0, rule, now, words);
}

function noteAnswer(key: string, words: number, now = Date.now()): void {
  lastAnswer.set(key, now);
  usedMap.set(key, [...(usedMap.get(key) ?? []), { at: now, words }]);
  // Aufräumen: nur Einträge älter als ein Tag
  if (lastAnswer.size > 5_000) {
    for (const [k, at] of lastAnswer) if (now - at > DAY) lastAnswer.delete(k);
    for (const [k, list] of usedMap) if (!list.some((u) => now - u.at < DAY)) usedMap.delete(k);
  }
}

export function resetRateLimits(): void {
  lastAnswer.clear();
  usedMap.clear();
}

// ── Anfrage an den Anbieter ─────────────────────────────────────────────────
type Outcome = ({ kind: 'reply'; parts: string[] } | { kind: 'notice'; key: TranslationKey; vars?: Record<string, string> } | { kind: 'silent' }) & {
  offerFlirty?: boolean;
  actions?: JuliaAction[];
  /** Einstellungen, die sofort geändert werden (nicht heikel) */
  settings?: Extract<JuliaAction, { kind: 'einstellung' }>[];
};

/** Wen Julia schon nach dem Flirt-Ton gefragt hat (nicht nerven): Schlüssel Server:Person → Zeitpunkt */
const flirtyAsked = new Map<string, number>();
const ASK_AGAIN_MS = 30 * 86_400_000;
export function resetFlirtyAsked(): void {
  flirtyAsked.clear();
}

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
    const endpoints = parseOllamaEndpoints(s.ollamaEndpoints, { url: s.ollamaUrl, model: s.ollamaModel });
    const target = resolveOllama(endpoints, config.ollamaEndpointId, ollamaModeModel);
    if (!target) return 'not-connected';
    try {
      return { result: await ollamaComplete({ endpoint: target.endpoint, model: target.model, system, messages }), cost: 0 };
    } catch (error) {
      // Selbstheilung: Endpunkt nicht erreichbar → die anderen eingetragenen der Reihe nach versuchen (mit ihrem Modell)
      if (!(error instanceof JuliaError) || error.kind !== 'unavailable') throw error;
      for (const other of endpoints.filter((e) => e.id !== target.endpoint.id)) {
        try {
          const result = await ollamaComplete({ endpoint: other, model: other.model, system, messages });
          await recordHeal(bot, { area: 'Julia', problem: `Ollama „${target.endpoint.name}“ nicht erreichbar`, action: `ausgewichen auf „${other.name}“` });
          return { result, cost: 0 };
        } catch {
          // nächster
        }
      }
      throw error;
    }
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
/** Anzeigename einer Person (für „wer ist der König“), zwischengespeichert */
const names = new Map<string, { name: string; at: number }>();
async function userName(bot: BotContext, userId: string): Promise<string> {
  const hit = names.get(userId);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.name;
  const user = await bot.client.users.fetch(userId).catch(() => null);
  const name = (user?.globalName ?? user?.username ?? '').slice(0, 40);
  names.set(userId, { name, at: Date.now() });
  return name;
}

async function saveRoyal(bot: BotContext, royal: JuliaRoyal): Promise<void> {
  await saveSettings(bot.prisma, { juliaRoyal: JSON.stringify(royal) });
}

/** Herrscher-Befehl ausführen (Aufrufer hat geprüft: es ist der Instanz-Admin) */
export async function applyRoyal(
  bot: BotContext,
  cmd: NonNullable<ReturnType<typeof parseRoyalCommand>>,
  target: { id: string; name: string } | null,
  locale: Locale,
): Promise<string> {
  const settings = await loadSettings(bot.prisma);
  const royal = parseRoyal(settings.juliaRoyal);
  // Sich selbst „ernennen“ = eigenen Titel ändern; absetzen kann man sich nicht
  if (target && target.id === settings.instanceOwnerId && cmd.action !== 'only') {
    const title = cmd.action === 'add' && cmd.title ? cmd.title : royal.ownerTitle;
    await saveRoyal(bot, { ...royal, ownerTitle: title, ownerName: target.name.slice(0, 40) });
    return t(locale, 'julia.royal.added', { user: `<@${target.id}>`, title });
  }
  if (cmd.action === 'only') {
    await saveRoyal(bot, { ...royal, onlyRulers: cmd.on });
    return t(locale, cmd.on ? 'julia.royal.onlyOn' : 'julia.royal.onlyOff');
  }
  if (!target) return t(locale, 'julia.royal.needUser');
  if (cmd.action === 'remove') {
    await saveRoyal(bot, removeRuler(royal, target.id));
    return t(locale, 'julia.royal.removed', { user: `<@${target.id}>` });
  }
  const title = cmd.title || 'König';
  await saveRoyal(bot, addRuler(royal, { id: target.id, name: target.name, title }));
  return t(locale, 'julia.royal.added', { user: `<@${target.id}>`, title });
}

export async function askJulia(
  bot: BotContext,
  input: {
    guild: Guild;
    member: GuildMember;
    channel: { ids: string[]; nsfw: boolean };
    history: { fromBot: boolean; name: string; text: string }[];
    quietWhenLimited: boolean;
    /** In der Nachricht erwähnte Personen (mögliche Ziele für Julia-Werkzeuge) */
    targets?: { id: string; name: string }[];
  },
): Promise<Outcome> {
  const config = await juliaConfig(bot, input.guild.id);
  const locale = await bot.modules.locale(input.guild.id);
  let profile = await getProfile(bot, input.guild.id, input.member.id);
  if (profile?.optOut) return { kind: 'silent' };
  // Herrscher: instanzweit, nur vom Instanz-Admin festgelegt – keine Server-Einstellung ändert das
  const settings = await loadSettings(bot.prisma).catch(() => null);
  const instanceOwnerId = settings?.instanceOwnerId ?? null;
  const royal = parseRoyal(settings?.juliaRoyal);
  if (!royal.ownerName && instanceOwnerId) royal.ownerName = await userName(bot, instanceOwnerId);
  const ruler = royalRuler(royal, input.member.id, instanceOwnerId);

  // Blacklist/Whitelist (Personen und Rollen) – Herrscher dürfen immer
  if (!ruler && !juliaUserAllowed(config, input.member.id, [...input.member.roles.cache.keys()])) {
    return input.quietWhenLimited ? { kind: 'silent' } : { kind: 'notice', key: 'julia.blocked' };
  }
  if (royal.onlyRulers && !ruler) return input.quietWhenLimited ? { kind: 'silent' } : { kind: 'notice', key: 'julia.onlyRulers' };

  // Altersangabe < 18 → Flirt dauerhaft gesperrt (Code-Entscheidung, nicht Modell)
  const ownText = input.history.at(-1)?.text ?? '';
  if (mentionsUnderage(ownText) && !profile?.underage) profile = await updateProfile(bot, input.member, { underage: true, flirtyOptIn: false });

  // Herrscher haben nie ein Limit; sonst gilt die Regel der Person/Rolle oder das allgemeine Limit – das Monatsbudget gilt trotzdem
  if (!ruler) {
    const key = `${input.guild.id}:${input.member.id}`;
    const words = wordCount(ownText);
    const rule = effectiveLimit(config, input.member.id, [...input.member.roles.cache.keys()]);
    const rate = rateCheck(key, rule, Date.now(), words);
    if (rate === 'cooldown') return input.quietWhenLimited ? { kind: 'silent' } : { kind: 'notice', key: 'julia.cooldown' };
    if (rate === 'limit') {
      return input.quietWhenLimited
        ? { kind: 'silent' }
        : { kind: 'notice', key: 'julia.limit', vars: { amount: rule.amount.toLocaleString('de-DE'), unit: LIMIT_UNIT_LABELS[rule.unit], period: LIMIT_PERIOD_LABELS[rule.period] } };
    }
    // Platz sofort reservieren: Zwei schnelle Nachrichten derselben Person kämen sonst beide durch (= zwei bezahlte Anfragen)
    noteAnswer(key, words);
  }

  if (config.provider === 'anthropic') {
    const usage = await bot.prisma.juliaUsage.findUnique({ where: { guildId_month: { guildId: input.guild.id, month: usageMonth(new Date()) } } });
    if (budgetState(usage?.costMicroUsd ?? 0, config.monthlyBudgetUsd, config.warnAtPercent) === 'blocked') {
      return input.quietWhenLimited ? { kind: 'silent' } : { kind: 'notice', key: 'julia.budget' };
    }
  }

  const messages = buildConversation(input.history);
  if (!messages.length) return { kind: 'silent' };
  const flirtyCtx: FlirtyContext = {
    enabled: config.flirty.enabled,
    adultRoleId: config.flirty.adultRoleId,
    hasAdultRole: !!config.flirty.adultRoleId && input.member.roles.cache.has(config.flirty.adultRoleId),
    nsfwChannel: input.channel.nsfw,
    optIn: profile?.flirtyOptIn ?? false,
    underage: profile?.underage ?? false,
  };
  // Stichwort-Regeln: Zusatzanweisung und ggf. ein anderer Modus nur für diese Antwort
  const matched = matchKeywordRules(config.keywordRules, ownText);
  const ruleMode = matched.map((m) => config.modes.find((x) => x.id === m.rule.modeId)).find(Boolean) ?? null;
  const mode = ruleMode ?? (await activeMode(bot, config, input.guild.id, input.channel.ids));
  const style = mode?.style ?? config.defaultStyle;
  // Der Modus kann Flirten nur abschalten oder betonen – die 18+-Voraussetzungen gelten immer
  const flirty = flirtyAllowed(flirtyCtx) && style.flirty !== 'aus';
  // Fehlt nur die eigene Zustimmung → einmal per Knopf fragen (nicht öfter als alle 30 Tage)
  const askKey = `${input.guild.id}:${input.member.id}`;
  const offerFlirty = style.flirty !== 'aus' && shouldOfferFlirtyConsent(flirtyCtx) && Date.now() - (flirtyAsked.get(askKey) ?? 0) > ASK_AGAIN_MS;
  if (offerFlirty) {
    flirtyAsked.set(askKey, Date.now());
    if (flirtyAsked.size > 5000) for (const [k, at] of flirtyAsked) if (Date.now() - at > ASK_AGAIN_MS) flirtyAsked.delete(k);
  }
  // Werkzeuge: nur mit eingeschalteter Funktion UND den passenden Discord-Rechten der fragenden Person
  const tools = toolsFor(config.tools, juliaHas(input.member, instanceOwnerId));
  const canAdmin = canCreateAdminRole(input.guild, input.member.id, instanceOwnerId);
  // Julia kennt das Dashboard: Wegweiser bei Fragen nach Einstellungen; ändern dürfen Owner/Admins/Instanz-Admin
  const canConf = canConfigure(input.guild, input.member, instanceOwnerId);
  const dashboard = wantsDashboardHelp(ownText) ? [dashboardGuide(settings?.dashboardUrl, input.guild.id), ...(canConf ? [settingsToolPrompt(await settingsCatalog(bot, input.guild.id))] : [])] : [];
  const targets = input.targets ?? [];
  const system = buildSystemPrompt({
    serverName: input.guild.name,
    persona: mode?.persona ?? config.persona,
    length: mode?.length ?? 'kurz',
    creativity: mode?.creativity ?? 'normal',
    memoryEnabled: config.memoryEnabled,
    speaker: { name: input.member.displayName, profile: profileView(profile) },
    flirty,
    ruler,
    loyalTo: royalNames(royal),
    style,
    extraRules: matched.map((m) => ({ word: m.word, instruction: m.rule.instruction })),
    tools: { tools, targets, canAdmin },
    dashboard,
    simple: locale === 'dummies',
  });
  try {
    const done = await complete(bot, input.guild.id, config, mode?.model || config.model, system, messages, mode?.ollamaModel);
    if (done === 'not-connected') return { kind: 'notice', key: 'julia.notConnected' };
    await recordUsage(bot, input.guild, config, done.result, done.cost, locale);
    if (done.result.refused || !done.result.text) return { kind: 'notice', key: 'julia.refused' };
    const remembered = extractMemory(done.result.text);
    const { facts } = remembered;
    const extracted = extractActions(remembered.text);
    const text = extracted.text;
    const targetIds = targets.map((x) => x.id);
    const allowed = extracted.actions.filter((a) => actionAllowed(a, tools, targetIds, { canAdmin, canConfigure: canConf }));
    // Heikle Einstellungen und alle anderen Aktionen: Bestätigungs-Knopf; normale Einstellungen: sofort (mit Rückgängig)
    const settingsNow = allowed.filter((a): a is Extract<JuliaAction, { kind: 'einstellung' }> => a.kind === 'einstellung' && !isSensitiveSetting(a));
    const actions = allowed.filter((a) => !(a.kind === 'einstellung' && !isSensitiveSetting(a)));
    if (config.memoryEnabled && facts.length && asksToRemember(ownText)) await rememberFacts(bot, input.member, facts);
    const extra = { ...(offerFlirty ? { offerFlirty: true } : {}), ...(actions.length ? { actions } : {}), ...(settingsNow.length ? { settings: settingsNow } : {}) };
    if (text) return { kind: 'reply', parts: splitReply(text), ...extra };
    return actions.length || settingsNow.length ? { kind: 'reply', parts: [], ...extra } : { kind: 'notice', key: 'julia.profile.saved' };
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

/**
 * Ab wann zählt der Kanalverlauf? Nach einem Modus-Wechsel und – ohne aktiven Sondermodus – nach einer
 * Persona-Änderung im Dashboard. Sonst ahmt Julia ihre eigenen alten Antworten nach und die neue Persona
 * scheint „nicht zu wirken“.
 */
export function historySince(state: { mode: { id: string } | null; since: Date | null }, config: Pick<JuliaConfig, 'personaChangedAt'>): Date | null {
  const times = [state.since?.getTime() ?? 0, state.mode ? 0 : config.personaChangedAt].filter((x) => x > 0);
  return times.length ? new Date(Math.max(...times)) : null;
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

  // Beleidigungs-Schutz (Issue #5): Nachricht an Julia mit Beleidigung → löschen + melden, keine Antwort.
  // Erkannt im Code (Wortliste), Herrscher sind ausgenommen.
  if (config.insultGuard.enabled) {
    const word = findInsult(ownText, config.insultGuard.extraWords);
    if (word) {
      const s = await loadSettings(bot.prisma).catch(() => null);
      if (!royalRuler(parseRoyal(s?.juliaRoyal), member.id, s?.instanceOwnerId ?? null)) return handleInsult(bot, message, config, word, ownText, locale);
    }
  }

  // „modus <Name>“ (auch „Julia, modus <Name>“) – kein KI-Aufruf, nur umschalten
  const wanted = parseModeCommand(ownText, botNames);
  if (wanted) {
    if (!canSwitchMode(member, config)) return send(message, [t(locale, 'julia.mode.noPermission')]);
    const name = await switchMode(bot, config, message.guildId, message.channelId, wanted, member.id);
    if (!name) return send(message, [t(locale, 'julia.mode.unknown', { name: wanted.slice(0, 30), list: modeList(config) })]);
    return send(message, [t(locale, 'julia.mode.switched', { mode: name }), ...modeGreeting(config, name)]);
  }

  // „ernenne @Max zum König“, „setz @Max ab“, „diene nur noch mir“ – NUR vom Instanz-Admin, ohne KI (nicht überredbar).
  // Bei allen anderen geht es normal weiter (Julia lehnt dann selbst ab).
  const targets = [...message.mentions.users.values()].filter((u) => u.id !== botId && !u.bot);
  const royalCmd = parseRoyalCommand(ownText, targets.length > 0);
  if (royalCmd && (await loadSettings(bot.prisma).catch(() => null))?.instanceOwnerId === member.id) {
    const target = targets[0];
    return send(message, [await applyRoyal(bot, royalCmd, target ? { id: target.id, name: target.globalName ?? target.username } : null, locale)]);
  }

  // Limit schon hier prüfen – sonst kostet jede (ohnehin abgelehnte) Nachricht im Chat-Kanal einen Discord-Abruf des Verlaufs
  if (inChat && !mentioned && rateCheck(`${message.guildId}:${member.id}`, effectiveLimit(config, member.id, [...member.roles.cache.keys()]), Date.now(), wordCount(ownText)) !== 'ok') {
    // Herrscher haben nie ein Limit – nur dafür die Einstellungen laden
    const s = await loadSettings(bot.prisma).catch(() => null);
    if (!royalRuler(parseRoyal(s?.juliaRoyal), member.id, s?.instanceOwnerId ?? null)) return;
  }

  const typing = message.channel.sendTyping().catch(() => undefined);
  const outcome = await askJulia(bot, {
    guild: message.guild,
    member,
    channel: { ids, nsfw: isNsfw(message.channel) },
    history: await channelHistory(bot, message, config.contextMessages, ownText, historySince(await modeState(bot, config, message.guildId, ids), config)),
    quietWhenLimited: inChat && !mentioned,
    targets: targets.map((u) => ({ id: u.id, name: message.guild.members.cache.get(u.id)?.displayName ?? u.globalName ?? u.username })),
  });
  await typing;
  if (outcome.kind === 'silent') return;
  await send(message, outcome.kind === 'reply' ? outcome.parts : [t(locale, outcome.key, outcome.vars)]);
  if (outcome.offerFlirty && message.channel.isSendable()) await message.channel.send(flirtyConsentPrompt(member.id, locale)).catch(() => undefined);
  if (outcome.kind === 'reply' && outcome.actions?.length && message.channel.isSendable()) {
    await message.channel.send(actionPrompt(message.guildId, message.channelId, member.id, outcome.actions, locale)).catch(() => undefined);
  }
  for (const setting of outcome.settings ?? []) {
    const done = await applySetting(bot, message.guild, setting, member.id).catch(() => ({ ok: false, text: 'Das hat nicht geklappt.', undoId: undefined }));
    if (message.channel.isSendable()) await message.channel.send(settingResult(done.text, done.undoId)).catch(() => undefined);
  }
}

/** Beleidigung: löschen (wenn eingestellt und erlaubt), im Log melden, kurzer Hinweis im Kanal (verschwindet nach 10 s) */
export async function handleInsult(bot: BotContext, message: Message<true>, config: JuliaConfig, word: string, text: string, locale: Locale): Promise<void> {
  const deleted = config.insultGuard.deleteMessage && message.deletable ? await message.delete().then(() => true, () => false) : false;
  const logId = config.insultGuard.logChannelId || config.logChannelId;
  const log = logId ? message.guild.channels.cache.get(logId) : undefined;
  if (log?.isSendable()) {
    const description = t(locale, 'julia.insult.logText', {
      user: `<@${message.author.id}> (${message.author.username})`,
      channel: `<#${message.channelId}>`,
      word,
      deleted: t(locale, deleted ? 'julia.insult.yes' : 'julia.insult.no'),
      text: text.slice(0, 500).replaceAll('\n', '\n> '),
    });
    await log.send({ embeds: [{ color: 0xff5d7a, title: t(locale, 'julia.insult.logTitle'), description, timestamp: new Date().toISOString() }], allowedMentions: { parse: [] } }).catch(() => undefined);
  }
  if (message.channel.isSendable()) {
    const notice = await message.channel.send({ content: t(locale, 'julia.insult.notice', { user: `<@${message.author.id}>` }), allowedMentions: { users: [message.author.id] } }).catch(() => null);
    if (notice) setTimeout(() => void notice.delete().catch(() => undefined), 10_000).unref?.();
  }
}

/** Begrüßung des Modus (beim Umschalten) – leer = keine */
function modeGreeting(config: JuliaConfig, modeName: string): string[] {
  const style = config.modes.find((m) => m.name === modeName)?.style ?? (modeName === DEFAULT_MODE_NAME ? config.defaultStyle : null);
  const greeting = style?.greeting.trim();
  return greeting ? [greeting.replaceAll('@', '@\u200b').slice(0, 300)] : [];
}

/** Zustimmungs-Frage mit zwei Knöpfen – nur die gemeinte Person kann drücken */
export function flirtyConsentPrompt(userId: string, locale: Locale) {
  return {
    content: t(locale, 'julia.flirty.ask', { user: `<@${userId}>` }),
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`julia:flirt:yes:${userId}`).setStyle(ButtonStyle.Success).setEmoji('😉').setLabel(t(locale, 'julia.flirty.yes')),
        new ButtonBuilder().setCustomId(`julia:flirt:no:${userId}`).setStyle(ButtonStyle.Secondary).setLabel(t(locale, 'julia.flirty.no')),
      ),
    ],
    allowedMentions: { users: [userId] },
  };
}

/** Knopf „Ich stimme zu“ / „Nein danke“ */
async function onFlirtyButton(ctx: Parameters<NonNullable<BotModule['onComponent']>>[0]): Promise<void> {
  const { interaction, args, locale, bot } = ctx;
  if (!interaction.isButton()) return;
  const [answer, userId] = args;
  if (interaction.user.id !== userId) return void (await interaction.reply({ content: t(locale, 'julia.flirty.notYours'), flags: MessageFlags.Ephemeral }));
  const config = await juliaConfig(bot, interaction.guildId);
  const member = interaction.member;
  const profile = await getProfile(bot, interaction.guildId, member.id);
  const user = `<@${member.id}>`;
  if (answer === 'no') {
    flirtyAsked.set(`${interaction.guildId}:${member.id}`, Date.now());
    await updateProfile(bot, member, { flirtyOptIn: false });
    return void (await interaction.update({ content: t(locale, 'julia.flirty.declined', { user }), components: [], allowedMentions: { parse: [] } }));
  }
  // Voraussetzungen noch einmal prüfen (Rolle könnte inzwischen weg sein)
  if (!config.flirty.enabled || !config.flirty.adultRoleId) return void (await interaction.reply({ content: t(locale, 'julia.flirty.disabled'), flags: MessageFlags.Ephemeral }));
  if (profile?.underage) return void (await interaction.reply({ content: t(locale, 'julia.flirty.blocked'), flags: MessageFlags.Ephemeral }));
  if (!member.roles.cache.has(config.flirty.adultRoleId)) {
    return void (await interaction.reply({ content: t(locale, 'julia.flirty.needRole', { role: `<@&${config.flirty.adultRoleId}>` }), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } }));
  }
  await updateProfile(bot, member, { flirtyOptIn: true });
  await interaction.update({ content: t(locale, 'julia.flirty.accepted', { user }), components: [], allowedMentions: { parse: [] } });
}

/** „warum flirtet Julia (nicht)?“ als lesbare Zeile */
export function flirtyStatusText(ctx: FlirtyContext, locale: Locale): string {
  const missing = flirtyBlockers(ctx);
  return t(locale, 'julia.flirty.why', { status: missing.length ? missing.map((b) => `❌ ${t(locale, `julia.flirty.b.${b}` as TranslationKey)}`).join(' · ') : t(locale, 'julia.flirty.ok') });
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
          .setName('sprich')
          .setNameLocalizations(en('speak'))
          .setDescription(x('julia.cmd.speak').de)
          .setDescriptionLocalizations(x('julia.cmd.speak').loc)
          .addStringOption((o) => o.setName('text').setDescription(x('julia.cmd.question').de).setDescriptionLocalizations(x('julia.cmd.question').loc).setRequired(true).setMaxLength(1500)),
      )
      .addSubcommand((s) =>
        s
          .setName('gespraech')
          .setNameLocalizations(en('talk'))
          .setDescription(x('julia.cmd.talk').de)
          .setDescriptionLocalizations(x('julia.cmd.talk').loc)
          .addStringOption((o) =>
            o
              .setName('aktion')
              .setDescription(x('julia.cmd.talkAction').de)
              .setDescriptionLocalizations(x('julia.cmd.talkAction').loc)
              .setRequired(true)
              .addChoices({ name: 'starten – Julia hört im Sprachkanal zu', value: 'start' }, { name: 'beenden', value: 'stop' }),
          ),
      )
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
              .addChoices(
                { name: 'an', name_localizations: en('on'), value: 'an' },
                { name: 'aus', name_localizations: en('off'), value: 'aus' },
                { name: 'prüfen (warum flirtet Julia nicht?)', name_localizations: en('check (why no flirting?)'), value: 'pruefen' },
              ),
          )
          .addIntegerOption((o) => o.setName('alter').setNameLocalizations(en('age')).setDescription(x('julia.cmd.age').de).setDescriptionLocalizations(x('julia.cmd.age').loc).setMinValue(1).setMaxValue(120)),
      )
      .addSubcommand((s) => s.setName('status').setDescription(x('julia.cmd.status').de).setDescriptionLocalizations(x('julia.cmd.status').loc))
      .addSubcommand((s) =>
        s
          .setName('herrscher')
          .setNameLocalizations(en('rulers'))
          .setDescription(x('julia.cmd.royal').de)
          .setDescriptionLocalizations(x('julia.cmd.royal').loc)
          .addStringOption((o) =>
            o
              .setName('aktion')
              .setNameLocalizations(en('action'))
              .setDescription(x('julia.cmd.royalAction').de)
              .setDescriptionLocalizations(x('julia.cmd.royalAction').loc)
              .setRequired(true)
              .addChoices(
                { name: 'ernennen', value: 'add', name_localizations: en('crown') },
                { name: 'absetzen', value: 'remove', name_localizations: en('remove') },
                { name: 'liste', value: 'list', name_localizations: en('list') },
                { name: 'nur Herrschern dienen', value: 'only-on', name_localizations: en('serve rulers only') },
                { name: 'allen dienen', value: 'only-off', name_localizations: en('serve everyone') },
              ),
          )
          .addUserOption((o) => o.setName('person').setNameLocalizations(en('person')).setDescription(x('julia.cmd.royalUser').de).setDescriptionLocalizations(x('julia.cmd.royalUser').loc))
          .addStringOption((o) =>
            o.setName('titel').setNameLocalizations(en('title')).setDescription(x('julia.cmd.royalTitle').de).setDescriptionLocalizations(x('julia.cmd.royalTitle').loc).setMinLength(2).setMaxLength(40),
          ),
      )
      .toJSON();
  })(),
  async execute({ interaction, locale, bot }: CommandContext) {
    if (!interaction.inCachedGuild()) return;
    const config = await juliaConfig(bot, interaction.guildId);
    const member = interaction.member;
    const sub = interaction.options.getSubcommand();
    const ephemeral = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

    if (sub === 'herrscher') {
      // Nur der Instanz-Admin – egal welche Rechte jemand auf dem Server hat
      const settings = await loadSettings(bot.prisma).catch(() => null);
      if (!settings?.instanceOwnerId || settings.instanceOwnerId !== interaction.user.id) return void (await ephemeral(t(locale, 'julia.royal.noPermission')));
      const action = interaction.options.getString('aktion', true);
      if (action === 'list') {
        const royal = parseRoyal(settings.juliaRoyal);
        const list = [`<@${settings.instanceOwnerId}> („${royal.ownerTitle}“)`, ...royal.rulers.map((r) => `<@${r.id}> („${r.title}“)`)].join(', ');
        return void (await ephemeral(t(locale, 'julia.royal.list', { list, only: royal.onlyRulers ? t(locale, 'julia.royal.onlyHint') : '' })));
      }
      const person = interaction.options.getUser('person');
      const cmd =
        action === 'only-on' || action === 'only-off'
          ? ({ action: 'only', on: action === 'only-on' } as const)
          : action === 'remove'
            ? ({ action: 'remove' } as const)
            : ({ action: 'add', title: interaction.options.getString('titel') } as const);
      return void (await interaction.reply({
        content: await applyRoyal(bot, cmd, person ? { id: person.id, name: person.globalName ?? person.username } : null, locale),
        allowedMentions: { parse: [] },
      }));
    }

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
      return void (await interaction.reply({ content: [t(locale, 'julia.mode.switched', { mode: name }), ...modeGreeting(config, name)].join('\n'), allowedMentions: { parse: [] } }));
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
      if (interaction.options.getString('status', true) === 'pruefen') {
        const profile = await getProfile(bot, interaction.guildId, member.id);
        const channel = interaction.channel;
        return void (await ephemeral(
          flirtyStatusText(
            {
              enabled: config.flirty.enabled,
              adultRoleId: config.flirty.adultRoleId,
              hasAdultRole: !!config.flirty.adultRoleId && member.roles.cache.has(config.flirty.adultRoleId),
              nsfwChannel: channel ? isNsfw(channel) : false,
              optIn: profile?.flirtyOptIn ?? false,
              underage: profile?.underage ?? false,
            },
            locale,
          ),
        ));
      }
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

    if (sub === 'gespraech') {
      // Mit Julia im Call reden: nur auf Befehl, mit Ansage; beenden darf jede Person im Kanal (und wer Kanäle verwalten darf)
      if (interaction.options.getString('aktion', true) === 'stop') {
        const talk = conversationIn(interaction.guildId);
        if (!talk) return void (await ephemeral(t(locale, 'julia.talk.notRunning')));
        if (member.voice.channelId !== talk.channel.id && !member.permissions.has(PermissionFlagsBits.ManageChannels)) return void (await ephemeral(t(locale, 'julia.talk.stopNotIn')));
        await interaction.reply({ content: t(locale, 'julia.talk.stopping'), allowedMentions: { parse: [] } });
        await talk.stop(`beendet von ${member.displayName}`);
        return;
      }
      const text = interaction.channel;
      if (!text?.isSendable()) return void (await ephemeral(t(locale, 'julia.talk.failed')));
      await interaction.deferReply();
      const ask = async (who: GuildMember, q: string, channelId: string): Promise<string | null> => {
        const outcome = await askJulia(bot, { guild: interaction.guild, member: who, channel: { ids: [channelId], nsfw: false }, history: [{ fromBot: false, name: who.displayName, text: q }], quietWhenLimited: false });
        return outcome.kind === 'reply' ? outcome.parts.join(' ') : outcome.kind === 'notice' ? t(locale, outcome.key, outcome.vars) : null;
      };
      const result = await startConversation(bot, member, text as typeof text & { id: string }, config.voice, ask);
      await interaction.editReply({ content: t(locale, `julia.talk.${result}` as TranslationKey, { channel: member.voice.channel ? `<#${member.voice.channel.id}>` : '' }), allowedMentions: { parse: [] } });
      return;
    }

    // frage / sprich
    const question = interaction.options.getString('text', true);
    const speakIt = sub === 'sprich';
    if (speakIt) {
      const voiceConfig = (await juliaConfig(bot, interaction.guildId)).voice;
      if (!voiceConfig.enabled) return void (await ephemeral(t(locale, 'julia.speak.off')));
      if (!member.voice.channel) return void (await ephemeral(t(locale, 'julia.speak.noVoice')));
    }
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
    const text = outcome.kind === 'reply' ? outcome.parts : outcome.kind === 'notice' ? [t(locale, outcome.key, outcome.vars)] : [t(locale, 'julia.optout.done')];
    // Zitat + Antwort neu auf Nachrichten à 2000 Zeichen verteilen – nichts darf in der Mitte wegfallen
    const chunks = chunkText(`${quote}${text.join('\n')}`, 2000);
    await interaction.editReply({ content: chunks[0] ?? quote, allowedMentions: { parse: [] } });
    for (const chunk of chunks.slice(1, 3)) await interaction.followUp({ content: chunk, allowedMentions: { parse: [] } });
    if (outcome.kind === 'reply' && outcome.actions?.length) await interaction.followUp(actionPrompt(interaction.guildId, interaction.channelId, member.id, outcome.actions, locale));
    for (const setting of outcome.settings ?? []) {
      const done = await applySetting(bot, interaction.guild, setting, member.id).catch(() => ({ ok: false, text: 'Das hat nicht geklappt.', undoId: undefined }));
      await interaction.followUp(settingResult(done.text, done.undoId)).catch(() => undefined);
    }
    // Julia spricht die Antwort im Sprachkanal der Person (Text steht trotzdem da)
    if (speakIt && outcome.kind === 'reply') {
      const result = await speak(bot, interaction.guildId, member.voice.channel, (await juliaConfig(bot, interaction.guildId)).voice, outcome.parts.join(' '));
      if (result !== 'spoken') await interaction.followUp({ content: t(locale, `julia.speak.${result}` as TranslationKey), flags: MessageFlags.Ephemeral }).catch(() => undefined);
    }
  },
};

export const juliaModule: BotModule = {
  id: 'julia',
  commands: [juliaCommand],
  // Wartung: laufende Gespräche im Sprachkanal beenden
  onMaintenance(_bot, on) {
    if (on) void stopAllConversations('Wartung');
  },
  async onComponent(ctx) {
    if (ctx.action === 'flirt') return onFlirtyButton(ctx);
    if (ctx.action === 'act') return onActionButton(ctx);
    if (ctx.action === 'undo') return onUndoButton(ctx, (await loadSettings(ctx.bot.prisma).catch(() => null))?.instanceOwnerId);
  },
  setup({ bot, on }) {
    on(
      'messageCreate',
      (m) => m.guildId,
      (m) => void onMessage(bot, m).catch((error: unknown) => bot.logger.warn({ err: error }, 'Julia: Nachricht fehlgeschlagen')),
    );
  },
};
