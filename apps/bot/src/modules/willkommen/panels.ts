import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type APIEmbed,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { renderTemplate, type RolePanelData, type TemplateContext } from '@moin/shared';

/**
 * Rollen-Panels: Nachricht + Buttons (max. 5 pro Reihe, 5 Reihen) oder ein Auswahlmenü.
 * customId: willkommen:role:<panelId>:<roleId>  bzw.  willkommen:select:<panelId>
 */

/** Emoji-Text → Discord-Emoji-Objekt (Unicode oder <:name:id>) */
export function parseEmoji(raw: string): { id?: string; name?: string; animated?: boolean } | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  const custom = /^<(a?):(\w+):(\d+)>$/.exec(text);
  if (custom) return { animated: custom[1] === 'a', name: custom[2], id: custom[3] };
  return { name: text };
}

export function buildPanelMessage(panelId: string, data: RolePanelData, ctx: TemplateContext) {
  const { content, embed } = renderTemplate(data.template, ctx);
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
  if (data.style === 'select') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`willkommen:select:${panelId}`)
      .setPlaceholder('Rollen auswählen …')
      .setMinValues(0)
      .setMaxValues(data.mode === 'single' ? 1 : data.roles.length)
      .addOptions(
        data.roles.map((r) => ({
          label: r.label,
          value: r.roleId,
          description: r.description || undefined,
          emoji: parseEmoji(r.emoji),
        })),
      );
    rows.push(new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu));
  } else {
    for (let i = 0; i < data.roles.length; i += 5) {
      const row = new ActionRowBuilder<MessageActionRowComponentBuilder>();
      for (const r of data.roles.slice(i, i + 5)) {
        const button = new ButtonBuilder().setCustomId(`willkommen:role:${panelId}:${r.roleId}`).setLabel(r.label).setStyle(ButtonStyle.Secondary);
        const emoji = parseEmoji(r.emoji);
        if (emoji) button.setEmoji(emoji);
        row.addComponents(button);
      }
      rows.push(row);
    }
  }
  return {
    content: content || undefined,
    embeds: embed ? [embed as APIEmbed] : [],
    components: rows,
    allowedMentions: { parse: [] as never[] },
  };
}

/**
 * Welche Rollen kommen dazu bzw. fallen weg?
 * Button: Rolle umschalten (bei „single“ die anderen Panel-Rollen entfernen).
 * Auswahl: genau die gewählten Panel-Rollen behalten.
 */
export function roleChanges(
  data: RolePanelData,
  current: string[],
  input: { kind: 'button'; roleId: string } | { kind: 'select'; values: string[] },
): { add: string[]; remove: string[] } {
  const panelRoles = data.roles.map((r) => r.roleId);
  const has = new Set(current);
  // Bekommt jemand eine Panel-Rolle, fallen zusätzlich die „beim Auswählen entfernen“-Rollen weg
  const onPick = (add: string[]) => (add.length ? data.removeOnPick.filter((r) => has.has(r) && !panelRoles.includes(r)) : []);
  if (input.kind === 'button') {
    if (!panelRoles.includes(input.roleId)) return { add: [], remove: [] };
    if (has.has(input.roleId)) return { add: [], remove: [input.roleId] };
    const remove = data.mode === 'single' ? panelRoles.filter((r) => r !== input.roleId && has.has(r)) : [];
    return { add: [input.roleId], remove: [...remove, ...onPick([input.roleId])] };
  }
  const wanted = new Set(input.values.filter((v) => panelRoles.includes(v)));
  const add = [...wanted].filter((r) => !has.has(r));
  return {
    add,
    remove: [...panelRoles.filter((r) => has.has(r) && !wanted.has(r)), ...onPick(add)],
  };
}
