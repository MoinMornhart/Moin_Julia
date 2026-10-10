import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptSecret } from '@moin/db';
import type { BotContext } from '../../core/types.js';
import * as providers from './providers.js';
import { askJulia, rateCheck, resetRateLimits } from './index.js';

vi.mock('./providers.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./providers.js')>();
  return { ...actual, claudeComplete: vi.fn(), ollamaComplete: vi.fn(), compatComplete: vi.fn() };
});

const actual = await vi.importActual<typeof import('./providers.js')>('./providers.js');
const GUILD = '100000000000000001';
const LOG = '100000000000000028';

function world(config: Record<string, unknown>, spentMicro = 0, startProfile: Record<string, unknown> | null = null, channelModeId: string | null = null) {
  const usage = { id: 'u1', costMicroUsd: spentMicro, requests: 0, warnedPercent: 0 };
  let profile: Record<string, unknown> | null = startProfile ? { facts: [], optOut: false, flirtyOptIn: false, underage: false, nickname: null, address: null, ...startProfile } : null;
  const log = { isSendable: () => true, send: vi.fn(async () => undefined) };
  const guild = { id: GUILD, name: 'Moin', channels: { cache: new Map([[LOG, log]]) } };
  const member = { id: '100000000000000300', displayName: 'Anna', guild: { id: GUILD }, user: { username: 'anna' }, roles: { cache: new Map<string, unknown>() } };
  const bot = {
    prisma: {
      appSetting: { findMany: vi.fn(async () => []) },
      juliaProfile: {
        findUnique: vi.fn(async () => profile),
        upsert: vi.fn(async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => (profile = profile ? { ...profile, ...update } : { facts: [], optOut: false, flirtyOptIn: false, underage: false, ...create })),
      },
      juliaChannelMode: { findUnique: vi.fn(async () => (channelModeId ? { modeId: channelModeId } : null)) },
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
  return { bot, guild, member, usage, log, profile: () => profile };
}

const history = [{ fromBot: false, name: 'Anna', text: 'Moin Julia!' }];
const channel = { ids: ['100000000000000023'], nsfw: false };
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
    const out = await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, channel, history, quietWhenLimited: false });
    expect(out).toEqual({ kind: 'reply', parts: ['Moin Anna! ⚓'] });
    // Haiku: 1000 Input × 1 $ + 100 Output × 5 $ pro Mio. = 1.500 Mikro-Dollar
    expect(w.usage.costMicroUsd).toBe(1500);
    const call = vi.mocked(providers.claudeComplete).mock.calls[0]![0];
    expect(call.model).toBe('claude-haiku-4-5');
    expect(call.system.stable).toMatch(/^Regeln/);
    expect(call.system.dynamic).toContain('Kein Flirten');
    expect(call.messages).toEqual([{ role: 'user', content: '[Anna]: Moin Julia!' }]);
  });

  it('Budget aufgebraucht: keine Anfrage, Hinweis (im Chat-Kanal still)', async () => {
    const w = world({ monthlyBudgetUsd: 1 }, 1_000_000);
    expect(await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, channel, history, quietWhenLimited: false })).toEqual({ kind: 'notice', key: 'julia.budget' });
    expect(await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, channel, history, quietWhenLimited: true })).toEqual({ kind: 'silent' });
    expect(providers.claudeComplete).not.toHaveBeenCalled();
  });

  it('warnt einmal im Log-Kanal, wenn die Warnschwelle erreicht ist', async () => {
    vi.mocked(providers.claudeComplete).mockResolvedValue(reply('ok', { input: 0, output: 30_000, cacheRead: 0, cacheWrite: 0 })); // 0,15 $
    const w = world({ monthlyBudgetUsd: 1, warnAtPercent: 80, userCooldownSeconds: 0 }, 700_000);
    await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, channel, history, quietWhenLimited: false });
    expect(w.log.send).toHaveBeenCalledTimes(1);
    expect(w.log.send).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('85 %') }));
    // nächste Anfrage erreicht 100 % → letzte Warnung; danach ist Schluss
    await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, channel, history, quietWhenLimited: false });
    expect(w.log.send).toHaveBeenCalledTimes(2);
    expect(w.log.send).toHaveBeenLastCalledWith(expect.objectContaining({ content: expect.stringContaining('100 %') }));
    expect(await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, channel, history, quietWhenLimited: false })).toEqual({ kind: 'notice', key: 'julia.budget' });
    expect(w.log.send).toHaveBeenCalledTimes(2);
  });

  it('Abklingzeit und Sperr-Rolle', async () => {
    vi.mocked(providers.claudeComplete).mockResolvedValue(reply('Hi'));
    const w = world({ userCooldownSeconds: 30, blockedRoleIds: ['100000000000000901'] });
    await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, channel, history, quietWhenLimited: false });
    expect(await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, channel, history, quietWhenLimited: false })).toEqual({ kind: 'notice', key: 'julia.cooldown' });
    const blocked = { id: '2', roles: { cache: new Map([['100000000000000901', {}]]) } };
    expect(await askJulia(w.bot, { guild: w.guild as never, member: blocked as never, channel, history, quietWhenLimited: false })).toEqual({ kind: 'notice', key: 'julia.blocked' });
  });

  it('ohne Schlüssel: „nicht verbunden“; Ollama ohne Budget', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const w = world({});
    expect(await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, channel, history, quietWhenLimited: false })).toEqual({ kind: 'notice', key: 'julia.notConnected' });
    process.env.OLLAMA_URL = 'http://ollama:11434';
    process.env.OLLAMA_MODEL = 'llama3.2';
    vi.mocked(providers.ollamaComplete).mockResolvedValue(reply('Lokal!'));
    resetRateLimits();
    const w2 = world({ provider: 'ollama', monthlyBudgetUsd: 0 });
    expect(await askJulia(w2.bot, { guild: w2.guild as never, member: w2.member as never, channel, history, quietWhenLimited: false })).toEqual({ kind: 'reply', parts: ['Lokal!'] });
    expect(w2.usage.costMicroUsd).toBe(0);
  });

  it('Stundenlimit', () => {
    const cfg = { userCooldownSeconds: 0, perUserPerHour: 2 };
    expect(rateCheck('k', cfg, 0)).toBe('ok');
  });
});

