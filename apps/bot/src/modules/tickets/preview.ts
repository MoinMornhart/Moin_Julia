import { EmbedBuilder, type APIButtonComponentWithCustomId, type APIEmbed, type ActionRowBuilder, type MessageActionRowComponentBuilder } from 'discord.js';
import { parseTicketsConfig, t, ticketPanelSchema } from '@moin/shared';
import { welcomeText } from './logic.js';
import { buildTicketPanel, ticketControls } from './panel.js';

/** Panel und Ticket fürs Bauprotokoll – direkt aus dem echten Code (Namen erfunden). */
export function previewEmbeds() {
  const style = (s: number) => (s === 3 ? 'success' : s === 4 ? 'danger' : 'secondary') as 'success' | 'danger' | 'secondary';
  const buttons = (rows: ActionRowBuilder<MessageActionRowComponentBuilder>[]) =>
    rows.map((row) => (row.toJSON().components as APIButtonComponentWithCustomId[]).map((b) => ({ label: b.label ?? '', emoji: b.emoji?.name ?? undefined, style: style(b.style) })));
  const data = ticketPanelSchema.parse({
    name: 'Support',
    reasons: [
      { id: 'g1', label: 'Frage', emoji: '❓' },
      { id: 'g2', label: 'Bewerbung', emoji: '📝' },
      { id: 'g3', label: 'Problem melden', emoji: '🐞' },
    ],
  });
  const ctx = { userId: '1', userName: 'Anna', userTag: 'anna', userAvatarUrl: null, serverName: 'Moin Demo-Server', serverIconUrl: null, memberCount: 1284 };
  const panel = buildTicketPanel('p', data, ctx);
  const config = parseTicketsConfig({});
  const welcome = new EmbedBuilder()
    .setColor(0xff7a59)
    .setTitle(t('de', 'tickets.welcomeTitle', { nr: 42, reason: 'Bewerbung' }))
    .setDescription(welcomeText(config.welcomeText, { user: '<@1>', nr: 42 }))
    .addFields({ name: 'Wie alt bist du?', value: '19' }, { name: 'Warum möchtest du ins Team?', value: 'Ich bin fast jeden Abend online und helfe gern.' });
  return [
    {
      caption: 'Ticket-Panel (Knöpfe – oder als Auswahlmenü)',
      embeds: panel.embeds as APIEmbed[],
      buttons: panel.components.map((row) =>
        (row.toJSON().components as APIButtonComponentWithCustomId[]).map((b) => ({ label: b.label ?? '', emoji: b.emoji?.name ?? undefined, style: 'secondary' as const })),
      ),
    },
    {
      caption: 'Neues Ticket: Begrüßung mit den Antworten aus dem Formular, Knöpfe für das Team',
      embeds: [welcome.toJSON()],
      buttons: buttons(ticketControls('de', 't', false)),
    },
  ];
}

export const previewNames: Record<string, string> = { '1': 'Anna' };
