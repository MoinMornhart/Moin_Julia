import type { APIButtonComponentWithCustomId, APIEmbed } from 'discord.js';
import { buildPanel } from './panel.js';

/** Bedienfeld fürs Bauprotokoll – direkt aus dem echten Code (Name erfunden). */
export function previewEmbeds() {
  const panel = buildPanel('de', '1', '1');
  const style = (s: number) => (s === 3 ? 'success' : s === 4 ? 'danger' : 'secondary') as 'success' | 'danger' | 'secondary';
  const buttons = panel.components.map((row) =>
    (row.toJSON().components as APIButtonComponentWithCustomId[]).map((b) => ({ label: b.label ?? '', emoji: b.emoji?.name ?? undefined, style: style(b.style) })),
  );
  return [
    {
      caption: 'Bedienfeld im Text-Chat des eigenen Sprachkanals – nur Besitzer:in kann es benutzen („Übernehmen“ geht, wenn sie weg ist)',
      embeds: panel.embeds.map((e) => e.toJSON() as APIEmbed),
      buttons,
    },
  ];
}

export const previewNames: Record<string, string> = { '1': 'Anna' };
