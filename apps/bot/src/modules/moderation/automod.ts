import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  PermissionFlagsBits,
  type AutoModerationActionExecution,
  type AutoModerationActionOptions,
  type AutoModerationRuleCreateOptions,
  type Guild,
  type Message,
} from 'discord.js';
import { t, type ModerationConfig } from '@moin/shared';
import type { BotContext } from '../../core/types.js';
import { moderate } from './actions.js';
import { moderationConfig } from './cases.js';
import { desiredNativeRules, isCapsViolation, ruleKeyFromName, SpamTracker, type NativeRule } from './logic.js';

/**
 * Gleicht die Discord-eigenen AutoMod-Regeln mit den Einstellungen ab:
 * eigene Regeln (erkennbar am Namen „Moin_Julia · …“) werden angelegt, geändert oder gelöscht.
 * Fremde Regeln des Servers bleiben unangetastet.
 */
export async function syncNativeRules(bot: BotContext, guild: Guild): Promise<void> {
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    bot.logger.warn({ guildId: guild.id }, 'AutoMod-Regeln: Recht „Server verwalten“ fehlt');
    return;
  }
  const enabled = await bot.modules.isEnabled(guild.id, 'moderation');
  const config = await moderationConfig(bot, guild.id);
  const locale = await bot.modules.locale(guild.id);
  const desired = enabled ? desiredNativeRules(locale, config.automod) : [];

  const existing = await guild.autoModerationRules.fetch();
  const ours = new Map<NativeRule['key'], (typeof existing extends Map<string, infer R> ? R : never)>();
  for (const rule of existing.values()) {
    const key = ruleKeyFromName(rule.name);
    if (key) ours.set(key, rule);
  }

  const reason = 'Moin_Julia Dashboard';
  for (const rule of desired) {
    const options = ruleOptions(rule, config, locale === 'de' ? t('de', 'mod.auto.blockedMessage') : t('en', 'mod.auto.blockedMessage'));
    const current = ours.get(rule.key);
    try {
      if (current) {
        await current.edit({ ...options, reason });
        ours.delete(rule.key);
      } else {
        await guild.autoModerationRules.create({ ...options, reason });
      }
    } catch (error) {
      // Typische Ursache: Server hat schon eine eigene Mention-Spam-Regel (Discord erlaubt nur eine)
      bot.logger.warn({ err: error, guildId: guild.id, rule: rule.key }, 'AutoMod-Regel konnte nicht gespeichert werden');
    }
  }
  // Übrig gebliebene eigene Regeln sind abgeschaltet → löschen
  for (const rule of ours.values()) {
    await rule.delete(reason).catch((error: unknown) => bot.logger.warn({ err: error, guildId: guild.id }, 'AutoMod-Regel nicht gelöscht'));
  }
}

function ruleOptions(rule: NativeRule, config: ModerationConfig, blockedMessage: string): AutoModerationRuleCreateOptions {
  const actions: AutoModerationActionOptions[] = [
    { type: AutoModerationActionType.BlockMessage, metadata: { customMessage: blockedMessage.slice(0, 150) } },
  ];
  if (config.modLogChannelId) actions.push({ type: AutoModerationActionType.SendAlertMessage, metadata: { channel: config.modLogChannelId } });
  return {
    name: rule.name,
    eventType: AutoModerationRuleEventType.MessageSend,
    triggerType: rule.triggerType,
    triggerMetadata: {
      keywordFilter: rule.keywordFilter,
      regexPatterns: rule.regexPatterns,
      allowList: rule.allowList,
      mentionTotalLimit: rule.mentionTotalLimit,
      mentionRaidProtectionEnabled: rule.triggerType === 5 ? true : undefined,
    },
    actions,
    enabled: true,
    exemptRoles: config.automod.exemptRoleIds,
    exemptChannels: config.automod.exemptChannelIds,
  };
}

/** Treffer einer Discord-AutoMod-Regel → auf Wunsch Verwarnung (einmal pro Treffer, nicht pro Aktion). */
export async function onNativeExecution(bot: BotContext, execution: AutoModerationActionExecution): Promise<void> {
  if (execution.action.type !== AutoModerationActionType.BlockMessage) return;
  const config = await moderationConfig(bot, execution.guild.id);
  if (!config.automod.warnOnNativeHit) return;
  const rule = execution.autoModerationRule ?? (await execution.guild.autoModerationRules.fetch(execution.ruleId).catch(() => null));
  if (!rule || !ruleKeyFromName(rule.name)) return;
  const member = await execution.guild.members.fetch(execution.userId).catch(() => null);
  if (!member) return;
  const locale = await bot.modules.locale(execution.guild.id);
  await moderate(bot, {
    guild: execution.guild,
    type: 'WARN',
    targetUser: member.user,
    targetMember: member,
    moderator: null,
    reason: t(locale, 'mod.auto.nativeReason', { rule: rule.name.replace(/^Moin_Julia · /, '') }),
    source: 'automod',
  }).catch((error: unknown) => bot.logger.warn({ err: error }, 'Automod-Verwarnung fehlgeschlagen'));
}

const spam = new SpamTracker();
setInterval(() => spam.sweep(Date.now(), 120_000), 60_000).unref();

/** Bot-seitige Prüfung jeder Nachricht auf Spam und Caps. */
export async function checkMessage(bot: BotContext, message: Message<true>): Promise<void> {
  if (message.author.bot || !message.member) return;
  const config = await moderationConfig(bot, message.guildId);
  const { automod } = config;
  if (!automod.spam.enabled && !automod.caps.enabled) return;
  // Moderatoren und Ausnahmen werden nicht geprüft
  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;
  if (automod.exemptChannelIds.includes(message.channelId)) return;
  if (message.member.roles.cache.some((r) => automod.exemptRoleIds.includes(r.id))) return;

  const locale = await bot.modules.locale(message.guildId);
  let violation: { reason: string; action: typeof automod.spam.action; timeoutMin: number } | null = null;

  if (automod.spam.enabled) {
    const key = `${message.guildId}:${message.author.id}`;
    const count = spam.hit(key, Date.now(), automod.spam.perSeconds * 1000);
    if (count > automod.spam.maxMessages) {
      spam.reset(key);
      violation = {
        reason: t(locale, 'mod.auto.spamReason', { count, seconds: automod.spam.perSeconds }),
        action: automod.spam.action,
        timeoutMin: automod.spam.timeoutMin,
      };
    }
  }
  if (!violation && automod.caps.enabled && isCapsViolation(message.content, automod.caps.minLength, automod.caps.percent)) {
    violation = { reason: t(locale, 'mod.auto.capsReason'), action: automod.caps.action, timeoutMin: automod.spam.timeoutMin };
  }
  if (!violation) return;

  await message.delete().catch(() => undefined);
  if (violation.action === 'delete') {
    const notice = await message.channel
      .send({ content: t(locale, 'mod.auto.notice', { user: `<@${message.author.id}>` }), allowedMentions: { users: [message.author.id] } })
      .catch(() => null);
    if (notice) setTimeout(() => void notice.delete().catch(() => undefined), 6000);
    return;
  }
  await moderate(bot, {
    guild: message.guild,
    type: violation.action === 'delete_timeout' ? 'TIMEOUT' : 'WARN',
    targetUser: message.author,
    targetMember: message.member,
    moderator: null,
    reason: violation.reason,
    durationMs: violation.action === 'delete_timeout' ? violation.timeoutMin * 60_000 : undefined,
    source: 'automod',
  }).catch((error: unknown) => bot.logger.warn({ err: error, guildId: message.guildId }, 'Automod-Aktion fehlgeschlagen'));
}
