import { describe, expect, it, vi } from 'vitest';
import { AuditLogEvent, OverwriteType, PermissionFlagsBits } from 'discord.js';
import type { BotContext } from '../../core/types.js';
import { currentOverwrites, enforce } from './index.js';

const GUILD = '100000000000000001';
const CAT = '100000000000000990';
const OWNER = '100000000000000002';
const ME = '100000000000000999';

const bits = (...b: bigint[]) => ({ has: (x: bigint) => b.includes(x) });
const ow = (id: string, type: OverwriteType, allow: bigint[], deny: bigint[]) => [id, { id, type, allow: bits(...allow), deny: bits(...deny) }] as const;
const coll = <V>(entries: [string, V][]): Map<string, V> & { filter: (fn: (v: V) => boolean) => ReturnType<typeof coll<V>>; map: <R>(fn: (v: V) => R) => R[] } =>
  Object.assign(new Map(entries), { filter: (fn: (v: V) => boolean) => coll([...entries].filter(([, v]) => fn(v))), map: <R>(fn: (v: V) => R) => entries.map(([, v]) => fn(v)) });

function world(categoryOverwrites: ReturnType<typeof ow>[]) {
  const set = vi.fn(async () => undefined);
  const category = { id: CAT, name: '🔒 Owner-Bereich', parentId: null, permissionOverwrites: { cache: new Map(categoryOverwrites), set } };
  const dm = vi.fn(async () => undefined);
  const roles = coll([
    [GUILD, { id: GUILD, managed: false }],
    ['100000000000000011', { id: '100000000000000011', managed: false }],
    ['100000000000000012', { id: '100000000000000012', managed: true }],
  ]);
  const guild = {
    id: GUILD,
    name: 'Moin',
    ownerId: OWNER,
    client: { user: { id: ME } },
    roles: { cache: roles, everyone: { id: GUILD } },
    members: { me: { id: ME }, cache: coll([[ME, { id: ME, user: { bot: true } }], ['100000000000000500', { id: '100000000000000500', user: { bot: true } }], [OWNER, { id: OWNER, user: { bot: false } }]]) },
    channels: { cache: Object.assign(new Map([[CAT, category]]), { filter: () => new Map() }) },
    fetchAuditLogs: vi.fn(async () => ({ entries: { find: (fn: (e: unknown) => boolean) => [{ action: AuditLogEvent.ChannelOverwriteUpdate, executorId: '100000000000000777', createdTimestamp: Date.now() }].find(fn) } })),
    fetchOwner: vi.fn(async () => ({ send: dm })),
  };
  const bot = {
    client: { user: { id: ME } },
    logger: { info: vi.fn(), warn: vi.fn() },
    modules: { isEnabled: async () => true, locale: async () => 'de', config: async (_g: string, _m: string, parse: (raw: unknown) => unknown) => parse({ categoryId: CAT }) },
  } as unknown as BotContext;
  return { bot, guild, set, dm };
}

const V = PermissionFlagsBits.ViewChannel;
const correct = [
  ow(GUILD, OverwriteType.Role, [], [V]),
  ow('100000000000000011', OverwriteType.Role, [], [V]),
  ow(OWNER, OverwriteType.Member, [V, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory], []),
  ow('100000000000000500', OverwriteType.Member, [V, PermissionFlagsBits.ReadMessageHistory], []),
  ow(ME, OverwriteType.Member, [V, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory], []),
];

describe('Owner-Bereich im Bot', () => {
  it('liest Ist-Rechte', () => {
    const cur = currentOverwrites({ permissionOverwrites: { cache: new Map([ow(GUILD, OverwriteType.Role, [], [V])]) } } as never);
    expect(cur).toEqual([{ id: GUILD, type: 'role', allow: [], deny: ['ViewChannel'] }]);
  });

  it('richtige Rechte → nichts tun, keine DM', async () => {
    const w = world([...correct]);
    expect(await enforce(w.bot, w.guild as never, 'test')).toEqual([]);
    expect(w.set).not.toHaveBeenCalled();
  });

  it('Rolle freigeschaltet → zurückstellen und Owner mit Verursacher benachrichtigen', async () => {
    const tampered = correct.map((e) => (e[0] === '100000000000000011' ? ow('100000000000000011', OverwriteType.Role, [V], []) : e));
    const w = world(tampered);
    expect(await enforce(w.bot, w.guild as never, 'channelUpdate')).toEqual(['🔒 Owner-Bereich']);
    expect(w.set).toHaveBeenCalledTimes(1);
    const resolvables = (w.set.mock.calls[0] as unknown as [{ id: string; deny: bigint[]; allow: bigint[] }[]])[0];
    expect(resolvables.find((r) => r.id === '100000000000000011')?.deny).toEqual([V]);
    // Rollen von Bots (managed) bekommen kein Verbot
    expect(resolvables.some((r) => r.id === '100000000000000012')).toBe(false);
    expect(w.dm).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('<@100000000000000777>') }));
  });
});

