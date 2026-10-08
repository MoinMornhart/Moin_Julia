import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { t } from '@moin/shared';
import type { BotModule } from '../../core/types.js';

export const BRAND_COLOR = 0xff7a59;

export const allgemeinModule: BotModule = {
  id: 'allgemein',
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription(t('de', 'ping.description'))
        .setDescriptionLocalizations({ 'en-US': t('en', 'ping.description'), 'en-GB': t('en', 'ping.description') })
        .toJSON(),
      async execute({ interaction, locale, bot }) {
        const started = Date.now();
        await interaction.deferReply();
        const roundtrip = Date.now() - started;

        const dbStarted = Date.now();
        await bot.prisma.$queryRaw`SELECT 1`;
        const database = Date.now() - dbStarted;

        const embed = new EmbedBuilder()
          .setColor(BRAND_COLOR)
          .setTitle(t(locale, 'ping.title'))
          .addFields(
            { name: t(locale, 'ping.gateway'), value: `${Math.max(bot.client.ws.ping, 0)} ms`, inline: true },
            { name: t(locale, 'ping.roundtrip'), value: `${roundtrip} ms`, inline: true },
            { name: t(locale, 'ping.database'), value: `${database} ms`, inline: true },
          )
          .setFooter({ text: `Moin_Julia · ${t(locale, 'ping.version')} ${bot.version}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      },
    },
  ],
};
