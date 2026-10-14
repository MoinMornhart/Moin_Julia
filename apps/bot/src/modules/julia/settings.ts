import { randomBytes } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, type Guild, type GuildMember } from 'discord.js';
import type { Prisma } from '@moin/db';
import { CONFIG_CHANNEL, coerceSetting, getModule, MODULE_CONFIG_PARSERS, MODULE_CONFIG_SCHEMAS, SENSITIVE_MODULES, settingFields, type ConfigEvent, type JuliaAction, type SettingValueType } from '@moin/shared';
import type { BotContext, ComponentContext } from '../../core/types.js';

/**
 * Julia ändert Einstellungen (Wunsch Philip, 13.10.: „Julia kennt das Dashboard und ändert selbst“).
 * Dürfen: Server-Owner, Administratoren, Instanz-Admin. Gleiche Prüfung wie im Dashboard (zod-Schema),
 * heikle Bereiche nur per Bestätigungs-Knopf, alles andere sofort – mit „Rückgängig“-Knopf (1 Stunde).
 */
type SettingAction = Extract<JuliaAction, { kind: 'einstellung' }>;

export function canConfigure(guild: Pick<Guild, 'ownerId'>, member: Pick<GuildMember, 'id' | 'permissions'>, instanceOwnerId: string | null | undefined): boolean {
  return member.id === guild.ownerId || (member.permissions?.has(PermissionFlagsBits.Administrator) ?? false) || (!!instanceOwnerId && member.id === instanceOwnerId);
}

export function isSensitiveSetting(action: SettingAction): boolean {
  return SENSITIVE_MODULES.includes(action.moduleId);
}

/** Was Julia ändern kann: Module mit Einstellungen, an/aus und ihre einfachen Felder */
export async function settingsCatalog(bot: BotContext, guildId: string): Promise<{ moduleId: string; enabled: boolean; fields: { key: string; type: SettingValueType }[] }[]> {
  const out = [];
  for (const [moduleId, parse] of Object.entries(MODULE_CONFIG_PARSERS)) {
    const meta = getModule(moduleId);
    if (!meta || meta.ownerOnly || !MODULE_CONFIG_SCHEMAS[moduleId]) continue;
    const config = await bot.modules.config(guildId, moduleId, parse).catch(() => null);
    out.push({ moduleId, enabled: await bot.modules.isEnabled(guildId, moduleId).catch(() => meta.defaultEnabled), fields: settingFields(config).slice(0, 20) });
  }
  return out;
}

interface Undo {
  guildId: string;
  moduleId: string;
  field: string | null;
  previous: unknown;
  by: string;
  expires: number;
}
const undos = new Map<string, Undo>();

export function resetSettingUndos(): void {
  undos.clear();
}

async function publish(bot: BotContext, event: ConfigEvent): Promise<void> {
  bot.modules.invalidate(event.type === 'module' || event.type === 'module-config' ? event.guildId : '');
  await bot.redis.publish(CONFIG_CHANNEL, JSON.stringify(event)).catch(() => undefined);
}

/** Einstellung anwenden. Gibt einen lesbaren Text zurück und – wenn es geklappt hat – die Rückgängig-ID */
export async function applySetting(bot: BotContext, guild: Guild, action: SettingAction, by: string): Promise<{ ok: boolean; text: string; undoId?: string }> {
  const meta = getModule(action.moduleId);
  if (!meta || meta.ownerOnly || meta.status !== 'available') return { ok: false, text: `Ein Modul „${action.moduleId}“ kenne ich nicht.` };
  const row = await bot.prisma.guildModule.findUnique({ where: { guildId_moduleId: { guildId: guild.id, moduleId: action.moduleId } } });

  // Modul an/aus
  if (action.field === null) {
    const enabled = action.value === 'an';
    const before = row?.enabled ?? meta.defaultEnabled;
    if (before === enabled) return { ok: true, text: `${meta.icon} ${meta.name.de} ist schon ${enabled ? 'an' : 'aus'}.` };
    await bot.prisma.guildModule.upsert({
      where: { guildId_moduleId: { guildId: guild.id, moduleId: action.moduleId } },
      create: { guildId: guild.id, moduleId: action.moduleId, enabled, config: {}, updatedBy: by },
      update: { enabled, updatedBy: by },
    });
    await publish(bot, { type: 'module', guildId: guild.id, moduleId: action.moduleId, enabled });
    return { ok: true, text: `${meta.icon} ${meta.name.de} ist jetzt ${enabled ? 'an' : 'aus'}.`, undoId: remember({ guildId: guild.id, moduleId: action.moduleId, field: null, previous: before, by }) };
  }

  // Feld ändern – nur einfache Felder, Prüfung mit demselben Schema wie im Dashboard
  const parse = MODULE_CONFIG_PARSERS[action.moduleId];
  const schema = MODULE_CONFIG_SCHEMAS[action.moduleId];
  if (!parse || !schema) return { ok: false, text: `${meta.name.de} hat keine Einstellungen, die ich ändern kann.` };
  const current = parse(row?.config ?? {}) as Record<string, unknown>;
  const field = settingFields(current).find((f) => f.key.toLowerCase() === action.field!.toLowerCase());
  if (!field) return { ok: false, text: `Die Einstellung „${action.field}“ gibt es bei ${meta.name.de} nicht (oder sie geht nur im Dashboard).` };
  const value = coerceSetting(field.type, action.value);
  if (value === null) return { ok: false, text: `„${action.value}“ passt nicht zu ${field.key} (erwartet: ${field.type === 'boolean' ? 'an/aus' : field.type === 'number' ? 'eine Zahl' : 'Text'}).` };
  const next = schema.safeParse({ ...current, [field.key]: value });
  if (!next.success) return { ok: false, text: `Ungültiger Wert für ${field.key}: ${next.error.issues[0]?.message ?? 'passt nicht'}.` };
  const previous = current[field.key];
  await saveConfig(bot, guild.id, action.moduleId, next.data, by, row ? undefined : meta.defaultEnabled);
  return {
    ok: true,
    text: `${meta.icon} ${meta.name.de}: ${field.key} = ${String(value)} (vorher ${String(previous)}).`,
    undoId: remember({ guildId: guild.id, moduleId: action.moduleId, field: field.key, previous, by }),
  };
}

