import { describe, expect, it, vi } from 'vitest';
import { rolePanelSchema } from '@moin/shared';
import type { BotContext, ModuleSetup } from '../../core/types.js';
import { willkommenModule } from './index.js';
import { buildPanelMessage, parseEmoji, roleChanges } from './panels.js';

const panel = rolePanelSchema.parse({
  name: 'Spiele',
  roles: [
    { roleId: '100000000000000011', label: 'Minecraft', emoji: '⛏️' },
    { roleId: '100000000000000012', label: 'Valorant', emoji: '<:valo:123456789012345678>' },
    { roleId: '100000000000000013', label: 'Fortnite' },
  ],
});
const [MC, VALO, FN] = ['100000000000000011', '100000000000000012', '100000000000000013'];

describe('Rollen-Panels', () => {
  it('Emojis: Unicode und eigene Server-Emojis', () => {
    expect(parseEmoji('⛏️')).toEqual({ name: '⛏️' });
    expect(parseEmoji('<a:party:123>')).toEqual({ animated: true, name: 'party', id: '123' });
    expect(parseEmoji(' ')).toBeUndefined();
  });

  it('Button schaltet um, „single“ entfernt die anderen', () => {
    expect(roleChanges(panel, [], { kind: 'button', roleId: MC })).toEqual({ add: [MC], remove: [] });
    expect(roleChanges(panel, [MC], { kind: 'button', roleId: MC })).toEqual({ add: [], remove: [MC] });
    const single = { ...panel, mode: 'single' as const };
    expect(roleChanges(single, [MC, 'fremd'], { kind: 'button', roleId: VALO })).toEqual({ add: [VALO], remove: [MC] });
  });

  it('fremde Rollen-IDs werden ignoriert (kein Rechte-Trick über manipulierte Buttons)', () => {
    expect(roleChanges(panel, [], { kind: 'button', roleId: '999999999999999999' })).toEqual({ add: [], remove: [] });
    expect(roleChanges(panel, [], { kind: 'select', values: ['999999999999999999', MC] })).toEqual({ add: [MC], remove: [] });
  });

  it('Auswahlmenü setzt genau die gewählten Panel-Rollen', () => {
    expect(roleChanges(panel, [MC, FN, 'fremd'], { kind: 'select', values: [VALO, FN] })).toEqual({ add: [VALO], remove: [MC] });
  });

  it('Panel-Nachricht: Buttons in Reihen à 5, Auswahl mit Limit', () => {
    const many = rolePanelSchema.parse({
      name: 'Viele',
      roles: Array.from({ length: 7 }, (_, i) => ({ roleId: `1000000000000001${String(i).padStart(2, '0')}`, label: `R${i}` })),
    });
    const msg = buildPanelMessage('p1', many, {
      userId: '1', userName: 'Bot', userTag: 'bot', userAvatarUrl: null, serverName: 'S', serverIconUrl: null, memberCount: 1,
    });
    expect(msg.components).toHaveLength(2);
    expect(msg.components[0]!.toJSON().components).toHaveLength(5);
    expect((msg.components[0]!.toJSON().components[0] as { custom_id: string }).custom_id).toBe('willkommen:role:p1:100000000000000100');
    const select = buildPanelMessage('p2', { ...panel, style: 'select', mode: 'single' }, {
      userId: '1', userName: 'Bot', userTag: 'bot', userAvatarUrl: null, serverName: 'S', serverIconUrl: null, memberCount: 1,
    });
    const menu = select.components[0]!.toJSON().components[0] as { custom_id: string; max_values: number; options: unknown[] };
    expect(menu).toMatchObject({ custom_id: 'willkommen:select:p2', max_values: 1 });
    expect(menu.options).toHaveLength(3);
  });
});

describe('Beitritt (Ablauf)', () => {
  function setup(config: unknown) {
    const channel = { isTextBased: () => true, permissionsFor: () => ({ has: () => true }), send: vi.fn(async () => ({})) };
    const guild = {
      id: '100000000000000001',
      name: 'Moin Demo',
      memberCount: 1284,
      iconURL: () => null,
      channels: { cache: new Map([['100000000000000300', channel]]) },
      roles: { cache: new Map([['100000000000000400', {}]]) },
      members: { me: {} },
    };
    const member = {
      guild,
      displayName: 'Anna',
      user: { id: '100000000000000201', tag: 'anna.streamt', bot: false, displayAvatarURL: () => '' },
      roles: { add: vi.fn(async () => undefined) },
      send: vi.fn(async () => undefined),
    };
    const bot = {
      modules: { config: async (_g: string, _m: string, parse: (r: unknown) => unknown) => parse(config) },
      logger: { warn: vi.fn() },
    } as unknown as BotContext;
    const handlers = new Map<string, (...a: unknown[]) => Promise<void>>();
    willkommenModule.setup!({ bot, on: (e: string, _g: unknown, h: (...a: unknown[]) => Promise<void>) => handlers.set(e, h) } as unknown as ModuleSetup);
    return { handlers, channel, member, bot };
  }

  it('Auto-Rolle, Willkommensbild + Embed, nur das neue Mitglied wird gepingt, DM', async () => {
    const { handlers, channel, member } = setup({
      welcome: { enabled: true, channelId: '100000000000000300' },
      dm: { enabled: true },
      autoRoles: { humans: ['100000000000000400', '100000000000000999'] },
    });
    await handlers.get('guildMemberAdd')!(member);
    expect(member.roles.add).toHaveBeenCalledWith(['100000000000000400'], 'Auto-Rollen');
    const msg = channel.send.mock.calls[0]![0] as {
      content: string;
      embeds: { title: string; image: { url: string } }[];
      files: { name: string }[];
      allowedMentions: { users: string[] };
    };
    expect(msg.content).toBe('<@100000000000000201>');
    expect(msg.embeds[0]!.title).toBe('Willkommen auf Moin Demo! 👋');
    expect(msg.embeds[0]!.image.url).toBe('attachment://willkommen.png');
    expect(msg.files[0]!.name).toBe('willkommen.png');
    expect(msg.allowedMentions).toEqual({ users: ['100000000000000201'] });
    expect(member.send).toHaveBeenCalledOnce();
  });

  it('Bots bekommen nur Bot-Rollen und keine Begrüßung', async () => {
    const { handlers, channel, member } = setup({ welcome: { enabled: true, channelId: '100000000000000300' }, autoRoles: { bots: ['100000000000000400'] } });
    member.user.bot = true;
    await handlers.get('guildMemberAdd')!(member);
    expect(member.roles.add).toHaveBeenCalledWith(['100000000000000400'], 'Auto-Rollen');
    expect(channel.send).not.toHaveBeenCalled();
  });

  it('Abschied mit Vorlage', async () => {
    const { handlers, channel, member } = setup({ leave: { enabled: true, channelId: '100000000000000300' } });
    await handlers.get('guildMemberRemove')!(member);
    const msg = channel.send.mock.calls[0]![0] as { embeds: { description: string }[] };
    expect(msg.embeds[0]!.description).toBe('**anna.streamt** hat den Server verlassen. Jetzt sind wir noch 1.284.');
  });
});
