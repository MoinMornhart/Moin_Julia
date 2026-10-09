import { z } from 'zod';

/**
 * Owner-Bereich: eine Kategorie mit Kanälen, die nur der Server-Owner und Bots sehen.
 * Moin_Julia legt die Rechte fest und stellt sie wieder her, wenn jemand daran dreht.
 * Discord-Grenze: Rollen mit „Administrator“ sehen trotzdem alles – darum zeigt das Dashboard
 * diese Rollen an und kann „Administrator“ durch Einzelrechte ersetzen (mit Sicherung).
 */

const snowflake = z.string().regex(/^\d{15,22}$/);

export const ownerConfigSchema = z.object({
  categoryId: z.union([snowflake, z.literal('')]).default(''),
  /** Andere Bots dürfen mitlesen (z. B. Musik-/Log-Bots) – sonst nur Moin_Julia */
  allowBots: z.boolean().default(true),
  /** Owner per DM benachrichtigen, wenn jemand an den Rechten dreht */
  notifyOwner: z.boolean().default(true),
  /**
   * Bekommt eine Rolle „Administrator“ (neu angelegt oder geändert), stellt Moin_Julia sie sofort auf
   * Einzelrechte um – mit Sicherung. So bleibt der Owner-Bereich auch bei neuen Admin-Rollen privat.
   */
  autoReplaceAdmin: z.boolean().default(false),
});

/** Name für eine neue Admin-Rolle prüfen (Discord: 1–100 Zeichen) */
export function cleanRoleName(name: string): string {
  return name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 100);
}
export type OwnerConfig = z.infer<typeof ownerConfigSchema>;

export function parseOwnerConfig(raw: unknown): OwnerConfig {
  const parsed = ownerConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : ownerConfigSchema.parse({});
}

/** Rechte, um die es geht (Namen wie in discord.js PermissionFlagsBits) */
export const OWNER_VIEW_PERMS = ['ViewChannel'] as const;
// Kein „Rollen verwalten“ im Kanal: Das reicht auf Server-Ebene, und Discord lässt es ohne Administrator nicht zu
export const OWNER_SELF_PERMS = ['ViewChannel', 'ManageChannels', 'SendMessages', 'ReadMessageHistory'] as const;

export interface Overwrite {
  id: string;
  type: 'role' | 'member';
  allow: string[];
  deny: string[];
}

/**
 * Die Soll-Rechte des Owner-Bereichs:
 * @everyone und JEDE Rolle: „Kanal ansehen“ verboten · Owner + (erlaubte) Bots: erlaubt · Moin_Julia: verwalten.
 * Rollen werden einzeln verboten, damit auch Rollen mit eigenen Kanal-Rechten nichts sehen.
 */
export function expectedOverwrites(ctx: { everyoneId: string; ownerId: string; selfId: string; roleIds: string[]; botIds: string[]; allowBots: boolean }): Overwrite[] {
  const out: Overwrite[] = [{ id: ctx.everyoneId, type: 'role', allow: [], deny: ['ViewChannel'] }];
  for (const roleId of ctx.roleIds) if (roleId !== ctx.everyoneId) out.push({ id: roleId, type: 'role', allow: [], deny: ['ViewChannel'] });
  out.push({ id: ctx.ownerId, type: 'member', allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'], deny: [] });
  if (ctx.allowBots) for (const botId of ctx.botIds) if (botId !== ctx.selfId) out.push({ id: botId, type: 'member', allow: ['ViewChannel', 'ReadMessageHistory'], deny: [] });
  out.push({ id: ctx.selfId, type: 'member', allow: [...OWNER_SELF_PERMS], deny: [] });
  return out;
}

/**
 * Weicht der Ist-Zustand ab? Gefährlich ist alles, was jemandem außer Owner/Bots „Kanal ansehen“ gibt
 * oder einer Rolle das Verbot nimmt. Zusätzliche Verbote stören nicht.
 */
export function overwriteProblems(current: Overwrite[], expected: Overwrite[]): string[] {
  const problems: string[] = [];
  const byId = new Map(current.map((o) => [o.id, o]));
  const allowed = new Set(expected.filter((o) => o.allow.includes('ViewChannel')).map((o) => o.id));
  for (const exp of expected) {
    const cur = byId.get(exp.id);
    if (exp.deny.includes('ViewChannel') && !cur?.deny.includes('ViewChannel')) problems.push(`deny-missing:${exp.id}`);
    if (exp.allow.includes('ViewChannel') && !cur?.allow.includes('ViewChannel')) problems.push(`allow-missing:${exp.id}`);
  }
  for (const cur of current) {
    if (cur.allow.includes('ViewChannel') && !allowed.has(cur.id)) problems.push(`foreign-allow:${cur.id}`);
  }
  return problems;
}
