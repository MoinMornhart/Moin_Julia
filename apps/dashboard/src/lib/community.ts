import 'server-only';
import { db } from './db';

/** Zahlen für die Reiter (offene Vorschläge, laufende Giveaways) */
export async function communityCounts(guildId: string) {
  const [suggestions, giveaways] = await Promise.all([db().suggestion.count({ where: { guildId, status: 'open' } }), db().giveaway.count({ where: { guildId, ended: false } })]);
  return { suggestions, giveaways };
}
