import { PermissionFlagsBits } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../../core/types.js';
import { kernModule } from './index.js';

vi.mock('@moin/db', () => ({ loadSettings: vi.fn(async () => ({})), saveSettings: vi.fn(), clearSettings: vi.fn() }));

function run(userId: string, dauer: string, admin = false) {
  const reply = vi.fn(async () => undefined);
  const send = vi.fn(async () => undefined);
  const redis = { set: vi.fn(async () => 'OK'), del: vi.fn(async () => 1) };
  const interaction = {
    user: { id: userId, username: userId },
    guildId: 'g1',
    guild: { ownerId: 'owner', channels: { cache: new Map([['log1', { isSendable: () => true, send }]]) } },
    member: { permissions: { has: (p: bigint) => admin && p === PermissionFlagsBits.Administrator } },
    inCachedGuild: () => true,
    options: { getSubcommand: () => 'support-zugang', getString: () => dauer },
    reply,
  };
  const bot = { redis, modules: { config: async () => ({ defaultChannelId: 'log1' }) } } as unknown as BotContext;
  const exec = kernModule.commands![0]!.execute({ interaction, locale: 'de', bot } as never);
  return { exec, reply, redis, send };
}

describe('/moin support-zugang', () => {
  it('nur Owner oder Administratoren', async () => {
    const x = run('jemand', '24h');
    await x.exec;
    expect(x.redis.set).not.toHaveBeenCalled();
    expect((x.reply.mock.calls[0] as unknown as [{ content: string }])[0].content).toContain('nur der Server-Owner');
  });

  it('24 h mit Ablauf, für immer ohne Ablauf, aus löscht; Hinweis im Log-Kanal', async () => {
    const a = run('owner', '24h');
    await a.exec;
    expect(a.redis.set).toHaveBeenCalledWith('moin:support:g1', expect.any(String), 'PX', 86_400_000);
    expect((a.send.mock.calls[0] as unknown as [{ content: string }])[0].content).toContain('Support-Zugang');
    const b = run('admin', 'immer', true);
    await b.exec;
    expect(b.redis.set).toHaveBeenCalledWith('moin:support:g1', expect.stringContaining('"until":null'));
    const c = run('owner', 'aus');
    await c.exec;
    expect(c.redis.del).toHaveBeenCalledWith('moin:support:g1');
  });
});
