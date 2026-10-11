import { PermissionFlagsBits } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { automodStatusKey, parseModerationConfig } from '@moin/shared';
import type { BotContext } from '../../core/types.js';
import { checkMessage, explainRuleError, syncNativeRules } from './automod.js';
import { DuplicateTracker, LINK_REGEX } from './logic.js';
import * as actions from './actions.js';
import * as cases from './cases.js';

vi.mock('./actions.js', () => ({ moderate: vi.fn(async () => ({})) }));
vi.mock('./cases.js', () => ({ moderationConfig: vi.fn() }));

const G = '100000000000000001';
let userCounter = 0;

function message(content: string, authorId = `1000000000000004${String(userCounter++).padStart(2, '0')}`) {
  const channel = { send: vi.fn(async () => ({ delete: vi.fn(async () => undefined) })) };
  return {
    content,
    guildId: G,
    guild: { id: G },
    channelId: '100000000000000023',
    channel,
    author: { id: authorId, bot: false },
    member: { permissions: { has: () => false }, roles: { cache: { some: () => false } } },
    delete: vi.fn(async () => undefined),
  };
}

const bot = { modules: { locale: async () => 'de', isEnabled: async () => true }, logger: { warn: vi.fn() }, redis: { set: vi.fn(async () => 'OK') } } as unknown as BotContext;
const useConfig = (automod: Record<string, unknown>) => vi.mocked(cases.moderationConfig).mockResolvedValue(parseModerationConfig({ automod }));

describe('Automod (Bot-Prüfungen)', () => {
  beforeEach(() => {
    vi.mocked(actions.moderate).mockClear();
  });

  it('verschleierte Schimpfwörter: „1d10t“ und „i d i o t“ werden gelöscht', async () => {
    useConfig({ badWords: { enabled: true, words: ['idiot'] } });
    for (const text of ['du 1d10t', 'du i d i o t', 'IDIOOOT']) {
      const m = message(text);
      await checkMessage(bot, m as never);
      expect(m.delete, text).toHaveBeenCalled();
    }
    const ok = message('Der Idiotentest war schwer');
    await checkMessage(bot, ok as never);
    expect(ok.delete).not.toHaveBeenCalled();
  });

  it('„smart“ aus: nur Discords exakte Regel, der Bot prüft nicht; eingebaute Liste mit Verwarnung', async () => {
    useConfig({ badWords: { enabled: true, words: ['idiot'], smart: false } });
    const m = message('du 1d10t');
    await checkMessage(bot, m as never);
    expect(m.delete).not.toHaveBeenCalled();

    useConfig({ badWords: { enabled: true, words: [], useDefaultList: true, action: 'delete_warn' } });
    const w = message('halt die Fresse');
    await checkMessage(bot, w as never);
    expect(w.delete).toHaveBeenCalled();
    expect(actions.moderate).toHaveBeenCalledWith(bot, expect.objectContaining({ type: 'WARN', reason: 'Automod: verbotenes Wort („halt die fresse“)' }));
  });

  it('dieselbe Nachricht 3× → Spam', async () => {
    useConfig({ spam: { enabled: true, maxMessages: 30, perSeconds: 5, duplicates: 3, action: 'delete_warn' } });
    const id = '100000000000000499';
    const msgs = ['Kauft bei mir!!', 'kauft bei mir', 'KAUFT BEI MIR'].map((t) => message(t, id));
    for (const m of msgs) await checkMessage(bot, m as never);
    expect(msgs[0]!.delete).not.toHaveBeenCalled();
    expect(msgs[2]!.delete).toHaveBeenCalled();
    expect(actions.moderate).toHaveBeenCalledWith(bot, expect.objectContaining({ reason: 'Automod: dieselbe Nachricht 3× hintereinander' }));
  });

  it('Emoji- und Zeilen-Fluten', async () => {
    useConfig({ flood: { enabled: true, maxEmojis: 5, maxLines: 4 } });
    const emojis = message('😀😀😀😀😀😀 hi');
    await checkMessage(bot, emojis as never);
    expect(emojis.delete).toHaveBeenCalled();
    const lines = message('a\nb\nc\nd\ne');
    await checkMessage(bot, lines as never);
    expect(lines.delete).toHaveBeenCalled();
    const fine = message('😀 hallo\nzweite Zeile');
    await checkMessage(bot, fine as never);
    expect(fine.delete).not.toHaveBeenCalled();
  });

  it('Moderatoren sind ausgenommen', async () => {
    useConfig({ badWords: { enabled: true, words: ['idiot'] } });
    const m = message('du 1d10t');
    m.member.permissions.has = (p: bigint) => p === PermissionFlagsBits.ManageMessages;
    await checkMessage(bot, m as never);
    expect(m.delete).not.toHaveBeenCalled();
  });
});

