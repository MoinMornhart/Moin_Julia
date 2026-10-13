import { describe, expect, it } from 'vitest';
import { dangerousIn } from './permissions-check.js';
import { buildRankName, RANK_TEMPLATES, rankPermissions, splitRankName } from './rank-builder.js';

describe('Ränge-Baukasten', () => {
  it('baut Namen wie „🔨‖Mod“ und „💎 VIP“', () => {
    expect(buildRankName('🔨', '‖', 'Mod')).toBe('🔨‖Mod');
    expect(buildRankName('💎', ' ', ' VIP ')).toBe('💎 VIP');
    expect(buildRankName('', '‖', 'Gast')).toBe('Gast');
    expect(buildRankName('👑', '・', '')).toBe('');
    expect(buildRankName('x', '', 'y'.repeat(200))).toHaveLength(100);
  });

  it('zerlegt vorhandene Namen zum Bearbeiten', () => {
    expect(splitRankName('🔨‖Mod')).toEqual({ emoji: '🔨', separator: '‖', name: 'Mod' });
    expect(splitRankName('💎 VIP')).toEqual({ emoji: '💎', separator: ' ', name: 'VIP' });
    expect(splitRankName('🛡️・Admin')).toEqual({ emoji: '🛡️', separator: '・', name: 'Admin' });
    expect(splitRankName('Moderator')).toEqual({ emoji: '', separator: ' ', name: 'Moderator' });
  });

  it('Rechte-Pakete: nur Admin hat Administrator, Supporter darf nicht bannen', () => {
    expect(dangerousIn(rankPermissions('admin')).map((p) => p.name)).toContain('Administrator');
    expect(dangerousIn(rankPermissions('mod')).map((p) => p.name)).toContain('BanMembers');
    const sup = dangerousIn(rankPermissions('supporter')).map((p) => p.name);
    expect(sup).not.toContain('BanMembers');
    expect(sup).not.toContain('Administrator');
    expect(dangerousIn(rankPermissions('vip'))).toEqual([]);
    expect(rankPermissions('keine')).toBe('0');
    expect(RANK_TEMPLATES.filter((t) => t.pkg === 'admin').map((t) => t.name)).toEqual(['Owner', 'Admin']);
  });
});
