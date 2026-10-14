import { describe, expect, it, vi } from 'vitest';

vi.mock('@discordjs/voice', async (orig) => ({
  ...(await orig<typeof import('@discordjs/voice')>()),
  entersState: vi.fn(async () => undefined),
  createAudioResource: vi.fn(() => ({})),
  createAudioPlayer: vi.fn(() => ({ play: vi.fn(), stop: vi.fn() })),
}));
vi.mock('@moin/db', () => ({ loadSettings: vi.fn(async () => ({ sttUrl: 'http://stt:8000' })), loadGuildSecrets: vi.fn(async () => null) }));
vi.mock('./voice.js', () => ({ synthesize: vi.fn(async () => Buffer.from('audio')) }));

const { Conversation } = await import('./conversation.js');

function setup(heard: string) {
  const sent: string[] = [];
  const text = { id: 'c1', send: vi.fn(async (m: { content: string }) => sent.push(m.content)) };
  const ask = vi.fn(async () => 'Morgen wird es sonnig.');
  const stt = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ text: heard }) }));
  const bot = { prisma: {}, logger: { warn: vi.fn() } } as never;
  const talk = new Conversation(bot, { id: 'g1' } as never, { id: 'v1', members: new Map() } as never, text as never, { enabled: true, provider: 'piper', voice: '', speed: 1, stt: 'lokal' }, ask, stt as never);
  const member = { id: 'u1', displayName: 'Anna' } as never;
  const oneSecond = Buffer.alloc(48_000 * 4);
  return { talk, member, oneSecond, ask, stt, sent };
}

describe('Gespräch im Sprachkanal', () => {
  it('Satz mit „Julia …“ → fragen, Text im Kanal, Antwort sprechen', async () => {
    const { talk, member, oneSecond, ask, sent } = setup('Julia, wie wird das Wetter morgen?');
    await talk.onUtterance(member, oneSecond);
    expect(ask).toHaveBeenCalledWith(member, 'wie wird das Wetter morgen?', 'c1');
    expect(sent[0]).toContain('**Anna:** wie wird das Wetter morgen?');
    expect(sent[0]).toContain('Morgen wird es sonnig.');
  });

  it('ohne Weckwort oder zu kurz: nichts passiert', async () => {
    const a = setup('wir spielen gleich weiter');
    await a.talk.onUtterance(a.member, a.oneSecond);
    expect(a.ask).not.toHaveBeenCalled();
    expect(a.sent).toEqual([]);
    const b = setup('Julia hallo');
    await b.talk.onUtterance(b.member, Buffer.alloc(1000));
    expect(b.stt).not.toHaveBeenCalled();
  });
});
