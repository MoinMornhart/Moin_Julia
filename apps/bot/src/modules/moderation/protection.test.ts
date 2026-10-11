import { AuditLogEvent, PermissionFlagsBits } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseModerationConfig } from '@moin/shared';
import type { BotContext } from '../../core/types.js';
import { safeRoleIds, SELF_SERVICE_FORBIDDEN, setProtectedRoles, STAFF_FORBIDDEN } from '../../core/role-safety.js';
import { applyProtection, onProtectedOverwrite, protectionCommand } from './protection.js';
import * as cases from './cases.js';

vi.mock('./cases.js', () => ({ moderationConfig: vi.fn() }));

const G = '100000000000000001';
const TEAM = '100000000000000010';
const MOD = '100000000000000011';
const LOG = '100000000000000028';
const BOT = '100000000000000999';

function overwriteChannel(id: string, initial: { id: string; type: number; allow: bigint; deny: bigint }[] = []) {
  const cache = new Map(initial.map((o) => [o.id, { id: o.id, type: o.type, allow: { bitfield: o.allow }, deny: { bitfield: o.deny } }]));
  const edit = vi.fn(async (target: string, opts: Record<string, boolean | null>) => {
    const cur = cache.get(target) ?? { id: target, type: 0, allow: { bitfield: 0n }, deny: { bitfield: 0n } };
    let allow = cur.allow.bitfield;
    let deny = cur.deny.bitfield;
    for (const [k, v] of Object.entries(opts)) {
      const bit = PermissionFlagsBits[k as keyof typeof PermissionFlagsBits];
      if (v === true) {
        allow |= bit;
        deny &= ~bit;
      } else if (v === false) {
        deny |= bit;
        allow &= ~bit;
      }
    }
    cache.set(target, { ...cur, allow: { bitfield: allow }, deny: { bitfield: deny } });
  });
  return { id, guild: { id: G }, permissionOverwrites: { cache, edit } };
}

function world(protection: Record<string, unknown>, enabled = true) {
  const team = overwriteChannel(TEAM);
  const log = { isSendable: () => true, send: vi.fn(async () => ({})) };
  const guild = {
    id: G,
    members: { me: { id: BOT } },
    roles: { cache: new Map([[MOD, { id: MOD }]]) },
    channels: { cache: new Map<string, unknown>([[TEAM, team], [LOG, log]]) },
  };
  const bot = {
    modules: { isEnabled: async () => enabled, locale: async () => 'de', invalidate: vi.fn() },
    logger: { warn: vi.fn() },
    prisma: { guildModule: { upsert: vi.fn(async () => ({})) } },
  } as unknown as BotContext;
  vi.mocked(cases.moderationConfig).mockResolvedValue(parseModerationConfig({ modLogChannelId: LOG, protection }));
  return { guild, bot, team, log };
}

describe('Geschützte Rollen', () => {
  beforeEach(() => setProtectedRoles(G, []));

  it('werden nie per Selbstbedienung vergeben – bei Bewerbungen schon', () => {
    const guild = { id: G, roles: { cache: new Map([[MOD, { id: MOD, permissions: { bitfield: 0n } }]]) } } as never;
    expect(safeRoleIds(guild, [MOD], SELF_SERVICE_FORBIDDEN)).toEqual([MOD]);
    setProtectedRoles(G, [MOD]);
    expect(safeRoleIds(guild, [MOD], SELF_SERVICE_FORBIDDEN)).toEqual([]);
    expect(safeRoleIds(guild, [MOD], STAFF_FORBIDDEN)).toEqual([MOD]);
  });

  it('applyProtection setzt die Sperre und sichert Kanäle ab; Modul aus → nichts', async () => {
    const w = world({ roleIds: [MOD], channelIds: [TEAM] });
    expect(await applyProtection(w.bot, w.guild as never)).toEqual({ secured: 1, failed: 0 });
    const ev = w.team.permissionOverwrites.cache.get(G)!;
    expect(ev.deny.bitfield & PermissionFlagsBits.ViewChannel).toBe(PermissionFlagsBits.ViewChannel);
    expect(w.team.permissionOverwrites.cache.get(MOD)!.allow.bitfield & PermissionFlagsBits.ViewChannel).toBe(PermissionFlagsBits.ViewChannel);
    // zweites Mal: schon richtig, nichts zu tun
    expect(await applyProtection(w.bot, w.guild as never)).toEqual({ secured: 0, failed: 0 });

    const off = world({ roleIds: [MOD], channelIds: [TEAM] }, false);
    expect(await applyProtection(off.bot, off.guild as never)).toEqual({ secured: 0, failed: 0 });
    expect(off.team.permissionOverwrites.edit).not.toHaveBeenCalled();
  });
});