async function saveConfig(bot: BotContext, guildId: string, moduleId: string, config: unknown, by: string, enabledIfNew?: boolean): Promise<void> {
  const data = config as Prisma.InputJsonValue;
  await bot.prisma.guildModule.upsert({
    where: { guildId_moduleId: { guildId, moduleId } },
    create: { guildId, moduleId, enabled: enabledIfNew ?? false, config: data, updatedBy: by },
    update: { config: data, updatedBy: by },
  });
  await publish(bot, { type: 'module-config', guildId, moduleId });
}

function remember(u: Omit<Undo, 'expires'>): string {
  const now = Date.now();
  for (const [k, v] of undos) if (v.expires < now) undos.delete(k);
  const id = randomBytes(6).toString('hex');
  undos.set(id, { ...u, expires: now + 3_600_000 });
  return id;
}

/** Ergebnis-Nachricht mit „Rückgängig“-Knopf */
export function settingResult(text: string, undoId?: string) {
  return {
    content: `⚙️ ${text}`,
    components: undoId ? [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`julia:undo:${undoId}`).setStyle(ButtonStyle.Secondary).setLabel('↩️ Rückgängig'))] : [],
    allowedMentions: { parse: [] as never[] },
  };
}

/** Knopf „Rückgängig“: nur wer es geändert hat oder wer selbst Einstellungen ändern darf */
export async function onUndoButton(ctx: ComponentContext, instanceOwnerId: string | null | undefined): Promise<void> {
  const { interaction, args, bot } = ctx;
  if (!interaction.isButton() || !interaction.inCachedGuild()) return;
  const entry = undos.get(args[0] ?? '');
  if (!entry || entry.expires < Date.now() || entry.guildId !== interaction.guildId) {
    return void (await interaction.update({ content: `${interaction.message.content}\n⌛ Rückgängig geht nicht mehr.`, components: [], allowedMentions: { parse: [] } }));
  }
  if (interaction.user.id !== entry.by && !canConfigure(interaction.guild, interaction.member, instanceOwnerId)) {
    return void (await interaction.reply({ content: 'Rückgängig machen darf nur, wer es geändert hat (oder Owner/Admins).', flags: MessageFlags.Ephemeral }));
  }
  undos.delete(args[0]!);
  if (entry.field === null) {
    await bot.prisma.guildModule.updateMany({ where: { guildId: entry.guildId, moduleId: entry.moduleId }, data: { enabled: entry.previous as boolean, updatedBy: interaction.user.id } });
    await publish(bot, { type: 'module', guildId: entry.guildId, moduleId: entry.moduleId, enabled: entry.previous as boolean });
  } else {
    const parse = MODULE_CONFIG_PARSERS[entry.moduleId]!;
    const row = await bot.prisma.guildModule.findUnique({ where: { guildId_moduleId: { guildId: entry.guildId, moduleId: entry.moduleId } } });
    const current = parse(row?.config ?? {}) as Record<string, unknown>;
    await saveConfig(bot, entry.guildId, entry.moduleId, { ...current, [entry.field]: entry.previous }, interaction.user.id);
  }
  await interaction.update({ content: `${interaction.message.content}\n↩️ Rückgängig gemacht von <@${interaction.user.id}>.`, components: [], allowedMentions: { parse: [] } });
}
