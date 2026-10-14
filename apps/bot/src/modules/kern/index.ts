import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, Routes, SlashCommandBuilder } from 'discord.js';
import { clearSettings, loadSettings, saveSettings } from '@moin/db';
import { botInviteUrl, guildInstallConfig, hasGuildInstall, parseLoggingConfig, SUPPORT_DURATIONS, supportAccessKey, supportUntilText, t, type SupportAccess, type SupportDuration } from '@moin/shared';
import type { BotModule } from '../../core/types.js';

/**
 * Kern: Befehle, die es auf jedem Server immer gibt (unabhängig von den Modul-Schaltern).
 * /moin zugang – Generalschlüssel des Instanz-Admins: an/aus/Link. Mit „an“ hat er auf jedem Server mit
 * dem Bot vollen Owner-Zugriff aufs Dashboard (auch den Owner-Bereich). Jeder solche Zugriff wird im
 * Log-Kanal des Servers vermerkt (macht das Dashboard).
 */
const en = (name: string) => ({ 'en-US': name, 'en-GB': name });

export const kernModule: BotModule = {
  id: 'kern',
  alwaysOn: true,
  // Knopf „App hinzufügen“ im Discord-Profil von Julia (Wunsch Philip, 14.10.): einmal einrichten, wenn noch nichts eingestellt ist
  async onReady(bot) {
    try {
      const app = (await bot.client.rest.get(Routes.currentApplication())) as { bot_public?: boolean; custom_install_url?: string | null; install_params?: unknown; integration_types_config?: Record<string, { oauth2_install_params?: unknown }> | null };
      if (hasGuildInstall(app)) return; // schon eingerichtet – nichts überschreiben
      if (app.bot_public === false) {
        // Private Bots dürfen keinen Profil-Knopf haben (Discord-Regel)
        bot.logger.warn('Knopf „App hinzufügen“ fehlt: Der Bot ist privat. Developer Portal → Bot → „Public Bot“ an, dann Bot neu starten.');
        return;
      }
      await bot.client.rest.patch(Routes.currentApplication(), { body: { integration_types_config: { ...(app.integration_types_config ?? {}), ...guildInstallConfig() } } });
      bot.logger.info('Knopf „App hinzufügen“ im Discord-Profil eingerichtet');
    } catch (error) {
      bot.logger.warn({ err: error }, 'Knopf „App hinzufügen“ ließ sich nicht einrichten');
    }
  },
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
        .addSubcommand((s) =>
          s
            .setName('support-zugang')
            .setNameLocalizations(en('support-access'))
            .setDescription(t('de', 'kern.cmd.support'))
            .setDescriptionLocalizations({ 'en-US': t('en', 'kern.cmd.support'), 'en-GB': t('en', 'kern.cmd.support') })
            .addStringOption((o) =>
              o
                .setName('dauer')
                .setNameLocalizations(en('duration'))
                .setDescription(t('de', 'kern.cmd.supportDuration'))
                .setDescriptionLocalizations({ 'en-US': t('en', 'kern.cmd.supportDuration'), 'en-GB': t('en', 'kern.cmd.supportDuration') })
                .setRequired(true)
                .addChoices(
                  { name: '1 Stunde', value: '1h' },
                  { name: '24 Stunden', value: '24h' },
                  { name: '7 Tage', value: '7d' },
                  { name: 'für immer (bis zum Widerruf)', value: 'immer' },
                  { name: 'aus – Zugang beenden', value: 'aus' },
                ),
            ),
        )
        .addSubcommand((s) =>
          s
            .setName('einladen')
            .setNameLocalizations(en('invite'))
            .setDescription(t('de', 'kern.cmd.invite'))
            .setDescriptionLocalizations({ 'en-US': t('en', 'kern.cmd.invite'), 'en-GB': t('en', 'kern.cmd.invite') }),
        )
        .toJSON(),
      async execute({ interaction, locale, bot }) {
        const ephemeral = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
        if (interaction.options.getSubcommand?.(false) === 'einladen') {
          // Einladungs-Link als Knopf (Wunsch Philip, 14.10.) – nur für die Person sichtbar
          const app = interaction.client.application;
          await app.fetch().catch(() => undefined);
          const settings = await loadSettings(bot.prisma).catch(() => null);
          const operator = !!settings?.instanceOwnerId && settings.instanceOwnerId === interaction.user.id;
          const lines = [t(locale, 'kern.invite.text')];
          if (app.botPublic === false) lines.push(t(locale, operator ? 'kern.invite.privateOperator' : 'kern.invite.private'));
          const button = new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(botInviteUrl(app.id)).setLabel(t(locale, 'kern.invite.button')).setEmoji('➕');
          return void (await interaction.reply({ content: lines.join('\n'), components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)], flags: MessageFlags.Ephemeral }));
        }
        if (interaction.options.getSubcommand?.(false) === 'support-zugang') {
          // Nur Server-Owner oder Administratoren entscheiden über den Support-Zugang
          if (!interaction.inCachedGuild()) return;
          const isOwner = interaction.user.id === interaction.guild.ownerId;
          if (!isOwner && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return void (await ephemeral(t(locale, 'kern.support.noPermission')));
          const choice = interaction.options.getString('dauer', true);
          const key = supportAccessKey(interaction.guildId);
          let notice: string;
          if (choice === 'aus') {
            await bot.redis.del(key);
            notice = t(locale, 'kern.support.offLog', { user: `<@${interaction.user.id}>` });
            await ephemeral(t(locale, 'kern.support.off'));
          } else {
            const ms = SUPPORT_DURATIONS[choice as SupportDuration];
            const access: SupportAccess = { by: interaction.user.id, byName: interaction.user.username, since: Date.now(), until: ms === null ? null : Date.now() + ms };
            if (ms === null) await bot.redis.set(key, JSON.stringify(access));
            else await bot.redis.set(key, JSON.stringify(access), 'PX', ms);
            notice = t(locale, 'kern.support.onLog', { user: `<@${interaction.user.id}>`, until: supportUntilText(access) });
            await ephemeral(t(locale, 'kern.support.on', { until: supportUntilText(access) }));
          }
          // Transparenz: Hinweis im Log-Kanal
          const logChannelId = (await bot.modules.config(interaction.guildId, 'logging', parseLoggingConfig).catch(() => null))?.defaultChannelId;
          const channel = logChannelId ? interaction.guild.channels.cache.get(logChannelId) : null;
          if (channel?.isSendable()) await channel.send({ content: notice, allowedMentions: { parse: [] } }).catch(() => undefined);
          return;
        }
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
