import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseTicketsConfig, ticketChannelName, ticketPanelSchema } from '@moin/shared';
import type { BotContext, ComponentContext } from '../../core/types.js';
import { canOpen, collectAnswers, isTeam, shouldAutoClose, stars, welcomeText } from './logic.js';
import { buildTicketPanel, ratingRow } from './panel.js';
import { renderTranscript } from './transcript.js';
import { ticketsModule } from './index.js';

const GUILD = '100000000000000001';
const TEAM = '100000000000000700';
const USER = '100000000000000300';
const LOG = '100000000000000028';

describe('Tickets – Logik', () => {
  const config = parseTicketsConfig({ teamRoleIds: [TEAM], maxOpenPerUser: 2, autoClose: { enabled: true, hours: 24 } });
  it('Team: Rolle, Grund-Rolle oder „Server verwalten“', () => {
    expect(isTeam([TEAM], false, config)).toBe(true);
    expect(isTeam(['x'], false, config, { teamRoleIds: ['x'] })).toBe(true);
    expect(isTeam([], true, config)).toBe(true);
    expect(isTeam(['y'], false, config)).toBe(false);
  });
  it('Limit offener Tickets und automatisches Schließen', () => {
    expect(canOpen(1, config)).toBe(true);
    expect(canOpen(2, config)).toBe(false);
    const now = new Date('2026-10-08T12:00:00Z');
    expect(shouldAutoClose(new Date('2026-10-07T11:00:00Z'), now, config)).toBe(true);
    expect(shouldAutoClose(new Date('2026-10-08T00:00:00Z'), now, config)).toBe(false);
    expect(shouldAutoClose(new Date(0), now, parseTicketsConfig({}))).toBe(false);
  });
  it('Antworten, Sterne, Begrüßung, Kanalname', () => {
    expect(collectAnswers([{ label: 'Name', placeholder: '', required: true, long: false }, { label: 'Extra', placeholder: '', required: false, long: true }], [' Anna ', ''])).toEqual([
      { label: 'Name', value: 'Anna' },
    ]);
    expect(stars(4)).toBe('★★★★☆');
    expect(welcomeText('Hi {user} – #{nr}', { user: '@Anna', nr: 7 })).toBe('Hi @Anna – #7');
    expect(ticketChannelName('ticket-{nr}-{user}', { nr: 7, user: 'Änna Strëamt!' })).toBe('ticket-0007-anna-streamt');
  });
  it('Panel: Knöpfe bzw. Menü mit Panel- und Grund-ID', () => {
    const data = ticketPanelSchema.parse({ name: 'Support', reasons: [{ id: 'g1', label: 'Frage' }, { id: 'g2', label: 'Bewerbung', emoji: '📝' }] });
    const ctx = { userId: '1', userName: 'B', userTag: 'b', userAvatarUrl: null, serverName: 'S', serverIconUrl: null, memberCount: 1 };
    const buttons = buildTicketPanel('p1', data, ctx).components[0]!.toJSON().components.map((c) => ('custom_id' in c ? c.custom_id : ''));
    expect(buttons).toEqual(['tickets:open:p1:g1', 'tickets:open:p1:g2']);
    const select = buildTicketPanel('p1', { ...data, style: 'select' }, ctx).components[0]!.toJSON().components[0] as { custom_id: string; options: { value: string }[] };
    expect(select.custom_id).toBe('tickets:select:p1');
    expect(select.options.map((o) => o.value)).toEqual(['g1', 'g2']);
    expect(ratingRow('t1')[0]!.toJSON().components).toHaveLength(5);
  });
  it('Transcript: Inhalte werden escaped (kein eingeschleuster Code)', () => {
    const html = renderTranscript(
      { server: 'Moin', number: 3, reason: 'Frage', opener: 'anna', openedAt: new Date(), closedAt: new Date(), closedBy: 'team', closeReason: null, answers: [{ label: 'Name', value: '<b>x</b>' }] },
      [
        { author: '<script>alert(1)</script>', bot: false, avatarUrl: 'javascript:alert(1)', content: '**fett** <img src=x onerror=alert(1)>', createdAt: new Date(), attachments: [{ name: 'a.png', url: 'javascript:evil' }], embeds: [] },
      ],
    );
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('<b>fett</b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Ticket #3');
  });
});

// ── Ablauf mit nachgebautem Server ──────────────────────────────────────────

