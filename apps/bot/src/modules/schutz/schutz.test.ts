import { AuditLogEvent } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import type { BotContext, ComponentContext, ModuleSetup } from '../../core/types.js';
import { schutzModule } from './index.js';

const ALERT = '100000000000000500';
const VERIFIED = '100000000000000600';

function fakeGuild() {
  const alertChannel = { isTextBased: () => true, send: vi.fn(async () => ({})) };
  const roles = new Map([[VERIFIED, { id: VERIFIED, permissions: { has: () => false } }]]);
  const attacker = {
    id: '100000000000000666',
    user: { id: '100000000000000666', tag: 'boese', bot: false },
    roles: {
      cache: Object.assign(new Map([['r-mod', { id: 'r-mod', managed: false }]]), {
        filter: () => new Map(),
      }),
      set: vi.fn(async () => undefined),
    },
    kick: vi.fn(async () => undefined),
  };
  const guild = {
    id: '100000000000000001',
    name: 'Moin',
    ownerId: '100000000000000777',
    channels: { cache: new Map([[ALERT, alertChannel]]) },
    roles: { cache: roles },
    members: {
      me: { id: '100000000000000999', permissions: { has: () => true } },
      fetch: async (id: string) => (id === attacker.id ? attacker : null),
      ban: vi.fn(async () => undefined),
    },
    disableInvites: vi.fn(async () => undefined),
  };
  return { guild, alertChannel, attacker };
}

function setup(config: unknown) {
  const bot = {
    modules: { config: async (_g: string, _m: string, parse: (r: unknown) => unknown) => parse(config), locale: async () => 'de' },
    redis: { set: vi.fn(async () => 'OK'), del: vi.fn(async () => 1), get: vi.fn(async () => null) },
    logger: { warn: vi.fn(), error: vi.fn() },
  } as unknown as BotContext;
  const handlers = new Map<string, (...a: unknown[]) => Promise<void>>();
  schutzModule.setup!({ bot, on: (event: string, _g: unknown, h: (...a: unknown[]) => Promise<void>) => handlers.set(event, h) } as unknown as ModuleSetup);
  return { bot, handlers };
}

describe('Anti-Nuke (Ablauf)', () => {
  it('dritte Kanal-Löschung → alle Rollen weg + Alarm mit Rollen-Ping', async () => {
    const { guild, alertChannel, attacker } = fakeGuild();
    const { handlers } = setup({ alertChannelId: ALERT, alertRoleId: '100000000000000501', antiNuke: { enabled: true } });
    const entry = { action: AuditLogEvent.ChannelDelete, executorId: attacker.id, changes: [] };
    for (let i = 0; i < 3; i++) await handlers.get('guildAuditLogEntryCreate')!(entry, guild);
    expect(attacker.roles.set).toHaveBeenCalledOnce();
    expect(alertChannel.send).toHaveBeenCalledOnce();
    const msg = alertChannel.send.mock.calls[0]![0] as { content: string; embeds: { title: string; description: string }[] };
    expect(msg.content).toBe('<@&100000000000000501>');
    expect(msg.embeds[0]!.title).toContain('Anti-Nuke');
    expect(msg.embeds[0]!.description).toContain('3× Kanal gelöscht');
  });

  it('der Owner darf alles', async () => {
    const { guild, attacker } = fakeGuild();
    const { handlers } = setup({ antiNuke: { enabled: true } });
    for (let i = 0; i < 5; i++) await handlers.get('guildAuditLogEntryCreate')!({ action: AuditLogEvent.ChannelDelete, executorId: guild.ownerId, changes: [] }, guild);
    expect(attacker.roles.set).not.toHaveBeenCalled();
  });

  it('ausgeschaltete Beobachtung wird ignoriert, Bann als Strafe', async () => {
    const { guild, attacker } = fakeGuild();
    const { handlers } = setup({ antiNuke: { enabled: true, punishment: 'ban', watch: { kick: false } } });
    for (let i = 0; i < 3; i++) await handlers.get('guildAuditLogEntryCreate')!({ action: AuditLogEvent.MemberKick, executorId: attacker.id, changes: [] }, guild);
    expect(guild.members.ban).not.toHaveBeenCalled();
    for (let i = 0; i < 3; i++) await handlers.get('guildAuditLogEntryCreate')!({ action: AuditLogEvent.RoleDelete, executorId: attacker.id, changes: [] }, guild);
    expect(guild.members.ban).toHaveBeenCalledWith(attacker.id, expect.anything());
  });
});