describe('Automod: Hilfen', () => {
  it('DuplicateTracker zählt nur gleiche Nachrichten im Fenster', () => {
    const d = new DuplicateTracker();
    expect(d.hit('a', 'x', 0, 30_000)).toBe(1);
    expect(d.hit('a', 'x', 1000, 30_000)).toBe(2);
    expect(d.hit('a', 'y', 2000, 30_000)).toBe(1);
    expect(d.hit('a', 'y', 40_000, 30_000)).toBe(1);
  });

  it('Link-Regel findet auch Links ohne https://', () => {
    const re = new RegExp(LINK_REGEX.replace('(?i)', ''), 'i');
    expect(re.test('schau mal www.beispiel.de')).toBe(true);
    expect(re.test('HTTPS://x.de')).toBe(true);
    expect(re.test('kein link hier')).toBe(false);
  });

  it('Discord-Fehler werden verständlich erklärt', () => {
    expect(explainRuleError({ code: 50013 })).toBe('Dem Bot fehlt das Recht dazu.');
    expect(explainRuleError({ code: 30035, message: 'Maximum number of rules reached' })).toContain('nur eine begrenzte Zahl');
  });
});

describe('Automod: Rückmeldung fürs Dashboard', () => {
  it('speichert aktive und fehlgeschlagene Regeln', async () => {
    vi.mocked(cases.moderationConfig).mockResolvedValue(parseModerationConfig({ automod: { invites: { enabled: true }, mentionSpam: { enabled: true } } }));
    const create = vi.fn(async (o: { name: string }) => {
      if (o.name.includes('Erwähnungen') || o.name.includes('mention')) throw Object.assign(new Error('Maximum number of rules'), { code: 30035 });
      return {};
    });
    const guild = { id: G, members: { me: { permissions: { has: () => true } } }, autoModerationRules: { fetch: async () => new Map(), create } };
    vi.mocked(bot.redis.set).mockClear();
    await syncNativeRules(bot, guild as never);
    const [key, raw] = vi.mocked(bot.redis.set).mock.calls[0]! as unknown as [string, string];
    expect(key).toBe(automodStatusKey(G));
    const status = JSON.parse(raw);
    expect(status.active).toEqual(['invites']);
    expect(status.failed).toEqual([{ key: 'mentionSpam', reason: expect.stringContaining('nur eine begrenzte Zahl') }]);
  });

  it('ohne „Server verwalten“: Hinweis statt stiller Fehler', async () => {
    vi.mocked(cases.moderationConfig).mockResolvedValue(parseModerationConfig({ automod: { invites: { enabled: true } } }));
    const guild = { id: G, members: { me: { permissions: { has: () => false } } } };
    vi.mocked(bot.redis.set).mockClear();
    await syncNativeRules(bot, guild as never);
    expect(JSON.parse((vi.mocked(bot.redis.set).mock.calls[0] as unknown as [string, string])[1]).missingPermission).toBe(true);
  });
});