function world(configRaw: unknown, panelData: unknown) {
  const tickets = new Map<string, Record<string, unknown>>();
  let counter = 0;
  const prisma = {
    ticketPanel: { findFirst: vi.fn(async () => ({ id: 'p1', guildId: GUILD, channelId: null, messageId: null, data: panelData })) },
    guild: { update: vi.fn(async () => ({ ticketCounter: ++counter })) },
    ticket: {
      findMany: vi.fn(async ({ where }: { where: { openerId?: string; status?: string } }) =>
        [...tickets.values()].filter((t) => (!where.openerId || t.openerId === where.openerId) && (!where.status || t.status === where.status)),
      ),
      findFirst: vi.fn(async ({ where }: { where: { id?: string; channelId?: string } }) => [...tickets.values()].find((t) => (where.id ? t.id === where.id : t.channelId === where.channelId)) ?? null),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => tickets.get(where.id) ?? null),
      updateMany: vi.fn(async ({ where, data }: { where: { id?: string; channelId?: string; status?: string }; data: Record<string, unknown> }) => {
        let count = 0;
        for (const t of tickets.values()) {
          if ((where.id && t.id !== where.id) || (where.channelId && t.channelId !== where.channelId) || (where.status && t.status !== where.status)) continue;
          Object.assign(t, data);
          count++;
        }
        return { count };
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `t${tickets.size + 1}`, status: 'open', claimedBy: null, rating: null, createdAt: new Date(), lastActivity: new Date(), ...data };
        tickets.set(row.id as string, row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = { ...tickets.get(where.id)!, ...data };
        tickets.set(where.id, row);
        return row;
      }),
    },
  };
  const channels = new Map<string, Record<string, unknown>>();
  const log = { id: LOG, isTextBased: () => true, send: vi.fn(async () => ({})) };
  channels.set(LOG, log);
  const dm = vi.fn(async () => ({}));
  const guild = {
    id: GUILD,
    name: 'Moin Demo',
    roles: { cache: new Map([[TEAM, { id: TEAM }]]), everyone: { id: GUILD } },
    members: { me: { id: '100000000000000999' } },
    channels: {
      cache: channels,
      create: vi.fn(async (opts: Record<string, unknown>) => {
        const id = `10000000000000080${channels.size}`;
        const ch = {
          id,
          type: ChannelType.GuildText,
          createdWith: opts,
          send: vi.fn(async () => ({})),
          delete: vi.fn(async () => channels.delete(id)),
          messages: { fetch: vi.fn(async () => new Map()) },
        };
        channels.set(id, ch);
        return ch;
      }),
    },
  };
  const bot = {
    prisma,
    logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    client: { users: { fetch: vi.fn(async () => ({ send: dm })) }, user: { id: '100000000000000999', tag: 'Moin_Julia' } },
    modules: { config: async (_g: string, _m: string, parse: (raw: unknown) => unknown) => parse(configRaw), locale: async () => 'de' },
  } as unknown as BotContext;
  const member = { displayName: 'Anna', roles: { cache: new Map() }, permissions: { has: () => false } };
  const interaction = (extra: Record<string, unknown>) => ({
    guild,
    guildId: GUILD,
    user: { id: USER, tag: 'anna' },
    member,
    isButton: () => false,
    isStringSelectMenu: () => false,
    isModalSubmit: () => false,
    reply: vi.fn(async () => undefined),
    deferReply: vi.fn(async () => undefined),
    editReply: vi.fn(async () => undefined),
    showModal: vi.fn(async () => undefined),
    ...extra,
  });
  const ctx = (i: unknown, action: string, args: string[]) => ({ interaction: i, action, args, locale: 'de', bot }) as unknown as ComponentContext;
  return { bot, guild, tickets, channels, log, dm, interaction, ctx };
}