describe('Anti-Raid (Ablauf)', () => {
  it('Beitritts-Welle pausiert Einladungen und alarmiert', async () => {
    const { guild, alertChannel } = fakeGuild();
    guild.id = '100000000000000002'; // eigener Server, damit der Zustand anderer Tests nicht stört
    const { handlers, bot } = setup({ alertChannelId: ALERT, antiRaid: { enabled: true, joins: 5, seconds: 10 } });
    for (let i = 0; i < 5; i++) {
      await handlers.get('guildMemberAdd')!({ guild, id: `u${i}`, user: { bot: false, createdAt: new Date('2020-01-01') } });
    }
    expect(guild.disableInvites).toHaveBeenCalledWith(true);
    expect(bot.redis.set).toHaveBeenCalled();
    const msg = alertChannel.send.mock.calls[0]![0] as { embeds: { title: string }[] };
    expect(msg.embeds[0]!.title).toContain('Raid');
  });
});

describe('Verifizierung (Ablauf)', () => {
  function component(action: string, mode: 'button' | 'captcha', extra: Record<string, unknown> = {}) {
    const { guild } = fakeGuild();
    const member = { roles: { cache: new Map(), add: vi.fn(async () => undefined) } };
    const interaction = {
      guildId: guild.id,
      guild,
      member,
      user: { id: '100000000000000300' },
      isButton: () => action === 'verify',
      isModalSubmit: () => action === 'captcha',
      reply: vi.fn(async () => undefined),
      showModal: vi.fn(async () => undefined),
      ...extra,
    };
    const { bot } = setup({ verification: { enabled: true, roleId: VERIFIED, mode } });
    return { ctx: { interaction, action, args: [], locale: 'de', bot } as unknown as ComponentContext, interaction, member };
  }

  it('Button-Modus: Rolle sofort', async () => {
    const { ctx, member, interaction } = component('verify', 'button');
    await schutzModule.onComponent!(ctx);
    expect(member.roles.add).toHaveBeenCalledWith(VERIFIED, 'Verifizierung');
    expect((interaction.reply.mock.calls[0]![0] as { content: string }).content).toContain('Willkommen');
  });

  it('Captcha-Modus: erst Rechenaufgabe, richtige Antwort → Rolle, falsche → keine', async () => {
    const first = component('verify', 'captcha');
    await schutzModule.onComponent!(first.ctx);
    expect(first.member.roles.add).not.toHaveBeenCalled();
    const modal = first.interaction.showModal.mock.calls[0]![0] as { toJSON(): { components: { label: string }[] } };
    const question = modal.toJSON().components[0]!.label;
    const [, a, b] = /(\d+) \+ (\d+)/.exec(question)!;

    const right = component('captcha', 'captcha', { fields: { getTextInputValue: () => String(Number(a) + Number(b)) } });
    await schutzModule.onComponent!(right.ctx);
    expect(right.member.roles.add).toHaveBeenCalledOnce();

    const again = component('verify', 'captcha');
    await schutzModule.onComponent!(again.ctx);
    const wrong = component('captcha', 'captcha', { fields: { getTextInputValue: () => '0' } });
    await schutzModule.onComponent!(wrong.ctx);
    expect(wrong.member.roles.add).not.toHaveBeenCalled();
    expect((wrong.interaction.reply.mock.calls[0]![0] as { content: string }).content).toContain('falsch');
  });
});
