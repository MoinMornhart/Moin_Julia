import { PermissionFlagsBits } from 'discord.js';
import { describe, expect, it } from 'vitest';
import type { Suggestion } from '@moin/db';
import { parseCommunityConfig, type SuggestionBoard } from '@moin/shared';
import { canDecide, panelMessage, suggestionMessage } from './suggestions.js';

const board = (patch: Partial<SuggestionBoard> = {}): SuggestionBoard => ({ id: 'bidee', name: 'Server-Ideen', channelId: '100000000000000021', threads: true, staffRoleIds: ['100000000000000700'], staffChannelId: '', resultChannelId: '', anonymous: false, ...patch });
const suggestion = (patch: Partial<Suggestion> = {}) =>
  ({ id: 's1', guildId: 'g', number: 7, userId: 'u', userTag: 'anna', text: 'Mehr Emotes', channelId: 'c', messageId: null, boardId: 'bidee', staffMessageId: null, votes: { a: 1, b: 1, c: -1 }, status: 'open', reason: null, decidedBy: null, decidedAt: null, createdAt: new Date(), ...patch }) as Suggestion;
const ids = (payload: { components: { toJSON: () => { components: { custom_id?: string }[] } }[] }) => payload.components.flatMap((row) => row.toJSON().components.map((c) => c.custom_id));

describe('Vorschläge wie GalaxyBot', () => {
  it('Knopf „Vorschlag einreichen“ gehört zum Bereich', () => {
    expect(ids(panelMessage(board(), 'de') as never)).toEqual(['community:suggest:bidee']);
  });

  it('ohne Team-Kanal: Entscheidungs-Knöpfe direkt unter dem Vorschlag, mit Team-Kanal nur 👍/👎', () => {
    expect(ids(suggestionMessage(suggestion(), 'de', null, board()) as never)).toEqual(['community:vote:s1:up', 'community:vote:s1:down', 'community:decide:s1:accepted', 'community:decide:s1:denied', 'community:decide:s1:considered']);
    expect(ids(suggestionMessage(suggestion(), 'de', null, board({ staffChannelId: '100000000000000022' })) as never)).toEqual(['community:vote:s1:up', 'community:vote:s1:down']);
    // entschieden → keine Entscheidungs-Knöpfe mehr
    expect(ids(suggestionMessage(suggestion({ status: 'accepted' }), 'de', null, board()) as never)).toHaveLength(2);
  });

  it('anonym: Name der Person wird nicht gezeigt', () => {
    const msg = suggestionMessage(suggestion(), 'de', 'https://cdn/x.png', board({ anonymous: true }));
    expect(msg.embeds[0]!.toJSON().author?.name).toBe('Anonym');
    expect(msg.embeds[0]!.toJSON().author?.icon_url).toBeUndefined();
  });

  it('entscheiden dürfen Owner, Admins, Manager- und Team-Rollen des Bereichs', () => {
    const config = parseCommunityConfig({ managerRoleIds: ['100000000000000800'] });
    const member = (opts: { id?: string; admin?: boolean; roles?: string[] }) =>
      ({ id: opts.id ?? 'm', guild: { ownerId: 'owner' }, permissions: { has: (p: bigint) => p === PermissionFlagsBits.ManageGuild && !!opts.admin }, roles: { cache: new Map((opts.roles ?? []).map((r) => [r, {}])) } }) as never;
    expect(canDecide(member({ id: 'owner' }), config, board())).toBe(true);
    expect(canDecide(member({ admin: true }), config, board())).toBe(true);
    expect(canDecide(member({ roles: ['100000000000000800'] }), config, board())).toBe(true);
    expect(canDecide(member({ roles: ['100000000000000700'] }), config, board())).toBe(true);
    expect(canDecide(member({ roles: ['100000000000000700'] }), config, board({ staffRoleIds: [] }))).toBe(false);
    expect(canDecide(member({}), config, board())).toBe(false);
  });
});