describe('Wächter für geschützte Kanäle', () => {
  it('jemand macht den Kanal sichtbar → sofort wiederhergestellt und gemeldet', async () => {
    const w = world({ roleIds: [MOD], channelIds: [TEAM] });
    const res = await onProtectedOverwrite(w.bot, { action: AuditLogEvent.ChannelOverwriteUpdate, executorId: '100000000000000300', targetId: TEAM }, w.guild as never);
    expect(res).toBe('fixed');
    expect(w.team.permissionOverwrites.cache.get(G)!.deny.bitfield & PermissionFlagsBits.ViewChannel).toBe(PermissionFlagsBits.ViewChannel);
    expect((w.log.send.mock.calls[0]![0] as { embeds: { description: string }[] }).embeds[0]!.description).toContain('Der Bot hat sie sofort wiederhergestellt.');
  });

  it('nur melden, wenn autoFix aus; nicht geschützte Kanäle und eigene Änderungen ignorieren', async () => {
    const w = world({ roleIds: [MOD], channelIds: [TEAM], autoFix: false });
    expect(await onProtectedOverwrite(w.bot, { action: AuditLogEvent.ChannelOverwriteUpdate, executorId: '1', targetId: TEAM }, w.guild as never)).toBe('warned');
    expect(w.team.permissionOverwrites.edit).not.toHaveBeenCalled();
    const other = world({ roleIds: [MOD], channelIds: [] });
    expect(await onProtectedOverwrite(other.bot, { action: AuditLogEvent.ChannelOverwriteUpdate, executorId: '1', targetId: TEAM }, other.guild as never)).toBeNull();
    const own = world({ roleIds: [MOD], channelIds: [TEAM] });
    expect(await onProtectedOverwrite(own.bot, { action: AuditLogEvent.ChannelOverwriteUpdate, executorId: BOT, targetId: TEAM }, own.guild as never)).toBeNull();
  });
});

describe('/geschuetzt', () => {
  it('ist nur mit „Server verwalten“ nutzbar und hat Unterbefehle kanal/rolle/liste', () => {
    const data = protectionCommand.data as { name: string; default_member_permissions: string; options: { name: string }[] };
    expect(data.name).toBe('geschuetzt');
    expect(data.default_member_permissions).toBe(PermissionFlagsBits.ManageGuild.toString());
    expect(data.options.map((o) => o.name)).toEqual(['kanal', 'rolle', 'liste']);
  });

  it('Rolle schützen speichert und lehnt @everyone ab', async () => {
    const w = world({ roleIds: [], channelIds: [] });
    const editReply = vi.fn(async () => undefined);
    const make = (roleId: string, managed = false) => ({
      inCachedGuild: () => true,
      guild: w.guild,
      user: { id: '100000000000000300' },
      deferReply: vi.fn(async () => undefined),
      editReply,
      options: { getSubcommand: () => 'rolle', getString: () => 'an', getRole: () => ({ id: roleId, managed }) },
    });
    await protectionCommand.execute({ interaction: make(G) as never, bot: w.bot, locale: 'de' } as never);
    expect(editReply).toHaveBeenLastCalledWith(expect.objectContaining({ content: '❌ @everyone und Bot-Rollen kann man nicht schützen.' }));
    await protectionCommand.execute({ interaction: make(MOD) as never, bot: w.bot, locale: 'de' } as never);
    const saved = vi.mocked(w.bot.prisma.guildModule.upsert).mock.calls.at(-1)![0] as unknown as { update: { config: { protection: { roleIds: string[] } } } };
    expect(saved.update.config.protection.roleIds).toEqual([MOD]);
    expect(editReply).toHaveBeenLastCalledWith(expect.objectContaining({ content: expect.stringContaining('ist jetzt geschützt') }));
  });
});
