import type { NukeKind } from '@moin/shared';

/**
 * Reine Logik des Server-Schutzes – ohne Discord testbar.
 */

/** Zählt Ereignisse pro Schlüssel in einem gleitenden Zeitfenster. */
export class WindowCounter {
  private readonly events = new Map<string, number[]>();

  add(key: string, now: number, windowMs: number): number {
    const list = (this.events.get(key) ?? []).filter((ts) => now - ts < windowMs);
    list.push(now);
    this.events.set(key, list);
    return list.length;
  }

  clear(key: string): void {
    this.events.delete(key);
  }

  sweep(now: number, maxAgeMs: number): void {
    for (const [key, list] of this.events) {
      if (!list.some((ts) => now - ts < maxAgeMs)) this.events.delete(key);
    }
  }
}

/** Beitritts-Welle erkennen. Liefert true genau einmal pro Welle (danach erst wieder nach Ende des Raid-Modus). */
export class RaidDetector {
  private readonly joins = new WindowCounter();
  private readonly activeUntil = new Map<string, number>();

  join(guildId: string, now: number, threshold: number, windowMs: number): boolean {
    if (this.isActive(guildId, now)) return false;
    const count = this.joins.add(guildId, now, windowMs);
    if (count < threshold) return false;
    // Sofort sperren, damit parallele Beitritte nicht erneut auslösen, bis start() die echte Dauer setzt
    this.start(guildId, now + 60_000);
    return true;
  }

  start(guildId: string, until: number): void {
    this.activeUntil.set(guildId, until);
    this.joins.clear(guildId);
  }

  end(guildId: string): void {
    this.activeUntil.delete(guildId);
  }

  isActive(guildId: string, now: number): boolean {
    const until = this.activeUntil.get(guildId);
    if (until === undefined) return false;
    if (now >= until) {
      this.activeUntil.delete(guildId);
      return false;
    }
    return true;
  }
}

/** Zählt verdächtige Aktionen pro Person und Art; meldet beim Erreichen der Schwelle (einmal je Fenster). */
export class NukeDetector {
  private readonly counter = new WindowCounter();

  record(guildId: string, executorId: string, kind: NukeKind, now: number, threshold: number, windowMs: number): number | null {
    const key = `${guildId}:${executorId}:${kind}`;
    const count = this.counter.add(key, now, windowMs);
    if (count >= threshold) {
      this.counter.clear(key);
      return count;
    }
    return null;
  }
}

/** Audit-Log-Aktion → beobachtete Art (Werte aus discord.js AuditLogEvent) */
export const AUDIT_KIND: Record<number, NukeKind> = {
  12: 'channelDelete', // ChannelDelete
  32: 'roleDelete', // RoleDelete
  22: 'ban', // MemberBanAdd
  20: 'kick', // MemberKick
  50: 'webhookCreate', // WebhookCreate
};

/** Ist jemand vom Anti-Nuke ausgenommen? */
export function isExempt(p: { executorId: string; ownerId: string; botId: string; roleIds: string[]; whitelistUserIds: string[]; whitelistRoleIds: string[] }): boolean {
  if (p.executorId === p.ownerId || p.executorId === p.botId) return true;
  if (p.whitelistUserIds.includes(p.executorId)) return true;
  return p.roleIds.some((r) => p.whitelistRoleIds.includes(r));
}

/** Account-Alter in ganzen Tagen */
export function accountAgeDays(createdAt: Date, now: Date): number {
  return Math.floor((now.getTime() - createdAt.getTime()) / 864e5);
}

/** „3 Tage“, „5 Std.“, „12 Min.“ */
export function formatAge(createdAt: Date, now: Date, locale: 'de' | 'en'): string {
  const ms = now.getTime() - createdAt.getTime();
  const days = Math.floor(ms / 864e5);
  if (days >= 1) return locale === 'de' ? `${days} ${days === 1 ? 'Tag' : 'Tage'}` : `${days} ${days === 1 ? 'day' : 'days'}`;
  const hours = Math.floor(ms / 36e5);
  if (hours >= 1) return locale === 'de' ? `${hours} Std.` : `${hours} h`;
  return locale === 'de' ? `${Math.max(1, Math.floor(ms / 6e4))} Min.` : `${Math.max(1, Math.floor(ms / 6e4))} min`;
}

/** Captcha: einfache Rechenaufgabe, Lösung bleibt auf dem Server */
export class CaptchaStore {
  private readonly pending = new Map<string, { answer: number; expires: number }>();

  create(key: string, now: number, random: () => number = Math.random): { a: number; b: number } {
    const a = 2 + Math.floor(random() * 18);
    const b = 2 + Math.floor(random() * 9);
    this.pending.set(key, { answer: a + b, expires: now + 5 * 60_000 });
    return { a, b };
  }

  /** 'ok' | 'wrong' | 'expired' – eine Aufgabe gilt nur für einen Versuch */
  check(key: string, input: string, now: number): 'ok' | 'wrong' | 'expired' {
    const entry = this.pending.get(key);
    this.pending.delete(key);
    if (!entry || entry.expires < now) return 'expired';
    return Number(input.trim()) === entry.answer ? 'ok' : 'wrong';
  }
}

/**
 * Rollen bei der Verifizierung: Mitglieder-Rolle geben und „Unverifiziert“ & Co. entziehen.
 * Nur Rollen, die es auf dem Server gibt; schon erledigt = nichts mehr zu tun.
 */
export function verifyRoleChanges(
  v: { roleId: string | null; removeRoleIds: string[] },
  memberRoleIds: string[],
  serverRoleIds: string[],
): { add: string[]; remove: string[]; configured: boolean } {
  const exists = new Set(serverRoleIds);
  const has = new Set(memberRoleIds);
  const give = v.roleId && exists.has(v.roleId) ? v.roleId : null;
  const take = v.removeRoleIds.filter((r) => exists.has(r) && r !== v.roleId);
  return {
    configured: Boolean(give) || take.length > 0,
    add: give && !has.has(give) ? [give] : [],
    remove: take.filter((r) => has.has(r)),
  };
}
