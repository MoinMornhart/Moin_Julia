import type { APIEmbed } from 'discord.js';
import {
  channelEmbed,
  memberJoinedEmbed,
  messageDeletedEmbed,
  messageEditedEmbed,
  moderationEmbed,
  rolesChangedEmbed,
  voiceEmbed,
} from './embeds.js';

/** Beispiel-Meldungen fürs Bauprotokoll (Vorschaubilder). Alle Namen sind erfunden. */
export function previewEmbeds(): { caption: string; embeds: APIEmbed[] }[] {
  const now = new Date('2026-10-08T19:42:00Z');
  const anna = { id: '1', tag: 'anna.streamt', avatarUrl: null };
  const mod = { id: '2', tag: 'moderator.max' };
  const neu = { id: '3', tag: 'neuling2026', avatarUrl: null };
  return [
    {
      caption: 'Gelöschte und bearbeitete Nachricht',
      embeds: [
        messageDeletedEmbed({ locale: 'de', author: anna, channelId: '10', messageId: '9001', content: 'Wer ist heute Abend beim Stream dabei? 🎮', attachments: [], now }),
        messageEditedEmbed({ locale: 'de', author: anna, channelId: '10', messageId: '9002', url: 'https://discord.com/channels/x', before: 'Stream startet um 19 Uhr', after: 'Stream startet um 20 Uhr!', now }),
      ],
    },
    {
      caption: 'Neues Mitglied mit Warnung bei frischem Account',
      embeds: [memberJoinedEmbed({ locale: 'de', user: neu, accountCreated: new Date('2026-10-07T12:00:00Z'), memberCount: 1284, now })],
    },
    {
      caption: 'Moderation: Ban und Rollen-Änderung mit Moderator aus dem Audit-Log',
      embeds: [
        moderationEmbed({ locale: 'de', kind: 'ban', user: { id: '4', tag: 'spam.bot.99' }, moderator: mod, reason: 'Spam-Links in mehreren Kanälen', now }),
        rolesChangedEmbed({ locale: 'de', user: anna, added: ['20'], removed: ['21'], moderator: mod, now }),
      ],
    },
    {
      caption: 'Kanal geändert und Sprachkanal gewechselt',
      embeds: [
        channelEmbed({
          locale: 'de', kind: 'updated', channelId: '11', name: 'clips', moderator: mod, now,
          changes: [{ key: 'log.change.slowmode', before: '0s', after: '30s' }, { key: 'log.change.topic', before: '–', after: 'Nur eigene Clips, bitte!' }],
        }),
        voiceEmbed({ locale: 'de', user: anna, from: '30', to: '31', now })!,
      ],
    },
  ];
}

/** Anzeigenamen für erwähnte IDs in der Vorschau */
export const previewNames: Record<string, string> = {
  '1': 'anna.streamt',
  '2': 'moderator.max',
  '3': 'neuling2026',
  '4': 'spam.bot.99',
  '10': 'allgemein',
  '11': 'clips',
  '20': 'Stammzuschauer',
  '21': 'Neuling',
  '30': 'Lounge',
  '31': 'Stream-Talk',
};
