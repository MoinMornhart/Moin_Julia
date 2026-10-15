import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, Routes, SlashCommandBuilder } from 'discord.js';
import { loadSettings } from '@moin/db';
import { botInviteUrl, guildInstallConfig, hasGuildInstall, parseSupportScopes, SUPPORT_DURATIONS, supportAccessKey, supportBlockKey, supportScopesText, supportUntilText, t, type SupportAccess, type SupportDuration } from '@moin/shared';
import { deliverAccessRequest, onAccessButton } from './operator-access.js';
import type { BotModule } from '../../core/types.js';
import { runServerCopy, undoServerCopy } from './server-copy.js';

/**
 * Kern: Befehle, die es auf jedem Server immer gibt (unabhängig von den Modul-Schaltern).
 * Den Generalschlüssel des Instanz-Admins gibt es seit 0.69.0 nicht mehr (Issue #13): Zugang zu einem Server
 * bekommt der Betreiber nur, wenn Owner/Admin ihn erlauben – per /moin support-zugang, im Dashboard oder über
 * die Knöpfe einer Anfrage (siehe operator-access.ts).
 */
const en = (name: string) => ({ 'en-US': name, 'en-GB': name });

export const kernModule: BotModule = {
  id: 'kern',
  alwaysOn: true,
  // Aufträge aus dem Dashboard: Server kopieren / Kopie wieder löschen
  async onAction(bot, guildId, action, by) {
    if (action === 'copy-start') await runServerCopy(bot, guildId, by);
    else if (action === 'copy-undo') await undoServerCopy(bot, guildId, by);
    else if (action === 'access-request') await deliverAccessRequest(bot, guildId, by);
  },
  // Knöpfe einer Zugangs-Anfrage – im Log-Kanal oder in der DM des Owners
  async onComponent({ interaction, action, args, bot }) {
    if (action === 'acc' && interaction.isButton()) await onAccessButton(bot, interaction, args);
  },
  async onDmComponent({ interaction, action, args, bot }) {
    if (action === 'acc') await onAccessButton(bot, interaction, args);
  },
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
                  { name: 'sperren – Betreiber darf nicht mehr anfragen', value: 'sperren' },
                  { name: 'entsperren', value: 'entsperren' },
                ),
            )
            .addStringOption((o) =>
              o
                .setName('umfang')
                .setNameLocalizations(en('scope'))
                .setDescription(t('de', 'kern.cmd.supportScope'))
                .setDescriptionLocalizations({ 'en-US': t('en', 'kern.cmd.supportScope'), 'en-GB': t('en', 'kern.cmd.supportScope') })
                .addChoices(
                  { name: 'nur Kanäle mitlesen', value: 'lesen' },
                  { name: 'nur Dashboard verwalten', value: 'dashboard' },
                  { name: 'beides', value: 'lesen+dashboard' },
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
          if (choice === 'aus') {
            await bot.redis.del(key);
            await ephemeral(t(locale, 'kern.support.off'));
          } else if (choice === 'sperren') {
            await bot.redis.set(supportBlockKey(interaction.guildId), JSON.stringify({ by: interaction.user.id, at: Date.now() }));
            await bot.redis.del(key);
            await ephemeral(t(locale, 'kern.support.blocked'));
          } else if (choice === 'entsperren') {
            await bot.redis.del(supportBlockKey(interaction.guildId));
            await ephemeral(t(locale, 'kern.support.unblocked'));
          } else {
            const ms = SUPPORT_DURATIONS[choice as SupportDuration];
            const scopes = parseSupportScopes(interaction.options.getString('umfang') ?? 'lesen') ?? ['lesen'];
            const access: SupportAccess = { by: interaction.user.id, byName: interaction.user.username, since: Date.now(), until: ms === null ? null : Date.now() + ms, scopes };
            if (ms === null) await bot.redis.set(key, JSON.stringify(access));
            else await bot.redis.set(key, JSON.stringify(access), 'PX', ms);
            await ephemeral(t(locale, 'kern.support.on', { until: supportUntilText(access), scopes: supportScopesText(access) }));
          }
          return;
        }
      },
    },
  ],
};
