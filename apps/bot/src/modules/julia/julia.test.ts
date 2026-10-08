import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../../core/types.js';
import * as providers from './providers.js';
import { askJulia, rateCheck, resetRateLimits } from './index.js';

vi.mock('./providers.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./providers.js')>();
  return { ...actual, claudeComplete: vi.fn(), ollamaComplete: vi.fn() };
});

const actual = await vi.importActual<typeof import('./providers.js')>('./providers.js');
const GUILD = '100000000000000001';
const LOG = '100000000000000028';

function world(config: Record<string, unknown>, spentMicro = 0) {
  const usage = { id: 'u1', costMicroUsd: spentMicro, requests: 0, warnedPercent: 0 };
  const log = { isSendable: () => true, send: vi.fn(async () => undefined) };
  const guild = { id: GUILD, name: 'Moin', channels: { cache: new Map([[LOG, log]]) } };
  const member = { id: '100000000000000300', roles: { cache: new Map() } };
  const bot = {
    prisma: {
      appSetting: { findMany: vi.fn(async () => []) },
      juliaUsage: {
        findUnique: vi.fn(async () => ({ ...usage })),
        upsert: vi.fn(async ({ update }: { update: { costMicroUsd: { increment: number } } }) => {
          usage.costMicroUsd += update.costMicroUsd.increment;
          usage.requests++;
          return { ...usage };
        }),
        update: vi.fn(async ({ data }: { data: { warnedPercent: number } }) => Object.assign(usage, data)),
      },
    },
    logger: { warn: vi.fn() },
    client: { user: { id: '999', username: 'Julia' } },
    modules: { config: async (_g: string, _m: string, parse: (raw: unknown) => unknown) => parse({ logChannelId: LOG, ...config }), locale: async () => 'de' },
  } as unknown as BotContext;
  return { bot, guild, member, usage, log };
}

const history = [{ fromBot: false, name: 'Anna', text: 'Moin Julia!' }];
const reply = (text: string, usage = { input: 1000, output: 100, cacheRead: 0, cacheWrite: 0 }) => ({ text, refused: false, usage });

describe('Julia im Bot', () => {
  beforeEach(() => {
    resetRateLimits();
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    vi.mocked(providers.claudeComplete).mockReset();
  });
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OLLAMA_URL;
    delete process.env.OLLAMA_MODEL;
  });

  it('antwortet und bucht die Kosten', async () => {
    vi.mocked(providers.claudeComplete).mockResolvedValue(reply('Moin Anna! ⚓'));
    const w = world({});
    const out = await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, history, quietWhenLimited: false });
    expect(out).toEqual({ kind: 'reply', parts: ['Moin Anna! ⚓'] });
    // Haiku: 1000 Input × 1 $ + 100 Output × 5 $ pro Mio. = 1.500 Mikro-Dollar
    expect(w.usage.costMicroUsd).toBe(1500);
    const call = vi.mocked(providers.claudeComplete).mock.calls[0]![0];
    expect(call.model).toBe('claude-haiku-4-5');
    expect(call.system).toMatch(/^Regeln/);
    expect(call.messages).toEqual([{ role: 'user', content: '[Anna]: Moin Julia!' }]);
  });

  it('Budget aufgebraucht: keine Anfrage, Hinweis (im Chat-Kanal still)', async () => {
    const w = world({ monthlyBudgetUsd: 1 }, 1_000_000);
    expect(await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, history, quietWhenLimited: false })).toEqual({ kind: 'notice', key: 'julia.budget' });
    expect(await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, history, quietWhenLimited: true })).toEqual({ kind: 'silent' });
    expect(providers.claudeComplete).not.toHaveBeenCalled();
  });

  it('warnt einmal im Log-Kanal, wenn die Warnschwelle erreicht ist', async () => {
    vi.mocked(providers.claudeComplete).mockResolvedValue(reply('ok', { input: 0, output: 30_000, cacheRead: 0, cacheWrite: 0 })); // 0,15 $
    const w = world({ monthlyBudgetUsd: 1, warnAtPercent: 80, userCooldownSeconds: 0 }, 700_000);
    await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, history, quietWhenLimited: false });
    expect(w.log.send).toHaveBeenCalledTimes(1);
    expect(w.log.send).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('85 %') }));
    // nächste Anfrage erreicht 100 % → letzte Warnung; danach ist Schluss
    await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, history, quietWhenLimited: false });
    expect(w.log.send).toHaveBeenCalledTimes(2);
    expect(w.log.send).toHaveBeenLastCalledWith(expect.objectContaining({ content: expect.stringContaining('100 %') }));
    expect(await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, history, quietWhenLimited: false })).toEqual({ kind: 'notice', key: 'julia.budget' });
    expect(w.log.send).toHaveBeenCalledTimes(2);
  });

  it('Abklingzeit und Sperr-Rolle', async () => {
    vi.mocked(providers.claudeComplete).mockResolvedValue(reply('Hi'));
    const w = world({ userCooldownSeconds: 30, blockedRoleIds: ['100000000000000901'] });
    await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, history, quietWhenLimited: false });
    expect(await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, history, quietWhenLimited: false })).toEqual({ kind: 'notice', key: 'julia.cooldown' });
    const blocked = { id: '2', roles: { cache: new Map([['100000000000000901', {}]]) } };
    expect(await askJulia(w.bot, { guild: w.guild as never, member: blocked as never, history, quietWhenLimited: false })).toEqual({ kind: 'notice', key: 'julia.blocked' });
  });

  it('ohne Schlüssel: „nicht verbunden“; Ollama ohne Budget', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const w = world({});
    expect(await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, history, quietWhenLimited: false })).toEqual({ kind: 'notice', key: 'julia.notConnected' });
    process.env.OLLAMA_URL = 'http://ollama:11434';
    process.env.OLLAMA_MODEL = 'llama3.2';
    vi.mocked(providers.ollamaComplete).mockResolvedValue(reply('Lokal!'));
    resetRateLimits();
    const w2 = world({ provider: 'ollama', monthlyBudgetUsd: 0 });
    expect(await askJulia(w2.bot, { guild: w2.guild as never, member: w2.member as never, history, quietWhenLimited: false })).toEqual({ kind: 'reply', parts: ['Lokal!'] });
    expect(w2.usage.costMicroUsd).toBe(0);
  });

  it('Stundenlimit', () => {
    const cfg = { userCooldownSeconds: 0, perUserPerHour: 2 };
    expect(rateCheck('k', cfg, 0)).toBe('ok');
  });
});

