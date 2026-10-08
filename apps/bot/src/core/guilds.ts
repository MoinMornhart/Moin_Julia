import type { Guild } from 'discord.js';
import type { BotContext } from './types.js';

function guildData(guild: Guild) {
  return { name: guild.name, icon: guild.icon, ownerId: guild.ownerId, botPresent: true };
}

export async function upsertGuild(bot: BotContext, guild: Guild): Promise<void> {
  await bot.prisma.guild.upsert({
    where: { id: guild.id },
    create: { id: guild.id, ...guildData(guild) },
    update: guildData(guild),
  });
}

/** Gleicht beim Start alle Server mit der Datenbank ab. */
export async function syncAllGuilds(bot: BotContext): Promise<void> {
  const guilds = [...bot.client.guilds.cache.values()];
  for (const guild of guilds) {
    await upsertGuild(bot, guild);
  }
  await bot.prisma.guild.updateMany({
    where: { id: { notIn: guilds.map((g) => g.id) }, botPresent: true },
    data: { botPresent: false },
  });
}

export async function markGuildLeft(bot: BotContext, guildId: string): Promise<void> {
  await bot.prisma.guild.updateMany({ where: { id: guildId }, data: { botPresent: false } });
  bot.modules.invalidate(guildId);
}
