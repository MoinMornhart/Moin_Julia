import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { clearSettings, loadSettings, saveSettings } from '@moin/db';
import { t } from '@moin/shared';
import type { BotModule } from '../../core/types.js';

/**
 * Kern: Befehle, die es auf jedem Server immer gibt (unabhängig von den Modul-Schaltern).
 * /moin zugang – Generalschlüssel des Instanz-Admins: an/aus/Link. Mit „an“ hat er auf jedem Server mit
 * dem Bot Admin-Zugriff aufs Dashboard (nicht auf den Owner-Bereich). Jeder solche Zugriff wird im
 * Log-Kanal des Servers vermerkt (macht das Dashboard).
 */
const en = (name: string) => ({ 'en-US': name, 'en-GB': name });

export const kernModule: BotModule = {
  id: 'kern',
  alwaysOn: true,
  commands: [
    {
      data: new SlashCommandBuilder()
        .setName('moin')
        .setDescription(t('de', 'kern.cmd.root'))
        .setDescriptionLocalizations({ 'en-US': t('en', 'kern.cmd.root'), 'en-GB': t('en', 'kern.cmd.root') })
        .addSubcommand((s) =>
          s
            .setName('zugang')
            .setNameLocalizations(en('access'))
            .setDescription(t('de', 'kern.cmd.access'))
            .setDescriptionLocalizations({ 'en-US': t('en', 'kern.cmd.access'), 'en-GB': t('en', 'kern.cmd.access') })
            .addStringOption((o) =>
              o
                .setName('aktion')
                .setNameLocalizations(en('action'))
                .setDescription(t('de', 'kern.cmd.accessAction'))
                .setDescriptionLocalizations({ 'en-US': t('en', 'kern.cmd.accessAction'), 'en-GB': t('en', 'kern.cmd.accessAction') })
                .setRequired(true)
                .addChoices(
                  { name: 'an', name_localizations: en('on'), value: 'an' },
                  { name: 'aus', name_localizations: en('off'), value: 'aus' },
                  { name: 'link', value: 'link' },
                ),
            ),
        )
        .toJSON(),
      async execute({ interaction, locale, bot }) {
        const ephemeral = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
        const settings = await loadSettings(bot.prisma);
        // Nur der Instanz-Admin – egal welche Rechte jemand auf dem Server hat
        if (!settings.instanceOwnerId || settings.instanceOwnerId !== interaction.user.id) return void (await ephemeral(t(locale, 'kern.access.noPermission')));
        const action = interaction.options.getString('aktion', true);
        const link = settings.dashboardUrl && interaction.guildId ? `${settings.dashboardUrl.replace(/\/+$/, '')}/g/${interaction.guildId}` : '';
        if (action === 'aus') {
          await clearSettings(bot.prisma, ['masterAccess']);
          return void (await ephemeral(t(locale, 'kern.access.off')));
        }
        if (action === 'an') await saveSettings(bot.prisma, { masterAccess: 'true' });
        const on = action === 'an' || settings.masterAccess === 'true';
        return void (await ephemeral([t(locale, on ? 'kern.access.on' : 'kern.access.isOff'), link].filter(Boolean).join('\n')));
      },
    },
  ],
};