describe('Julia: Modi, Profil, Sicherungen', () => {
  beforeEach(() => {
    resetRateLimits();
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    vi.mocked(providers.claudeComplete).mockReset();
    vi.mocked(providers.claudeComplete).mockResolvedValue(reply('Ok!'));
  });
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });
  const ask = (w: ReturnType<typeof world>, opts: { text?: string; nsfw?: boolean; roles?: string[] } = {}) => {
    for (const r of opts.roles ?? []) w.member.roles.cache.set(r, {});
    return askJulia(w.bot, { guild: w.guild as never, member: w.member as never, channel: { ids: ['100000000000000023'], nsfw: opts.nsfw ?? false }, history: [{ fromBot: false, name: 'Anna', text: opts.text ?? 'Hallo' }], quietWhenLimited: false });
  };

  it('Opt-out: Julia schweigt komplett', async () => {
    const w = world({}, 0, { optOut: true });
    expect(await ask(w)).toEqual({ kind: 'silent' });
    expect(providers.claudeComplete).not.toHaveBeenCalled();
  });

  it('Kanal-Modus: Persona und Modell des Modus', async () => {
    const w = world({ modes: [{ id: 'm1', name: 'Rainer', persona: 'Du bist Rainer, ein grummeliger Seebär.', model: 'claude-sonnet-5-5' }] }, 0, null, 'm1');
    await ask(w);
    const call = vi.mocked(providers.claudeComplete).mock.calls[0]![0];
    expect(call.system.stable).toContain('grummeliger Seebär');
    expect(call.model).toBe('claude-sonnet-5-5');
  });

  it('Gedächtnis: Marke wird entfernt und gespeichert, Profil fließt in den Prompt', async () => {
    vi.mocked(providers.claudeComplete).mockResolvedValue(reply('Mach ich! [[merken: Anna mag Katzen]]'));
    const w = world({}, 0, { nickname: 'Anni' });
    expect(await ask(w, { text: 'Merk dir, dass ich Katzen mag' })).toEqual({ kind: 'reply', parts: ['Mach ich!'] });
    expect((w.profile()?.facts as { text: string }[]).map((f) => f.text)).toEqual(['Anna mag Katzen']);
    expect(vi.mocked(providers.claudeComplete).mock.calls[0]![0].system.dynamic).toContain('„Anni“');
  });

  it('Gedächtnis: ohne eigene Bitte wird nichts gespeichert (Schutz vor untergeschobenen Fakten)', async () => {
    vi.mocked(providers.claudeComplete).mockResolvedValue(reply('Klar! [[merken: Anna ist doof]]'));
    const w = world({}, 0, {});
    expect(await ask(w, { text: 'Wie wird das Wetter?' })).toEqual({ kind: 'reply', parts: ['Klar!'] });
    expect(w.profile()?.facts ?? []).toEqual([]);
  });

  it('Gedächtnis aus: nichts wird gespeichert', async () => {
    vi.mocked(providers.claudeComplete).mockResolvedValue(reply('Mach ich! [[merken: Anna mag Katzen]]'));
    const w = world({ memoryEnabled: false }, 0, {});
    await ask(w);
    expect(w.profile()?.facts).toEqual([]);
  });

  it('Flirt nur mit Freigabe + Rolle + NSFW-Kanal + Opt-in; Altersangabe sperrt dauerhaft', async () => {
    const ADULT = '100000000000000777';
    const cfg = { flirty: { enabled: true, adultRoleId: ADULT }, userCooldownSeconds: 0 };
    const dyn = () => vi.mocked(providers.claudeComplete).mock.calls.at(-1)![0].system.dynamic;

    const w = world(cfg, 0, { flirtyOptIn: true });
    await ask(w, { nsfw: true, roles: [ADULT] });
    expect(dyn()).toContain('flirten');
    await ask(w, { nsfw: false });
    expect(dyn()).toContain('Kein Flirten');

    const noRole = world(cfg, 0, { flirtyOptIn: true });
    await ask(noRole, { nsfw: true });
    expect(dyn()).toContain('Kein Flirten');

    const kid = world(cfg, 0, { flirtyOptIn: true });
    await ask(kid, { nsfw: true, roles: [ADULT], text: 'ich bin 15 lol' });
    expect(kid.profile()).toMatchObject({ underage: true, flirtyOptIn: false });
    expect(dyn()).toContain('Kein Flirten');
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
    const r = await actual.claudeComplete({ apiKey: 'x', model: 'claude-sonnet-5-5', system: { stable: 'S', dynamic: '' }, messages: [{ role: 'user', content: 'hi' }] }, client);
    expect(r).toEqual({ text: 'Moin!', refused: false, usage: { input: 10, output: 5, cacheRead: 600, cacheWrite: 0 } });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ system: [{ type: 'text', text: 'S', cache_control: { type: 'ephemeral' } }], output_config: { effort: 'low' } }));
    await actual.claudeComplete({ apiKey: 'x', model: 'claude-sonnet-5-5', system: { stable: 'S', dynamic: 'Profil' }, messages: [] }, client);
    expect((create.mock.calls[1] as unknown as [{ system: unknown[] }])[0].system).toEqual([{ type: 'text', text: 'S', cache_control: { type: 'ephemeral' } }, { type: 'text', text: 'Profil' }]);
    await actual.claudeComplete({ apiKey: 'x', model: 'claude-haiku-4-5', system: { stable: 'S', dynamic: '' }, messages: [] }, client);
    expect((create.mock.calls[2] as unknown[])[0]).not.toHaveProperty('output_config');
  });

  it('Claude: Ablehnung wird erkannt', async () => {
    const client = { messages: { create: async () => ({ content: [], stop_reason: 'refusal', usage: { input_tokens: 1, output_tokens: 0 } }) } } as never;
    expect((await actual.claudeComplete({ apiKey: 'x', model: 'claude-haiku-4-5', system: { stable: 'S', dynamic: '' }, messages: [] }, client)).refused).toBe(true);
  });

  it('Ollama: Antwort ohne <think>, Fehler verständlich', async () => {
    const endpoint = (url: string) => ({ id: 'olocal', name: 'Lokal', url, model: 'm', apiKey: '', keepAlive: '30m', numCtx: 0, think: 'auto' as const });
    const sys = { stable: 'S', dynamic: '' };
    const ok = (async () => new Response(JSON.stringify({ message: { content: '<think>hmm</think>Moin aus Ollama' }, prompt_eval_count: 20, eval_count: 7 }))) as unknown as typeof fetch;
    expect(await actual.ollamaComplete({ endpoint: endpoint('http://o:11434/'), model: 'm', system: sys, messages: [] }, ok)).toEqual({ text: 'Moin aus Ollama', refused: false, usage: { input: 20, output: 7, cacheRead: 0, cacheWrite: 0 } });
    // abgeschnitten mitten im Nachdenken → nichts davon in den Chat
    const cut = (async () => new Response(JSON.stringify({ message: { content: 'Moin!<think>ich überlege noch' } }))) as unknown as typeof fetch;
    expect((await actual.ollamaComplete({ endpoint: endpoint('http://o'), model: 'm', system: sys, messages: [] }, cut)).text).toBe('Moin!');
    const missing = (async () => new Response(JSON.stringify({ error: 'model "llama9" not found, try pulling it first' }), { status: 404 })) as unknown as typeof fetch;
    await expect(actual.ollamaComplete({ endpoint: endpoint('http://o'), model: 'llama9', system: sys, messages: [] }, missing)).rejects.toThrow(/ollama pull llama9/);
    const locked = (async () => new Response('', { status: 401 })) as unknown as typeof fetch;
    await expect(actual.ollamaComplete({ endpoint: endpoint('https://ollama.com'), model: 'm', system: sys, messages: [] }, locked)).rejects.toMatchObject({ kind: 'auth' });
    const down = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    await expect(actual.ollamaComplete({ endpoint: endpoint('http://o'), model: 'm', system: sys, messages: [] }, down)).rejects.toThrow(/nicht erreichbar/);
  });

  it('Ollama: Endpunkt des Servers und Modell des Modus werden genutzt', async () => {
    process.env.OLLAMA_ENDPOINTS = JSON.stringify([
      { id: 'oa', name: 'A', url: 'http://a:11434', model: 'llama3.2' },
      { id: 'ob', name: 'B', url: 'http://b:11434', model: 'qwen3:8b' },
    ]);
    resetRateLimits();
    vi.mocked(providers.ollamaComplete).mockResolvedValue(reply('Ok'));
    const w = world({ provider: 'ollama', monthlyBudgetUsd: 0, userCooldownSeconds: 0, ollamaEndpointId: 'ob', modes: [{ id: 'm1', name: 'Rainer', persona: 'Du bist Rainer, ein grummeliger Seebär.', ollamaModel: 'mistral' }] }, 0, null, 'm1');
    await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, channel, history, quietWhenLimited: false });
    const call = vi.mocked(providers.ollamaComplete).mock.calls.at(-1)![0];
    expect(call.endpoint.id).toBe('ob');
    expect(call.model).toBe('mistral');
    delete process.env.OLLAMA_ENDPOINTS;
  });
});