describe('Administrator ersetzen', () => {
  function roleWorld(editable: boolean, fail = false) {
    let perms = PermissionFlagsBits.Administrator | PermissionFlagsBits.KickMembers;
    const role = {
      id: 'R1',
      name: 'Admins',
      editable,
      permissions: { has: (b: bigint) => (perms & b) === b, get bitfield() { return perms; } },
      setPermissions: vi.fn(async (p: bigint) => {
        if (fail) throw new Error('Missing Permissions');
        perms = p;
      }),
    };
    const rows: Record<string, unknown>[] = [];
    const prisma = {
      ownerRoleBackup: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: `b${rows.length}`, status: 'applied', ...data };
          rows.push(row);
          return row;
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(rows.find((r) => r.id === where.id)!, data)),
        findFirst: vi.fn(async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id && r.status === 'applied') ?? null),
      },
    };
    const guild = { id: GUILD, roles: { cache: new Map([['R1', role]]) } };
    return { bot: { prisma } as unknown as BotContext, guild, role, rows, perms: () => perms };
  }

  it('sichert, entfernt nur „Administrator“ und lässt sich wiederherstellen', async () => {
    const { replaceAdministrator, restoreRole } = await import('./index.js');
    const w = roleWorld(true);
    const before = w.perms();
    await replaceAdministrator(w.bot, w.guild as never, 'R1', 'O');
    expect(w.rows[0]).toMatchObject({ roleName: 'Admins', permissions: before.toString(), status: 'applied' });
    expect(w.perms() & PermissionFlagsBits.Administrator).toBe(0n);
    expect(w.perms() & PermissionFlagsBits.ManageGuild).toBe(PermissionFlagsBits.ManageGuild);
    await restoreRole(w.bot, w.guild as never, 'b0');
    expect(w.perms()).toBe(before);
    expect(w.rows[0]).toMatchObject({ status: 'restored' });
  });

  it('Rolle über Moin_Julia → „failed“ mit verständlicher Meldung', async () => {
    const { replaceAdministrator } = await import('./index.js');
    const w = roleWorld(false, true);
    await replaceAdministrator(w.bot, w.guild as never, 'R1', 'O');
    expect(w.rows[0]).toMatchObject({ status: 'failed', error: expect.stringContaining('über Moin_Julia') });
  });
});

describe('Admin-Rolle ohne Owner-Zugriff (Wunsch 09.10.)', () => {
  const MY_PERMS = PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles | PermissionFlagsBits.BanMembers;

  it('Neue Admin-Rolle: mit Häkchen alle Einzelrechte statt „Administrator“, ohne Häkchen Administrator', async () => {
    const { createAdminRole } = await import('./index.js');
    const create = vi.fn(async (opts: { permissions: bigint }) => opts);
    const guild = { id: GUILD, roles: { create }, members: { me: { permissions: { bitfield: MY_PERMS } } } };
    const bot = { logger: { warn: vi.fn() } } as unknown as BotContext;
    await createAdminRole(bot, guild as never, 'Admin', 0xff7a59, true);
    const safe = create.mock.calls[0]![0].permissions;
    expect(safe & PermissionFlagsBits.Administrator).toBe(0n);
    expect(safe & PermissionFlagsBits.ManageGuild).toBe(PermissionFlagsBits.ManageGuild);
    expect(safe & PermissionFlagsBits.KickMembers).toBe(0n); // hat Moin_Julia selbst nicht → darf sie nicht vergeben
    await createAdminRole(bot, guild as never, 'Voll-Admin', null, false);
    expect(create.mock.calls[1]![0].permissions).toBe(PermissionFlagsBits.Administrator);
  });

  function autoWorld(opts: { auto: boolean; restored?: boolean; managed?: boolean }) {
    let perms = PermissionFlagsBits.Administrator;
    const dm = vi.fn(async () => undefined);
    const rows: Record<string, unknown>[] = opts.restored ? [{ id: 'old', roleId: 'R9', status: 'restored' }] : [];
    const guild: Record<string, unknown> = { id: GUILD, name: 'Moin', members: { me: { permissions: { bitfield: MY_PERMS } } }, fetchOwner: async () => ({ send: dm }) };
    const role = {
      id: 'R9',
      name: 'Neue Admins',
      managed: !!opts.managed,
      editable: true,
      guild,
      permissions: { has: (b: bigint) => (perms & b) === b, get bitfield() { return perms; } },
      setPermissions: vi.fn(async (p: bigint) => void (perms = p)),
    };
    guild.roles = { cache: new Map([['R9', role]]) };
    const bot = {
      prisma: {
        ownerRoleBackup: {
          create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
            const row = { id: `b${rows.length}`, status: 'applied', ...data };
            rows.push(row);
            return row;
          }),
          update: vi.fn(),
          findFirst: vi.fn(async ({ where }: { where: { roleId: string; status: string } }) => rows.find((r) => r.roleId === where.roleId && r.status === where.status) ?? null),
        },
      },
      logger: { warn: vi.fn() },
      modules: { isEnabled: async () => true, locale: async () => 'de', config: async (_g: string, _m: string, parse: (raw: unknown) => unknown) => parse({ autoReplaceAdmin: opts.auto }) },
    } as unknown as BotContext;
    return { bot, role, dm, rows, perms: () => perms };
  }

  it('Automatisch: Rolle bekommt „Administrator“ → umgestellt, gesichert, Owner per DM informiert', async () => {
    const { autoReplace } = await import('./index.js');
    const w = autoWorld({ auto: true });
    await autoReplace(w.bot, w.role as never);
    expect(w.perms() & PermissionFlagsBits.Administrator).toBe(0n);
    expect(w.rows[0]).toMatchObject({ roleId: 'R9', createdBy: 'auto', status: 'applied' });
    expect(w.dm).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('Neue Admins') }));
  });

  it('Automatisch nur, wenn eingeschaltet – nicht bei Bot-Rollen und nicht bei bewusst wiederhergestellten Rollen', async () => {
    const { autoReplace } = await import('./index.js');
    for (const opts of [{ auto: false }, { auto: true, managed: true }, { auto: true, restored: true }]) {
      const w = autoWorld(opts);
      await autoReplace(w.bot, w.role as never);
      expect(w.perms(), JSON.stringify(opts)).toBe(PermissionFlagsBits.Administrator);
      expect(w.dm).not.toHaveBeenCalled();
    }
  });
});
