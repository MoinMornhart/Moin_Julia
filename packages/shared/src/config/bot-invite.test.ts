import { describe, expect, it } from 'vitest';
import { BOT_INVITE_PERMISSIONS, botInviteUrl } from './bot-invite.js';

describe('Bot einladen', () => {
  it('Link mit Bot + Befehlen und den nötigen Rechten (kein Administrator)', () => {
    const url = new URL(botInviteUrl('123456789012345678'));
    expect(url.origin + url.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(url.searchParams.get('client_id')).toBe('123456789012345678');
    expect(url.searchParams.get('scope')).toBe('bot applications.commands');
    expect(url.searchParams.get('permissions')).toBe(BOT_INVITE_PERMISSIONS);
    expect(BigInt(BOT_INVITE_PERMISSIONS) & (1n << 3n)).toBe(0n);
  });
});

describe('Knopf „App hinzufügen“', () => {
  it('nur einrichten, wenn noch nichts eingestellt ist', async () => {
    const { hasGuildInstall, guildInstallConfig } = await import('./bot-invite.js');
    expect(hasGuildInstall({})).toBe(false);
    expect(hasGuildInstall({ integration_types_config: { '1': {} } })).toBe(false);
    expect(hasGuildInstall({ custom_install_url: 'https://example.org' })).toBe(true);
    expect(hasGuildInstall({ integration_types_config: guildInstallConfig() })).toBe(true);
  });
});
