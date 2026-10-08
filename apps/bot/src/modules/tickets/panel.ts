import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type APIEmbed,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { renderTemplate, t, type Locale, type TemplateContext, type TicketPanelData, type TicketReason } from '@moin/shared';
import { parseEmoji } from '../willkommen/panels.js';

/** Panel-Nachricht: Knöpfe „tickets:open:<panel>:<grund>“ oder Menü „tickets:select:<panel>“ */
export function buildTicketPanel(panelId: string, data: TicketPanelData, ctx: TemplateContext) {
  const { content, embed } = renderTemplate(data.template, ctx);
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
  if (data.style === 'select') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`tickets:select:${panelId}`)
      .setPlaceholder('Worum geht es?')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(data.reasons.map((r) => ({ label: r.label, value: r.id, description: r.description || undefined, emoji: parseEmoji(r.emoji) })));
    rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu));
  } else {
    for (let i = 0; i < data.reasons.length; i += 5) {
      const row = new ActionRowBuilder<MessageActionRowComponentBuilder>();
      for (const r of data.reasons.slice(i, i + 5)) {
        const button = new ButtonBuilder().setCustomId(`tickets:open:${panelId}:${r.id}`).setLabel(r.label).setStyle(ButtonStyle.Primary);
        const emoji = parseEmoji(r.emoji);
        if (emoji) button.setEmoji(emoji);
        row.addComponents(button);
      }
      rows.push(row);
    }
  }
  return { content: content || undefined, embeds: embed ? [embed as APIEmbed] : [], components: rows, allowedMentions: { parse: [] as never[] } };
}

/** Formular beim Öffnen (nur wenn der Grund Fragen hat) */
export function questionModal(panelId: string, reason: TicketReason) {
  const modal = new ModalBuilder().setCustomId(`tickets:form:${panelId}:${reason.id}`).setTitle(reason.label.slice(0, 45));
  reason.questions.forEach((q, i) => {
    const input = new TextInputBuilder()
      .setCustomId(`q${i}`)
      .setStyle(q.long ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(q.required)
      .setMaxLength(q.long ? 1024 : 200);
    if (q.placeholder) input.setPlaceholder(q.placeholder.slice(0, 100));
    modal.addLabelComponents(new LabelBuilder().setLabel(q.label).setTextInputComponent(input));
  });
  return modal;
}

/** Knöpfe im Ticket-Kanal */
export function ticketControls(locale: Locale, ticketId: string, claimed: boolean) {
  const claim = new ButtonBuilder()
    .setCustomId(`tickets:claim:${ticketId}`)
    .setLabel(t(locale, 'tickets.btn.claim'))
    .setEmoji('🙋')
    .setStyle(ButtonStyle.Success)
    .setDisabled(claimed);
  const close = new ButtonBuilder().setCustomId(`tickets:close:${ticketId}`).setLabel(t(locale, 'tickets.btn.close')).setEmoji('🔒').setStyle(ButtonStyle.Danger);
  return [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(claim, close)];
}

export function closeModal(locale: Locale, ticketId: string) {
  const input = new TextInputBuilder().setCustomId('reason').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(200);
  return new ModalBuilder()
    .setCustomId(`tickets:close-submit:${ticketId}`)
    .setTitle(t(locale, 'tickets.closeModal'))
    .addLabelComponents(new LabelBuilder().setLabel(t(locale, 'tickets.closeReason')).setTextInputComponent(input));
}

/** Bewertung per DM: „tickets:rate:<ticket>:<1-5>“ */
export function ratingRow(ticketId: string) {
  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>();
  for (let n = 1; n <= 5; n++) {
    row.addComponents(new ButtonBuilder().setCustomId(`tickets:rate:${ticketId}:${n}`).setLabel(`${n} ★`).setStyle(n >= 4 ? ButtonStyle.Success : ButtonStyle.Secondary));
  }
  return [row];
}
