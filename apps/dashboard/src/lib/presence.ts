import 'server-only';
import { appSettings } from './config';
import { db } from './db';
import { botApi, type PartialGuild } from './discord';
import { isDemoMode } from './env';
import { cacheGet, cacheSet } from './redis';

/**
 * Fragt Discord direkt (mit dem Bot-Token), auf welchen Servern der Bot ist – unabhängig davon,
 * ob der Bot-Prozess gerade läuft. So erscheinen Server sofort nach dem Einladen im Dashboard,
 * auch wenn der Bot noch startet oder hängt. Fehler werden still ignoriert (dann zählt nur die Datenbank).
 */
export async function syncBotGuilds(userGuilds: PartialGuild[]): Promise<void> {
  if (isDemoMode() || userGuilds.length === 0) return;
  const settings = await appSettings();
  if (!settings.discordToken) return;
  try {
    const key = 'moin:dash:bot-guilds';
    let botIds = await cacheGet<string[]>(key);
    if (!botIds) {
      botIds = (await botApi<{ id: string }[]>('/users/@me/guilds?limit=200')).map((g) => g.id);
      await cacheSet(key, botIds, 30);
    }
    const present = new Set(botIds);
    const ids = userGuilds.map((g) => g.id);
    const rows = await db().guild.findMany({ where: { id: { in: ids } }, select: { id: true, botPresent: true } });
    const rowById = new Map(rows.map((r) => [r.id, r]));

    for (const guild of userGuilds) {
      const row = rowById.get(guild.id);
      if (present.has(guild.id) && !row?.botPresent) {
        const full = await botApi<{ owner_id: string; name: string; icon: string | null }>(`/guilds/${guild.id}`);
        await db().guild.upsert({
          where: { id: guild.id },
          create: { id: guild.id, name: full.name, icon: full.icon, ownerId: full.owner_id, botPresent: true },
          update: { name: full.name, icon: full.icon, ownerId: full.owner_id, botPresent: true },
        });
      } else if (!present.has(guild.id) && row?.botPresent) {
        await db().guild.update({ where: { id: guild.id }, data: { botPresent: false } });
      }
    }
  } catch {
    // Token ungültig oder Discord nicht erreichbar → BotStatus zeigt den Grund
  }
}