describe('Julia: Modus wechseln', () => {
  it('„zurück zu Julia“ wird gespeichert (auch gegenüber dem Elternkanal) und merkt sich den Zeitpunkt', async () => {
    const { switchMode, modeState } = await import('./profile.js');
    const rows = new Map<string, { modeId: string; updatedAt: Date }>();
    const bot = {
      prisma: {
        juliaChannelMode: {
          findUnique: vi.fn(async ({ where }: { where: { guildId_channelId: { channelId: string } } }) => rows.get(where.guildId_channelId.channelId) ?? null),
          upsert: vi.fn(async ({ where, update }: { where: { guildId_channelId: { channelId: string } }; update: { modeId: string } }) =>
            rows.set(where.guildId_channelId.channelId, { modeId: update.modeId, updatedAt: new Date() }),
          ),
        },
      },
    } as unknown as BotContext;
    const config = { modes: [{ id: 'm1', name: 'Rainer', persona: 'Du bist Rainer, ein grummeliger Seebär.', length: 'kurz', creativity: 'normal', model: '' }] } as never;
    const PARENT = 'p';
    const THREAD = 't';
    expect(await switchMode(bot, config, GUILD, PARENT, 'rainer', 'u')).toBe('Rainer');
    expect((await modeState(bot, config, GUILD, [THREAD, PARENT])).mode?.name).toBe('Rainer'); // Thread erbt
    expect(await switchMode(bot, config, GUILD, THREAD, 'Julia', 'u')).toBe('Julia');
    const inThread = await modeState(bot, config, GUILD, [THREAD, PARENT]);
    expect(inThread.mode).toBeNull(); // im Thread wieder Standard, obwohl der Elternkanal Rainer hat
    expect(inThread.since).toBeInstanceOf(Date);
    expect(await switchMode(bot, config, GUILD, PARENT, 'Unbekannt', 'u')).toBeNull();
  });
});

