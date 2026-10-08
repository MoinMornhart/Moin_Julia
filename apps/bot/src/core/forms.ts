import {
  FileUploadBuilder,
  LabelBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ModalSubmitInteraction,
} from 'discord.js';
import type { FormAnswer, FormField } from '@moin/shared';
import { parseEmoji } from '../modules/willkommen/panels.js';

/** Zusatzfeld ganz vorn, z. B. die Sterne bei der Bewertung */
export interface ExtraSelect {
  id: string;
  label: string;
  options: { label: string; value: string; emoji?: string }[];
}

/**
 * Discord-Formular (Modal) aus Formular-Feldern: Kurztext, Langtext, Auswahl, Datei-Upload.
 * customIds der Felder: „f:<feld-id>“ – so lassen sie sich beim Absenden wiederfinden.
 */
export function buildFormModal(customId: string, title: string, fields: FormField[], extra?: ExtraSelect): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title.slice(0, 45));
  if (extra) {
    const menu = new StringSelectMenuBuilder().setCustomId(`x:${extra.id}`).setMinValues(1).setMaxValues(1).addOptions(extra.options.map((o) => ({ ...o, emoji: o.emoji ? parseEmoji(o.emoji) : undefined })));
    modal.addLabelComponents(new LabelBuilder().setLabel(extra.label).setStringSelectMenuComponent(menu));
  }
  for (const f of fields.slice(0, extra ? 4 : 5)) {
    const label = new LabelBuilder().setLabel(f.label);
    if (f.type === 'select') {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`f:${f.id}`)
        .setRequired(f.required)
        .setMinValues(f.required ? 1 : 0)
        .setMaxValues(1)
        .addOptions(f.options.slice(0, 25).map((o) => ({ label: o.label, value: o.label.slice(0, 100), emoji: parseEmoji(o.emoji) })));
      if (f.placeholder) menu.setPlaceholder(f.placeholder);
      label.setStringSelectMenuComponent(menu);
    } else if (f.type === 'file') {
      label.setFileUploadComponent(new FileUploadBuilder().setCustomId(`f:${f.id}`).setRequired(f.required).setMinValues(f.required ? 1 : 0).setMaxValues(5));
    } else {
      const input = new TextInputBuilder()
        .setCustomId(`f:${f.id}`)
        .setStyle(f.type === 'long' ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(f.required)
        .setMaxLength(Math.min(f.maxLength, 4000));
      if (f.minLength) input.setMinLength(Math.min(f.minLength, f.maxLength));
      if (f.placeholder) input.setPlaceholder(f.placeholder);
      label.setTextInputComponent(input);
    }
    modal.addLabelComponents(label);
  }
  return modal;
}

/** Antworten aus dem abgeschickten Formular lesen (leere optionale Felder fallen weg) */
export function readFormModal(interaction: ModalSubmitInteraction, fields: FormField[]): FormAnswer[] {
  const answers: FormAnswer[] = [];
  for (const f of fields) {
    try {
      if (f.type === 'select') {
        const value = interaction.fields.getStringSelectValues(`f:${f.id}`)[0];
        if (value) answers.push({ fieldId: f.id, label: f.label, value });
      } else if (f.type === 'file') {
        const files = interaction.fields.getUploadedFiles(`f:${f.id}`);
        if (files?.size) answers.push({ fieldId: f.id, label: f.label, value: `${files.size} Datei(en)`, files: [...files.values()].map((a) => ({ name: a.name, url: a.url })) });
      } else {
        const value = interaction.fields.getTextInputValue(`f:${f.id}`).trim();
        if (value) answers.push({ fieldId: f.id, label: f.label, value });
      }
    } catch {
      // Feld fehlt (z. B. Formular nachträglich geändert) – überspringen
    }
  }
  return answers;
}

export function readExtraSelect(interaction: ModalSubmitInteraction, id: string): string | null {
  try {
    return interaction.fields.getStringSelectValues(`x:${id}`)[0] ?? null;
  } catch {
    return null;
  }
}
