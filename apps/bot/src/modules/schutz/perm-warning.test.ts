import { AuditLogEvent, PermissionFlagsBits } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { parseSchutzConfig } from '@moin/shared';
import type { BotContext } from '../../core/types.js';
import { permissionWarning } from './index.js';

const G = '100000000000000001';
const ALERT = '100000000000000500';
const CH = '100000000000000023';
const BOT = '100000000000000999';

function setup(opts: { channelAllow?: bigint; everyone?: bigint } = {}) {
  const alertChannel = { isTextBased: () => true, send: vi.fn(async () => ({})) };
  const feedback = { permissionOverwrites: { cache: new Map([[G, { allow: { bitfield: opts.channelAllow ?? 0n } }]]) } };
  const guild = {
    id: G,
    members: { me: { id: BOT } },
    roles: { everyone: { permissions: { bitfield: opts.everyone ?? PermissionFlagsBits.SendMessages } } },
    channels: { cache: new Map<string, unknown>([[ALERT, alertChannel], [CH, feedback]]) },
  };
  const bot = { modules: { locale: async () => 'de' }, logger: { warn: vi.fn() } } as unknown as BotContext;
  return { guild, bot, alertChannel };
}

const config = (permWarnings = true) => parseSchutzConfig({ alertChannelId: ALERT, permWarnings });
const sentText = (ch: { send: ReturnType<typeof vi.fn> }) => (ch.send.mock.calls[0]![0] as { embeds: { description: string }[] }).embeds[0]!.description;

describe('Rechte-Wächter', () => {
  it('Kanal-Ausnahme gibt @everyone „Kanäle verwalten“ → Warnung', async () => {
    const w = setup({ channelAllow: PermissionFlagsBits.ManageChannels | PermissionFlagsBits.SendMessages });
    const warned = await permissionWarning(w.bot, { action: AuditLogEvent.ChannelOverwriteUpdate, executorId: '100000000000000300', targetId: CH, changes: [] }, w.guild as never, config());
    expect(warned).toBe(true);
    expect(sentText(w.alertChannel)).toContain(`<@100000000000000300> hat in <#${CH}> für @everyone erlaubt: Kanäle verwalten.`);
  });

  it('@everyone-Rolle bekommt Administrator → Warnung', async () => {
    const w = setup({ everyone: PermissionFlagsBits.Administrator });
    expect(await permissionWarning(w.bot, { action: AuditLogEvent.RoleUpdate, executorId: '100000000000000300', targetId: G, changes: [] }, w.guild as never, config())).toBe(true);
    expect(sentText(w.alertChannel)).toContain('hat der Rolle @everyone gegeben: Administrator.');
  });

  it('harmlose Rechte, eigene Bot-Änderungen oder ausgeschaltet → keine Warnung', async () => {
    const harmless = setup({ channelAllow: PermissionFlagsBits.SendMessages });
    expect(await permissionWarning(harmless.bot, { action: AuditLogEvent.ChannelOverwriteCreate, executorId: '1', targetId: CH, changes: [] }, harmless.guild as never, config())).toBe(false);
    const own = setup({ channelAllow: PermissionFlagsBits.ManageChannels });
    expect(await permissionWarning(own.bot, { action: AuditLogEvent.ChannelOverwriteUpdate, executorId: BOT, targetId: CH, changes: [] }, own.guild as never, config())).toBe(false);
    const off = setup({ channelAllow: PermissionFlagsBits.ManageChannels });
    expect(await permissionWarning(off.bot, { action: AuditLogEvent.ChannelOverwriteUpdate, executorId: '1', targetId: CH, changes: [] }, off.guild as never, config(false))).toBe(false);
    expect(off.alertChannel.send).not.toHaveBeenCalled();
  });
});