describe('Tickets – Ablauf', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const panel = { name: 'Support', reasons: [{ id: 'g1', label: 'Frage' }, { id: 'g2', label: 'Bewerbung', questions: [{ label: 'Alter' }] }] };
  const cfg = { teamRoleIds: [TEAM], logChannelId: LOG, deleteAfterSec: 5 };

  it('Knopf → privater Kanal (Team + Person), Begrüßung, Log, Bestätigung', async () => {
    const w = world(cfg, panel);
    const i = w.interaction({ isButton: () => true });
    await ticketsModule.onComponent!(w.ctx(i, 'open', ['p1', 'g1']));
    expect(w.tickets.size).toBe(1);
    const ch = [...w.channels.values()].find((c) => c.createdWith) as { createdWith: { name: string; permissionOverwrites: { id: string; deny?: bigint[] }[] }; send: ReturnType<typeof vi.fn> };
    expect(ch.createdWith.name).toBe('ticket-0001');
    const ow = ch.createdWith.permissionOverwrites;
    expect(ow.find((o) => o.id === GUILD)?.deny).toContain(PermissionFlagsBits.ViewChannel);
    expect(ow.some((o) => o.id === USER)).toBe(true);
    expect(ow.some((o) => o.id === TEAM)).toBe(true);
    expect(ch.send).toHaveBeenCalledOnce();
    expect(w.log.send).toHaveBeenCalledOnce();
    expect(i.editReply).toHaveBeenCalledWith(expect.stringContaining('Dein Ticket ist offen'));
  });

  it('Grund mit Fragen → erst Formular; Limit 1 → zweites Ticket wird abgelehnt', async () => {
    const w = world(cfg, panel);
    const form = w.interaction({ isButton: () => true });
    await ticketsModule.onComponent!(w.ctx(form, 'open', ['p1', 'g2']));
    expect(form.showModal).toHaveBeenCalledOnce();
    expect(w.tickets.size).toBe(0);
    await ticketsModule.onComponent!(w.ctx(w.interaction({ isButton: () => true }), 'open', ['p1', 'g1']));
    const second = w.interaction({ isButton: () => true });
    await ticketsModule.onComponent!(w.ctx(second, 'open', ['p1', 'g1']));
    expect(w.tickets.size).toBe(1);
    expect((second.reply.mock.calls[0] as unknown as [{ content: string }])[0].content).toContain('schon 1 offene');
  });

  it('Schließen → Transcript gespeichert, Log mit Datei, DM mit Bewertung, Kanal wird gelöscht', async () => {
    const w = world(cfg, panel);
    await ticketsModule.onComponent!(w.ctx(w.interaction({ isButton: () => true }), 'open', ['p1', 'g1']));
    const [row] = [...w.tickets.values()];
    const submit = w.interaction({ isModalSubmit: () => true, deferUpdate: vi.fn(async () => undefined), fields: { getTextInputValue: () => 'erledigt' } });
    await ticketsModule.onComponent!(w.ctx(submit, 'close-submit', [row!.id as string]));
    const closed = w.tickets.get(row!.id as string)!;
    expect(closed.status).toBe('closed');
    expect(closed.closeReason).toBe('erledigt');
    expect(String(closed.transcript)).toContain('Ticket #1');
    expect(w.log.send).toHaveBeenCalledTimes(2);
    expect((w.log.send.mock.calls[1] as unknown as [{ files: unknown[] }])[0].files).toHaveLength(1);
    expect(w.dm).toHaveBeenCalledOnce();
    const ch = w.channels.get(row!.channelId as string) as { delete: ReturnType<typeof vi.fn> };
    await vi.advanceTimersByTimeAsync(5_000);
    expect(ch.delete).toHaveBeenCalledOnce();
  });

  it('Zwei schließen gleichzeitig → nur ein Verlauf, ein Log-Eintrag, eine DM', async () => {
    const w = world(cfg, panel);
    await ticketsModule.onComponent!(w.ctx(w.interaction({ isButton: () => true }), 'open', ['p1', 'g1']));
    const [row] = [...w.tickets.values()];
    const submit = () => w.interaction({ isModalSubmit: () => true, deferUpdate: vi.fn(async () => undefined), fields: { getTextInputValue: () => 'doppelt' } });
    await Promise.all([ticketsModule.onComponent!(w.ctx(submit(), 'close-submit', [row!.id as string])), ticketsModule.onComponent!(w.ctx(submit(), 'close-submit', [row!.id as string]))]);
    expect(w.tickets.get(row!.id as string)!.status).toBe('closed');
    expect(w.dm).toHaveBeenCalledOnce();
    expect(w.log.send).toHaveBeenCalledTimes(2); // Eröffnung + einmal Schließen
  });

  it('Doppelklick auf „Ticket öffnen“ → nur ein Ticket', async () => {
    const w = world(cfg, panel);
    await Promise.all([
      ticketsModule.onComponent!(w.ctx(w.interaction({ isButton: () => true }), 'open', ['p1', 'g1'])),
      ticketsModule.onComponent!(w.ctx(w.interaction({ isButton: () => true }), 'open', ['p1', 'g1'])),
    ]);
    expect(w.tickets.size).toBe(1);
  });

  it('Bewertung per DM wird gespeichert – nur von der Person, die geöffnet hat', async () => {
    const w = world(cfg, panel);
    await ticketsModule.onComponent!(w.ctx(w.interaction({ isButton: () => true }), 'open', ['p1', 'g1']));
    const [row] = [...w.tickets.values()];
    const rate = (userId: string) => ({ user: { id: userId }, message: { content: 'Text\n\nWie zufrieden?' }, update: vi.fn(async () => undefined) });
    await ticketsModule.onDmComponent!({ interaction: rate('fremd') as never, action: 'rate', args: [row!.id as string, '2'], bot: w.bot });
    expect(w.tickets.get(row!.id as string)!.rating).toBeNull();
    await ticketsModule.onDmComponent!({ interaction: rate(USER) as never, action: 'rate', args: [row!.id as string, '5'], bot: w.bot });
    expect(w.tickets.get(row!.id as string)!.rating).toBe(5);
  });
});
