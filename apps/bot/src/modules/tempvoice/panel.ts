import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { t, type Locale } from '@moin/shared';

/** Bedienfeld im Text-Chat des eigenen Sprachkanals. customId = tempvoice:<aktion>:<kanal-id> */
export function buildPanel(locale: Locale, channelId: string, ownerId: string) {
  const btn = (action: string, label: string, emoji: string, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId(`tempvoice:${action}:${channelId}`).setLabel(label).setEmoji(emoji).setStyle(style);
  const row1 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    btn('rename', t(locale, 'tempvoice.btn.rename'), '✏️'),
    btn('limit', t(locale, 'tempvoice.btn.limit'), '👥'),
    btn('lock', `${t(locale, 'tempvoice.btn.lock')} / ${t(locale, 'tempvoice.btn.unlock')}`, '🔒'),
    btn('hide', `${t(locale, 'tempvoice.btn.hide')} / ${t(locale, 'tempvoice.btn.show')}`, '🙈'),
  );
  const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    btn('invite', t(locale, 'tempvoice.btn.invite'), '➕', ButtonStyle.Success),
    btn('kick', t(locale, 'tempvoice.btn.kick'), '👢', ButtonStyle.Danger),
    btn('transfer', t(locale, 'tempvoice.btn.transfer'), '👑'),
    btn('claim', t(locale, 'tempvoice.btn.claim'), '🙋'),
  );
  const embed = new EmbedBuilder()
    .setColor(0x2fd1b8)
    .setTitle(t(locale, 'tempvoice.panel.title'))
    .setDescription(t(locale, 'tempvoice.panel.text', { user: `<@${ownerId}>` }));
  return { embeds: [embed], components: [row1, row2], allowedMentions: { users: [ownerId] } };
}

export function renameModal(locale: Locale, channelId: string, current: string) {
  const input = new TextInputBuilder().setCustomId('name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setValue(current.slice(0, 100));
  return new ModalBuilder()
    .setCustomId(`tempvoice:rename-submit:${channelId}`)
    .setTitle(t(locale, 'tempvoice.modal.rename'))
    .addLabelComponents(new LabelBuilder().setLabel(t(locale, 'tempvoice.modal.renameLabel')).setTextInputComponent(input));
}

export function limitModal(locale: Locale, channelId: string, current: number) {
  const input = new TextInputBuilder().setCustomId('limit').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2).setValue(String(current));
  return new ModalBuilder()
    .setCustomId(`tempvoice:limit-submit:${channelId}`)
    .setTitle(t(locale, 'tempvoice.modal.limit'))
    .addLabelComponents(new LabelBuilder().setLabel(t(locale, 'tempvoice.modal.limitLabel')).setTextInputComponent(input));
}

/** Personen auswählen (Einladen, Rauswerfen, Übergeben) */
export function userPicker(locale: Locale, kind: 'invite' | 'kick' | 'transfer', channelId: string) {
  const menu = new UserSelectMenuBuilder()
    .setCustomId(`tempvoice:${kind}-pick:${channelId}`)
    .setPlaceholder(t(locale, ({ invite: 'tempvoice.select.invite', kick: 'tempvoice.select.kick', transfer: 'tempvoice.select.transfer' } as const)[kind]))
    .setMinValues(1)
    .setMaxValues(kind === 'transfer' ? 1 : 10);
  return [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu)];
}