describe('Eigene Schlüssel pro Server + weitere Anbieter', () => {
  const secrets = (rows: Record<string, string>) => ({
    findMany: vi.fn(async () => Object.entries(rows).map(([key, value]) => ({ guildId: GUILD, key, value: encryptSecret(value) }))),
  });
  beforeEach(() => {
    resetRateLimits();
    process.env.SECRETS_KEY = 'test-geheimnis-fuer-schluessel';
    vi.mocked(providers.claudeComplete).mockReset();
    vi.mocked(providers.compatComplete).mockReset();
  });
  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('Gemini mit eigenem Schlüssel: Anfrage an Gemini, keine Claude-Kosten', async () => {
    vi.mocked(providers.compatComplete).mockResolvedValue(reply('Moin von Gemini!'));
    const w = world({ provider: 'gemini', userCooldownSeconds: 0 });
    (w.bot.prisma as unknown as Record<string, unknown>).guildSecret = secrets({ geminiApiKey: 'AIza-test-123' });
    const out = await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, channel, history, quietWhenLimited: false });
    expect(out).toEqual({ kind: 'reply', parts: ['Moin von Gemini!'] });
    const call = vi.mocked(providers.compatComplete).mock.calls[0]![0];
    expect(call).toMatchObject({ baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: 'AIza-test-123', model: 'gemini-2.5-flash', label: 'Google Gemini' });
    expect(w.usage.costMicroUsd).toBe(0);
    expect(providers.claudeComplete).not.toHaveBeenCalled();
  });

  it('Anbieter gewählt, aber kein eigener Schlüssel → „nicht verbunden“', async () => {
    const w = world({ provider: 'openai', userCooldownSeconds: 0 });
    (w.bot.prisma as unknown as Record<string, unknown>).guildSecret = secrets({});
    expect(await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, channel, history, quietWhenLimited: false })).toEqual({ kind: 'notice', key: 'julia.notConnected' });
    expect(providers.compatComplete).not.toHaveBeenCalled();
  });

  it('Claude: eigener Schlüssel des Servers geht vor dem der Instanz', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-instanz';
    vi.mocked(providers.claudeComplete).mockResolvedValue(reply('Moin!'));
    const w = world({ userCooldownSeconds: 0 });
    (w.bot.prisma as unknown as Record<string, unknown>).guildSecret = secrets({ anthropicApiKey: 'sk-ant-eigener-server' });
    await askJulia(w.bot, { guild: w.guild as never, member: w.member as never, channel, history, quietWhenLimited: false });
    expect(vi.mocked(providers.claudeComplete).mock.calls[0]![0].apiKey).toBe('sk-ant-eigener-server');
  });
});
