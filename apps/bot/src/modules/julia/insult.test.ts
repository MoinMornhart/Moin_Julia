import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotContext, ModuleSetup } from '../../core/types.js';
import * as providers from './providers.js';
import { juliaModule, resetRateLimits } from './index.js';

vi.mock('./providers.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./providers.js')>();
  return { ...actual, claudeComplete: vi.fn() };
});
const settings = { instanceOwnerId: '100000000000000777', juliaRoyal: null as unknown, anthropicApiKey: 'sk-test' };
vi.mock('@moin/db', async (importOriginal) => ({ ...(await importOriginal<typeof import('@moin/db')>()), loadSettings: vi.fn(async () => settings) }));

const G = '100000000000000001';
const CHAT = '100000000000000023';
const LOG = '100000000000000028';
const BOT = '100000000000000999';

function setup(config: Record<string, unknown>) {
  const log = { isSendable: () => true, send: vi.fn(async () => ({})) };
  const notice = { delete: vi.fn(async () => undefined) };
  const channel = { id: CHAT, isThread: () => false, isSendable: () => true, send: vi.fn(async () => notice), sendTyping: vi.fn(async () => undefined), messages: { fetch: vi.fn(async () => new Map()) } };
  const guild = { id: G, name: 'Moin', channels: { cache: new Map([[LOG, log]]) }, members: { me: { displayName: 'Julia' }, cache: new Map() } };
  const bot = {
    client: { user: { id: BOT, username: 'Julia', globalName: 'Julia' }, users: { fetch: vi.fn(async () => ({ globalName: 'Philip', username: 'philip' })) } },
    prisma: { appSetting: { findMany: vi.fn(async () => []) }, juliaProfile: { findUnique: vi.fn(async () => null) }, juliaChannelMode: { findUnique: vi.fn(async () => null) }, juliaUsage: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({ costMicroUsd: 0 })) } },
    logger: { warn: vi.fn(), info: vi.fn() },
    modules: { config: async (_g: string, _m: string, parse: (raw: unknown) => unknown) => parse({ chatChannelIds: [CHAT], logChannelId: LOG, userCooldownSeconds: 0, ...config }), locale: async () => 'de' },
  } as unknown as BotContext;
  let handler: ((m: unknown) => void) | undefined;
  juliaModule.setup!({ bot, on: ((_event: string, _g: unknown, fn: (m: unknown) => void) => (handler = fn)) as never } as unknown as Parameters<NonNullable<typeof juliaModule.setup>>[0] as never as ModuleSetup);
  const send = async (text: string, authorId = '100000000000000300') => {
    const msg = {
      id: '1',
      inGuild: () => true,
      guildId: G,
      guild,
      channel,
      channelId: CHAT,
      author: { id: authorId, bot: false, username: 'anna', displayName: 'Anna' },
      member: { id: authorId, displayName: 'Anna', roles: { cache: new Map() }, permissions: { has: () => false } },
      webhookId: null,
      system: false,
      cleanContent: text,
      mentions: { users: new Map(), repliedUser: null },
      deletable: true,
      delete: vi.fn(async () => undefined),
      reply: vi.fn(async () => ({})),
    };
    handler!(msg);
    await new Promise((r) => setTimeout(r, 20));
    return msg;
  };
  return { send, log, channel };
}

describe('Julia: Beleidigungs-Schutz im Chat', () => {
  beforeEach(() => {
    resetRateLimits();
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    vi.mocked(providers.claudeComplete).mockReset();
    vi.mocked(providers.claudeComplete).mockResolvedValue({ text: 'Moin!', refused: false, usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } });
  });

  it('eingeschaltet: Beleidigung wird gelöscht, gemeldet, Julia antwortet nicht', async () => {
    const w = setup({ insultGuard: { enabled: true } });
    const msg = await w.send('Julia du 1d10t');
    expect(msg.delete).toHaveBeenCalled();
    expect(providers.claudeComplete).not.toHaveBeenCalled();
    const embed = (w.log.send.mock.calls[0]![0] as { embeds: { title: string; description: string }[] }).embeds[0]!;
    expect(embed.title).toBe('🚫 Beleidigung gegen Julia');
    expect(embed.description).toContain('**Erkannt:** „idiot“');
    expect(embed.description).toContain('**Gelöscht:** ja');
    expect(w.channel.send).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('bitte bleib freundlich') }));
  });

  it('nur melden: Nachricht bleibt stehen', async () => {
    const w = setup({ insultGuard: { enabled: true, deleteMessage: false } });
    const msg = await w.send('halt die Fresse');
    expect(msg.delete).not.toHaveBeenCalled();
    expect((w.log.send.mock.calls[0]![0] as { embeds: { description: string }[] }).embeds[0]!.description).toContain('**Gelöscht:** nein');
  });

  it('ausgeschaltet, Herrscher oder freundlich: normale Antwort', async () => {
    const off = await setup({}).send('du Idiot');
    expect(off.delete).not.toHaveBeenCalled();
    const ruler = setup({ insultGuard: { enabled: true } });
    const byOwner = await ruler.send('du Idiot', '100000000000000777');
    expect(byOwner.delete).not.toHaveBeenCalled();
    const nice = setup({ insultGuard: { enabled: true } });
    const msg = await nice.send('Moin Julia, wie geht es dir?');
    expect(msg.delete).not.toHaveBeenCalled();
    expect(nice.log.send).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(providers.claudeComplete).toHaveBeenCalled(), { timeout: 2000 });
  });
});
