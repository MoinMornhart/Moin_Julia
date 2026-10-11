import { PermissionFlagsBits } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotContext, ComponentContext } from '../../core/types.js';
import { actionPrompt, canModerate, onActionButton, resetPendingActions } from './actions.js';

vi.mock('@moin/db', () => ({ loadSettings: vi.fn(async () => ({ instanceOwnerId: '100000000000000999', juliaRoyal: null })) }));

const GUILD = '100000000000000001';
const ANNA = '100000000000000300';
const MAX = '100000000000000301';
const OWNER = '100000000000000999';

const roleAt = (position: number) => ({ roles: { highest: { position } } });

function setup(opts: { toolsOn?: boolean; annaMod?: boolean; maxRank?: number; targetId?: string } = {}) {
  const target = { id: opts.targetId ?? MAX, user: { bot: false }, moderatable: true, timeout: vi.fn(async () => ({})), send: vi.fn(async () => ({})), ...roleAt(opts.maxRank ?? 1) };
  const anna = { id: ANNA, displayName: 'Anna', user: { username: 'anna' }, permissions: { has: (p: bigint) => (opts.annaMod ?? true) && p === PermissionFlagsBits.ModerateMembers }, ...roleAt(5) };
  const guild = {
    id: GUILD,
    name: 'Moin',
    ownerId: '100000000000000777',
    members: { fetch: vi.fn(async (id: string) => (id === ANNA ? anna : id === target.id ? target : null)), me: { permissions: { has: () => true } } },
    channels: { create: vi.fn(async () => ({})) },
  };
  const bot = {
    modules: { config: async (_g: string, _m: string, parse: (raw: unknown) => unknown) => parse({ tools: { enabled: opts.toolsOn ?? true, allowed: ['dm', 'timeout', 'kanal'] } }) },
    logger: { info: vi.fn() },
    prisma: {},
  } as unknown as BotContext;
  const press = (customId: string, userId = ANNA) => {
    const [, , answer, id] = customId.split(':');
    const interaction = {
      isButton: () => true,
      guildId: GUILD,
      guild,
      user: { id: userId },
      update: vi.fn(async () => undefined),
      reply: vi.fn(async () => undefined),
      deferUpdate: vi.fn(async () => undefined),
      editReply: vi.fn(async () => undefined),
    };
    return { interaction, run: () => onActionButton({ interaction, action: 'act', args: [answer!, id!], locale: 'de', bot } as unknown as ComponentContext) };
  };
  return { target, guild, bot, press };
}

const buttonId = (prompt: ReturnType<typeof actionPrompt>, i: number) => (prompt.components[0]!.toJSON().components[i] as { custom_id: string }).custom_id;

describe('Julia-Werkzeuge: Bestätigung', () => {
  beforeEach(() => resetPendingActions());

  it('Rangfolge wie in Discord', () => {
    const guild = { ownerId: OWNER };
    expect(canModerate(guild, { id: ANNA, ...roleAt(5) }, { id: MAX, ...roleAt(1) })).toBe(true);
    expect(canModerate(guild, { id: ANNA, ...roleAt(5) }, { id: MAX, ...roleAt(5) })).toBe(false);
    expect(canModerate(guild, { id: ANNA, ...roleAt(5) }, { id: ANNA, ...roleAt(1) })).toBe(false);
    expect(canModerate(guild, { id: ANNA, ...roleAt(99) }, { id: OWNER, ...roleAt(0) })).toBe(false);
    expect(canModerate(guild, { id: OWNER, ...roleAt(0) }, { id: MAX, ...roleAt(50) })).toBe(true);
  });

  it('nur die fragende Person; „Ja“ führt den Timeout aus', async () => {
    const w = setup();
    const prompt = actionPrompt(GUILD, 'c', ANNA, [{ kind: 'timeout', userId: MAX, minutes: 10, reason: 'Spam' }], 'de');
    expect(prompt.content).toContain('soll ich das wirklich tun?');
    const other = w.press(buttonId(prompt, 0), MAX);
    await other.run();
    expect(other.interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: 'Nur die Person, die gefragt hat, kann das bestätigen.' }));
    expect(w.target.timeout).not.toHaveBeenCalled();

    const ok = w.press(buttonId(prompt, 0));
    await ok.run();
    expect(w.target.timeout).toHaveBeenCalledWith(600_000, 'Julia, bestätigt von anna');
    expect(ok.interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('✅ Erledigt') }));
    // Zweimal drücken geht nicht
    const again = w.press(buttonId(prompt, 0));
    await again.run();
    expect(again.interaction.update).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('abgelaufen') }));
    expect(w.target.timeout).toHaveBeenCalledTimes(1);
  });

  it('beim Klick wird neu geprüft: Recht weg, Funktion aus, Herrscher, höherer Rang', async () => {
    const cases = [
      { opts: { annaMod: false }, text: 'dir fehlt das nötige Discord-Recht' },
      { opts: { toolsOn: false }, text: 'Julia-Werkzeuge sind auf diesem Server aus' },
      { opts: { targetId: OWNER }, text: 'kann Julia nicht timeouten' },
      { opts: { maxRank: 9 }, text: 'kann Julia nicht timeouten' },
    ];
    for (const c of cases) {
      resetPendingActions();
      const w = setup(c.opts);
      const prompt = actionPrompt(GUILD, 'c', ANNA, [{ kind: 'timeout', userId: w.target.id, minutes: 5, reason: '' }], 'de');
      const p = w.press(buttonId(prompt, 0));
      await p.run();
      expect(w.target.timeout).not.toHaveBeenCalled();
      expect(p.interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining(c.text) }));
    }
  });

  it('„Abbrechen“ tut nichts; Privatnachricht nennt Absender', async () => {
    const w = setup();
    const prompt = actionPrompt(GUILD, 'c', ANNA, [{ kind: 'dm', userId: MAX, text: 'Bitte ruhiger.' }], 'de');
    const no = w.press(buttonId(prompt, 1));
    await no.run();
    expect(no.interaction.update).toHaveBeenCalledWith(expect.objectContaining({ content: '❌ Abgebrochen – nichts passiert.' }));
    expect(w.target.send).not.toHaveBeenCalled();

    const prompt2 = actionPrompt(GUILD, 'c', ANNA, [{ kind: 'dm', userId: MAX, text: 'Bitte ruhiger.' }], 'de');
    await w.press(buttonId(prompt2, 0)).run();
    expect(w.target.send).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('im Auftrag von Anna') }));
  });
});
