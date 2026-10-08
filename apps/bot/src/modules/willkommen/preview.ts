import type { APIEmbed } from 'discord.js';
import { parseWillkommenConfig, renderTemplate, rolePanelSchema, type TemplateContext } from '@moin/shared';

/** Beispiel-Nachrichten fürs Bauprotokoll (Standardtexte, Namen erfunden). */
export function previewEmbeds(): { caption: string; embeds: APIEmbed[] }[] {
  const ctx: TemplateContext = {
    userId: '1', userName: 'Anna', userTag: 'anna.streamt', userAvatarUrl: null, serverName: 'Moin Demo-Server', serverIconUrl: null, memberCount: 1284,
  };
  const config = parseWillkommenConfig({});
  const welcome = renderTemplate(config.welcome.template, ctx).embed as APIEmbed;
  const leave = renderTemplate(config.leave.template, ctx).embed as APIEmbed;
  const panel = rolePanelSchema.parse({ name: 'Spiele', template: { embed: { title: '🎮 Welche Spiele zockst du?', description: 'Hol dir die Rollen – dann wirst du bei Community-Runden gepingt.' } }, roles: [{ roleId: '100000000000000011', label: 'Minecraft' }] });
  return [
    { caption: 'Willkommensnachricht mit den Standardtexten (das Bild hängt unten im Embed)', embeds: [{ ...welcome, image: undefined }] },
    { caption: 'Abschied · Rollen-Panel (darunter die Buttons „⛏️ Minecraft“, „🎯 Valorant“ …)', embeds: [leave, renderTemplate(panel.template, ctx).embed as APIEmbed] },
  ];
}

export const previewNames: Record<string, string> = { '1': 'Anna' };
