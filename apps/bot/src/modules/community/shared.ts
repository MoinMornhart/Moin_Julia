import { PermissionFlagsBits, type GuildMember } from 'discord.js';
import { parseCommunityConfig, t, type CommunityConfig, type TranslationKey } from '@moin/shared';
import type { BotContext } from '../../core/types.js';

export function communityConfig(bot: BotContext, guildId: string): Promise<CommunityConfig> {
  return bot.modules.config(guildId, 'community', parseCommunityConfig);
}

/** „Server verwalten“ oder eine der Manager-Rollen */
export function isManager(member: GuildMember, config: Pick<CommunityConfig, 'managerRoleIds'>): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  return config.managerRoleIds.some((id) => member.roles.cache.has(id));
}

/** Beschreibung/Name für Slash-Befehle in DE + EN */
export function d(key: TranslationKey) {
  return { de: t('de', key), loc: { 'en-US': t('en', key), 'en-GB': t('en', key) } };
}

export const discordTime = (date: Date, style: 'R' | 'f' | 'D' = 'R') => `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
