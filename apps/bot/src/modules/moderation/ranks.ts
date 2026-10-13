import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { t, type TranslationKey } from '@moin/shared';
import type { SlashCommand } from '../../core/types.js';

/**
 * /raenge verschieben (Ränge-Fixer, Issue #8): eine Rolle hoch/runter/ganz nach oben/unten schieben.
 * Grenzen wie in Discord: nur unter der Bot-Rolle, und (außer für den Server-Owner) unter der eigenen höchsten Rolle.
 */
const d = (key: TranslationKey) => ({ de: t('de', key), loc: { 'en-US': t('en', key), 'en-GB': t('en', key) } });
const en = (name: string) => ({ 'en-US': name, 'en-GB': name });

export type MoveDirection = 'hoch' | 'runter' | 'oben' | 'unten';

/**
 * Zielposition ausrechnen. Positionen wie bei Discord: höher = weiter oben, 0 = @everyone.
 * `limit` = höchste erlaubte Position (unter Bot bzw. unter der eigenen Rolle).
 */
export function targetPosition(current: number, direction: MoveDirection, steps: number, limit: number): number {
  const wanted = direction === 'hoch' ? current + steps : direction === 'runter' ? current - steps : direction === 'oben' ? limit : 1;
  return Math.max(1, Math.min(limit, wanted));
}

export const rankCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('raenge')
    .setNameLocalizations(en('ranks'))
    .setDescription(d('mod.rank.cmd').de)
    .setDescriptionLocalizations(d('mod.rank.cmd').loc)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) =>
      s
        .setName('verschieben')
        .setNameLocalizations(en('move'))
        .setDescription(d('mod.rank.cmdMove').de)
        .setDescriptionLocalizations(d('mod.rank.cmdMove').loc)
        .addRoleOption((o) => o.setName('rolle').setNameLocalizations(en('role')).setDescription(d('mod.rank.optRole').de).setDescriptionLocalizations(d('mod.rank.optRole').loc).setRequired(true))
        .addStringOption((o) =>
          o
            .setName('richtung')
            .setNameLocalizations(en('direction'))
            .setDescription(d('mod.rank.optDir').de)
            .setDescriptionLocalizations(d('mod.rank.optDir').loc)
            .setRequired(true)
            .addChoices(
              { name: '⬆️ hoch', name_localizations: en('⬆️ up'), value: 'hoch' },
              { name: '⬇️ runter', name_localizations: en('⬇️ down'), value: 'runter' },
              { name: '⏫ ganz nach oben', name_localizations: en('⏫ to the top'), value: 'oben' },
              { name: '⏬ ganz nach unten', name_localizations: en('⏬ to the bottom'), value: 'unten' },
            ),
        )
        .addIntegerOption((o) => o.setName('schritte').setNameLocalizations(en('steps')).setDescription(d('mod.rank.optSteps').de).setDescriptionLocalizations(d('mod.rank.optSteps').loc).setMinValue(1).setMaxValue(50)),
    )
    .toJSON(),
  async execute({ interaction, locale }) {
    if (!interaction.inCachedGuild()) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guild = interaction.guild;
    const role = interaction.options.getRole('rolle', true);
    const reply = (key: TranslationKey, vars: Record<string, string | number> = {}) => interaction.editReply({ content: t(locale, key, { role: `<@&${role.id}>`, ...vars }), allowedMentions: { parse: [] } });
    if (role.id === guild.id) return void (await reply('mod.rank.everyone'));
    const botTop = guild.members.me?.roles.highest.position ?? 0;
    if (role.position >= botTop) return void (await reply('mod.rank.aboveBot'));
    const isOwner = interaction.user.id === guild.ownerId;
    const ownTop = interaction.member.roles.highest.position;
    if (!isOwner && role.position >= ownTop) return void (await reply('mod.rank.aboveYou'));
    const limit = Math.min(botTop - 1, isOwner ? Infinity : ownTop - 1);
    const direction = interaction.options.getString('richtung', true) as MoveDirection;
    const target = targetPosition(role.position, direction, interaction.options.getInteger('schritte') ?? 1, limit);
    if (target === role.position) return void (await reply('mod.rank.unchanged'));
    const moved = await guild.roles.setPosition(role.id, target, { reason: `/raenge verschieben (${interaction.user.username})` }).catch(() => null);
    if (!moved) return void (await reply('mod.rank.failed'));
    const sorted = [...guild.roles.cache.values()].sort((a, b) => b.position - a.position);
    const place = sorted.findIndex((r) => r.id === role.id) + 1;
    await reply('mod.rank.moved', { pos: place || target });
  },
};
