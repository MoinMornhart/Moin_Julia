import { describe, expect, it, vi } from 'vitest';
import type { BotContext, ModuleSetup } from '../../core/types.js';
import { loggingModule } from './index.js';

/**
 * Verdrahtungs-Test ohne Discord: Ereignis → Einstellungen → Zielkanal → send().
 * Die Discord-Objekte sind auf das Nötigste nachgebaut.
 */

const DEFAULT_LOG = '100000000000000101';
const MESSAGE_LOG = '100000000000000102';
const CHAT = '100000000000000103';
const IGNORED = '100000000000000104';

function fakeChannel() {
  return {
    isTextBased: () => true,
    permissionsFor: () => ({ has: () => true }),
    send: vi.fn(async () => undefined),
  };
}

function setup(config: unknown) {
  const channels = new Map([
    [DEFAULT_LOG, fakeChannel()],
    [MESSAGE_LOG, fakeChannel()],
  ]);
  const guild = {
    id: '100000000000000001',
    memberCount: 42,
    members: { me: { permissions: { has: () => false } } },
    channels: { cache: channels },
  };
  const bot = {
    client: { user: { id: '999' } },
    modules: {
      config: async (_g: string, _m: string, parse: (raw: unknown) => unknown) => parse(config),
      locale: async () => 'de',
    },
    logger: { warn: vi.fn(), error: vi.fn() },
  } as unknown as BotContext;

  const handlers = new Map<string, (...args: unknown[]) => Promise<void>>();
  const ctx = {
    bot,
    on: (event: string, _guildOf: unknown, handler: (...args: unknown[]) => Promise<void>) => handlers.set(event, handler),
  } as unknown as ModuleSetup;
  loggingModule.setup!(ctx);
  return { guild, channels, handlers, bot };
}

function user(id: string, bot = false) {
  return { id, bot, tag: `user${id.slice(-3)}`, displayAvatarURL: () => 'https://cdn.example/a.png', createdAt: new Date('2020-01-01') };
}

function message(guild: unknown, channelId: string, author = user('100000000000000201')) {
  return {
    id: '100000000000000301',
    guildId: '100000000000000001',
    guild,
    channelId,
    partial: false,
    content: 'Hallo zusammen',
    author,
    attachments: { map: () => [] },
  };
}

const baseConfig = {
  defaultChannelId: DEFAULT_LOG,
  categories: { messages: { channelId: MESSAGE_LOG } },
  ignoredChannelIds: [IGNORED],
  ignoreBots: true,
};

describe('Logging-Modul (Verdrahtung)', () => {
  it('registriert alle Ereignisse', () => {
    const { handlers } = setup(baseConfig);
    expect([...handlers.keys()].sort()).toEqual(
      [
        'channelCreate', 'channelDelete', 'channelUpdate', 'guildBanAdd', 'guildBanRemove', 'guildMemberAdd', 'guildMemberRemove',
        'guildMemberUpdate', 'guildUpdate', 'inviteCreate', 'inviteDelete', 'messageDelete', 'messageDeleteBulk', 'messageUpdate',
        'roleCreate', 'roleDelete', 'roleUpdate', 'voiceStateUpdate',
      ].sort(),
    );
  });

  it('gelöschte Nachricht landet im eigenen Nachrichten-Kanal, ohne Pings', async () => {
    const { guild, channels, handlers } = setup(baseConfig);
    await handlers.get('messageDelete')!(message(guild, CHAT));
    const send = channels.get(MESSAGE_LOG)!.send;
    expect(send).toHaveBeenCalledOnce();
    const payload = send.mock.calls[0]![0] as { embeds: { title: string; description: string }[]; allowedMentions: unknown };
    expect(payload.embeds[0]!.title).toContain('Nachricht gelöscht');
    expect(payload.embeds[0]!.description).toBe('Hallo zusammen');
    expect(payload.allowedMentions).toEqual({ parse: [] });
    expect(channels.get(DEFAULT_LOG)!.send).not.toHaveBeenCalled();
  });

  it('ignorierte Kanäle, Log-Kanäle selbst und Bots werden nicht geloggt', async () => {
    const { guild, channels, handlers } = setup(baseConfig);
    await handlers.get('messageDelete')!(message(guild, IGNORED));
    await handlers.get('messageDelete')!(message(guild, MESSAGE_LOG));
    await handlers.get('messageDelete')!(message(guild, CHAT, user('100000000000000202', true)));
    expect(channels.get(MESSAGE_LOG)!.send).not.toHaveBeenCalled();
  });

  it('Bots werden geloggt, wenn „Bots ignorieren“ aus ist', async () => {
    const { guild, channels, handlers } = setup({ ...baseConfig, ignoreBots: false });
    await handlers.get('messageDelete')!(message(guild, CHAT, user('100000000000000202', true)));
    expect(channels.get(MESSAGE_LOG)!.send).toHaveBeenCalledOnce();
  });

  it('ausgeschaltete Kategorie sendet nichts', async () => {
    const { guild, channels, handlers } = setup({ ...baseConfig, categories: { messages: { enabled: false } } });
    await handlers.get('messageDelete')!(message(guild, CHAT));
    expect(channels.get(DEFAULT_LOG)!.send).not.toHaveBeenCalled();
  });

  it('Beitritt geht in den Standard-Kanal', async () => {
    const { guild, channels, handlers } = setup(baseConfig);
    await handlers.get('guildMemberAdd')!({ guild, user: user('100000000000000203') });
    const payload = channels.get(DEFAULT_LOG)!.send.mock.calls[0]![0] as { embeds: { title: string }[] };
    expect(payload.embeds[0]!.title).toContain('beigetreten');
  });

  it('ohne Schreibrecht im Log-Kanal: Warnung statt Absturz', async () => {
    const { guild, channels, handlers, bot } = setup(baseConfig);
    const channel = channels.get(MESSAGE_LOG)!;
    channel.permissionsFor = () => ({ has: () => false });
    await handlers.get('messageDelete')!(message(guild, CHAT));
    expect(channel.send).not.toHaveBeenCalled();
    expect(bot.logger.warn).toHaveBeenCalledOnce();
  });
});