describe('Anbieter', () => {
  it('Claude: Text, Verbrauch, Caching, wenig Aufwand bei Sonnet/Opus', async () => {
    const create = vi.fn(async () => ({
      content: [{ type: 'text', text: 'Moin!' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 600, cache_creation_input_tokens: null },
    }));
    const client = { messages: { create } } as never;
    const r = await actual.claudeComplete({ apiKey: 'x', model: 'claude-sonnet-5-5', system: 'S', messages: [{ role: 'user', content: 'hi' }] }, client);
    expect(r).toEqual({ text: 'Moin!', refused: false, usage: { input: 10, output: 5, cacheRead: 600, cacheWrite: 0 } });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ system: [{ type: 'text', text: 'S', cache_control: { type: 'ephemeral' } }], output_config: { effort: 'low' } }));
    await actual.claudeComplete({ apiKey: 'x', model: 'claude-haiku-4-5', system: 'S', messages: [] }, client);
    expect((create.mock.calls[1] as unknown[])[0]).not.toHaveProperty('output_config');
  });

  it('Claude: Ablehnung wird erkannt', async () => {
    const client = { messages: { create: async () => ({ content: [], stop_reason: 'refusal', usage: { input_tokens: 1, output_tokens: 0 } }) } } as never;
    expect((await actual.claudeComplete({ apiKey: 'x', model: 'claude-haiku-4-5', system: 'S', messages: [] }, client)).refused).toBe(true);
  });

  it('Ollama: Antwort ohne <think>, Fehler verständlich', async () => {
    const ok = (async () => new Response(JSON.stringify({ message: { content: '<think>hmm</think>Moin aus Ollama' }, prompt_eval_count: 20, eval_count: 7 }))) as unknown as typeof fetch;
    expect(await actual.ollamaComplete({ url: 'http://o:11434/', model: 'm', system: 'S', messages: [] }, ok)).toEqual({ text: 'Moin aus Ollama', refused: false, usage: { input: 20, output: 7, cacheRead: 0, cacheWrite: 0 } });
    const missing = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    await expect(actual.ollamaComplete({ url: 'http://o', model: 'llama9', system: 'S', messages: [] }, missing)).rejects.toThrow(/ollama pull llama9/);
    const down = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    await expect(actual.ollamaComplete({ url: 'http://o', model: 'm', system: 'S', messages: [] }, down)).rejects.toThrow(/nicht erreichbar/);
  });
});
