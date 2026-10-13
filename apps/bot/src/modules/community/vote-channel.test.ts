import { describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../../core/types.js';
import { pollCommand } from './extras.js';
import { suggestCommand } from './suggestions.js';

const GUILD = '100000000000000001';
const SUGGEST = '100000000000000021';
const VOTE = '100000000000000022';
const POLLS = '100000000000000023';
const HERE = '100000000000000024';

function channel(id: string) {
  return { id, isSendable: () => true, isTextBased: () => true, send: vi.fn(async () => ({ id: `m-${id}`, url: `https://discord.com/x/${id}`, startThread: vi.fn(async () => undefined) })), messages: { delete: vi.fn(async () => undefined) } };
}

function setup(config: Record<string, unknown>) {
  const chans = new Map([SUGGEST, VOTE, POLLS, HERE].map((id) => [id, channel(id)]));
  const guild = { id: GUILD, name: 'Moin', channels: { cache: chans } };
  const bot = {
    prisma: {
      guild: { update: vi.fn(async () => ({ suggestionCounter: 7 })) },
      suggestion: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 's1', status: 'open', upvotes: 0, downvotes: 0, createdAt: new Date(), ...data })), update: vi.fn(async () => ({})) },
    },
    redis: { get: vi.fn(async () => 'panel-msg'), set: vi.fn(async () => 'OK') },
    logger: { warn: vi.fn() },
    modules: { config: async (_g: string, _m: string, parse: (raw: unknown) => unknown) => parse(config), locale: async () => 'de', isEnabled: async () => true },
  } as unknown as BotContext;
  const member = { id: '100000000000000300', user: { username: 'anna' }, displayName: 'Anna', displayAvatarURL: () => '', permissions: { has: () => true }, roles: { cache: new Map() } };
  return { bot, guild, member, chans };
}

describe('Abstimmungen in eigenem Kanal (Issue #7)', () => {
  it('Vorschlag landet im Abstimmungs-Kanal, der Knopf-Kanal bleibt ruhig', async () => {
    const w = setup({ suggestions: { enabled: true, channelId: SUGGEST, voteChannelId: VOTE, threads: false } });
    const editReply = vi.fn(async () => undefined);
    const interaction = {
      inCachedGuild: () => true,
      guildId: GUILD,
      guild: w.guild,
      member: w.member,
      deferReply: vi.fn(async () => undefined),
      editReply,
      reply: vi.fn(),
      options: { getString: (n: string) => (n === 'text' ? 'Mehr Emojis bitte' : null) },
    };
    await suggestCommand.execute({ interaction: interaction as never, bot: w.bot, locale: 'de' } as never);
    expect(w.chans.get(VOTE)!.send).toHaveBeenCalledTimes(1);
    expect(w.chans.get(SUGGEST)!.send).not.toHaveBeenCalled();
    expect(String((editReply.mock.calls[0] as unknown as [{ content: string }])[0].content)).toContain(`<#${VOTE}>`);
  });

  it('ohne Abstimmungs-Kanal wie bisher im Vorschlags-Kanal', async () => {
    const w = setup({ suggestions: { enabled: true, channelId: SUGGEST, threads: false } });
    const interaction = {
      inCachedGuild: () => true,
      guildId: GUILD,
      guild: w.guild,
      member: w.member,
      deferReply: vi.fn(async () => undefined),
      editReply: vi.fn(async () => undefined),
      reply: vi.fn(),
      options: { getString: (n: string) => (n === 'text' ? 'Mehr Emojis bitte' : null) },
    };
    await suggestCommand.execute({ interaction: interaction as never, bot: w.bot, locale: 'de' } as never);
    expect(w.chans.get(SUGGEST)!.send).toHaveBeenCalled();
  });

  it('Umfrage geht in den festen Umfrage-Kanal, hier nur eine kurze Bestätigung', async () => {
    const w = setup({ polls: { channelId: POLLS } });
    const reply = vi.fn(async () => undefined);
    const interaction = {
      inCachedGuild: () => true,
      guildId: GUILD,
      channelId: HERE,
      guild: w.guild,
      member: w.member,
      reply,
      options: {
        getString: (n: string) => (n === 'frage' ? 'Pizza?' : n === 'antworten' ? 'Ja; Nein' : null),
        getInteger: () => null,
        getBoolean: () => null,
      },
    };
    await pollCommand.execute({ interaction: interaction as never, bot: w.bot, locale: 'de' } as never);
    expect(w.chans.get(POLLS)!.send).toHaveBeenCalledWith(expect.objectContaining({ poll: expect.objectContaining({ question: { text: 'Pizza?' } }) }));
    expect(reply).toHaveBeenCalledWith(expect.objectContaining({ content: `📊 Umfrage gepostet in <#${POLLS}>.` }));
  });
});
