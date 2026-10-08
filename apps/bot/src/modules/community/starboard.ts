import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, type Message, type MessageActionRowComponentBuilder, type MessageReaction, type PartialMessageReaction } from 'discord.js';
import { t, type CommunityConfig } from '@moin/shared';
import type { BotContext } from '../../core/types.js';
import { communityConfig } from './shared.js';

/** Passt die Reaktion zum eingestellten Emoji? (Unicode-Emoji oder eigenes Emoji per Name/ID/<:name:id>) */
export function matchesEmoji(configured: string, reaction: { name: string | null; id: string | null }): boolean {
  const c = configured.trim();
  if (reaction.id) return c === reaction.id || c === reaction.name || c.includes(`:${reaction.id}>`);
  return c === reaction.name;
}

/** Wie viele zählen? Eigene Reaktion zählt nur, wenn erlaubt; Bots nie. */
export function countStars(userIds: string[], authorId: string, selfStar: boolean, botIds: Set<string>): number {
  return userIds.filter((id) => !botIds.has(id) && (selfStar || id !== authorId)).length;
}

function starEmbed(message: Message, stars: number, emoji: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xffc857)
    .setAuthor({ name: message.member?.displayName ?? message.author.username, iconURL: message.author.displayAvatarURL() })
    .setDescription(message.content ? message.content.slice(0, 4000) : null)
    .addFields({ name: '​', value: `${emoji} **${stars}** · <#${message.channelId}>` })
    .setTimestamp(message.createdAt);
  const image = message.attachments.find((a) => a.contentType?.startsWith('image/'));
  if (image) embed.setImage(image.url);
  return embed;
}

export async function onStarReaction(bot: BotContext, raw: MessageReaction | PartialMessageReaction): Promise<void> {
  const reaction = raw.partial ? await raw.fetch().catch(() => null) : raw;
  if (!reaction) return;
  const message = reaction.message.partial ? await reaction.message.fetch().catch(() => null) : reaction.message;
  if (!message?.inGuild()) return;
  const config: CommunityConfig = await communityConfig(bot, message.guildId);
  const cfg = config.starboard;
  if (!cfg.enabled || !cfg.channelId || message.channelId === cfg.channelId) return;
  if (cfg.ignoredChannelIds.includes(message.channelId) || (message.channel.isThread() && cfg.ignoredChannelIds.includes(message.channel.parentId ?? ''))) return;
  if (!matchesEmoji(cfg.emoji, reaction.emoji)) return;

  const users = await reaction.users.fetch().catch(() => null);
  if (!users) return;
  const bots = new Set(users.filter((u) => u.bot).map((u) => u.id));
  const stars = countStars([...users.keys()], message.author.id, cfg.selfStar, bots);
  const board = message.guild.channels.cache.get(cfg.channelId);
  if (!board?.isSendable() || !board.isTextBased()) return;
  // Nichts aus versteckten Kanälen (Team, Tickets, Owner-Bereich) oder NSFW-Kanälen in ein offeneres Starboard holen
  const everyone = message.guild.roles.everyone;
  const publicFor = (ch: unknown) => {
    const perms = (ch as { permissionsFor?: (r: typeof everyone) => { has: (p: bigint) => boolean } | null }).permissionsFor?.(everyone);
    return perms ? perms.has(PermissionFlagsBits.ViewChannel) : true;
  };
  if (publicFor(board) && !publicFor(message.channel)) return;
  const nsfw = (ch: unknown) => !!(ch as { nsfw?: boolean; parent?: { nsfw?: boolean } | null }).nsfw || !!(ch as { parent?: { nsfw?: boolean } | null }).parent?.nsfw;
  if (nsfw(message.channel) && !nsfw(board)) return;
  const locale = await bot.modules.locale(message.guildId);
  const entry = await bot.prisma.starboardEntry.findUnique({ where: { messageId: message.id } });
  const emojiText = reaction.emoji.id ? `<${reaction.emoji.animated ? 'a' : ''}:${reaction.emoji.name}:${reaction.emoji.id}>` : (reaction.emoji.name ?? '⭐');
  const payload = {
    embeds: [starEmbed(message, stars, emojiText)],
    components: [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(t(locale, 'community.star.jump')).setURL(message.url))],
    allowedMentions: { parse: [] as const },
  };

  if (!entry) {
    if (stars < cfg.threshold) return;
    // Erst den Eintrag anlegen (eindeutige messageId), damit zwei gleichzeitige Reaktionen nicht doppelt posten
    const created = await bot.prisma.starboardEntry.create({ data: { guildId: message.guildId, messageId: message.id, channelId: message.channelId, stars } }).catch(() => null);
    if (!created) return;
    const posted = await board.send(payload).catch(() => null);
    if (posted) await bot.prisma.starboardEntry.update({ where: { id: created.id }, data: { starboardMessageId: posted.id } });
    return;
  }
  await bot.prisma.starboardEntry.update({ where: { id: entry.id }, data: { stars } });
  if (!entry.starboardMessageId) return;
  const posted = await board.messages.fetch(entry.starboardMessageId).catch(() => null);
  if (!posted) return;
  if (stars < cfg.threshold) await posted.delete().catch(() => undefined);
  else await posted.edit(payload).catch(() => undefined);
  if (stars < cfg.threshold) await bot.prisma.starboardEntry.delete({ where: { id: entry.id } }).catch(() => undefined);
}
