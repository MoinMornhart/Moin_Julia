import 'server-only';
import { teamReviewerRoles } from './access';
import { botApi } from './discord';
import { isDemoMode } from './env';
import { cacheGet, cacheSet } from './redis';

/** Team-Mitglieder mit Prüfer-Rolle (zum Weitergeben von Bewerbungen), 5 Minuten zwischengespeichert */
export async function teamMembers(guildId: string): Promise<{ id: string; tag: string }[]> {
  if (isDemoMode()) return [{ id: '100000000000000990', tag: 'Mia (Team)' }, { id: '100000000000000991', tag: 'Ben (Team)' }];
  const key = `moin:dash:team-members:${guildId}`;
  const cached = await cacheGet<{ id: string; tag: string }[]>(key);
  if (cached) return cached;
  const roles = await teamReviewerRoles(guildId);
  if (!roles.length) return [];
  try {
    const members = await botApi<{ user: { id: string; username: string; global_name?: string | null; bot?: boolean }; nick?: string | null; roles: string[] }[]>(`/guilds/${guildId}/members?limit=1000`);
    const list = members
      .filter((m) => !m.user.bot && m.roles.some((r) => roles.includes(r)))
      .map((m) => ({ id: m.user.id, tag: m.nick || m.user.global_name || m.user.username }))
      .slice(0, 100);
    await cacheSet(key, list, 300);
    return list;
  } catch {
    return [];
  }
}
