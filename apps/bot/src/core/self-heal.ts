import { SELF_HEAL_KEY, type HealEvent } from '@moin/shared';
import type { BotContext } from './types.js';

/**
 * Selbstheilung: Der Bot erkennt typische Hänger und behebt sie selbst – ohne Neustart und ohne dass
 * jemand eingreifen muss. Jede Heilung wird geloggt und landet im Dashboard (System → Selbstheilung).
 * Bewusst KEIN „die KI schreibt ihren Code um“ – das wäre auf einem öffentlichen Bot ein Sicherheitsrisiko.
 */

const MAX_EVENTS = 50;

/** Heilung festhalten: Log + Redis-Liste (letzte 50, 30 Tage) fürs Dashboard */
export async function recordHeal(bot: Pick<BotContext, 'logger' | 'redis'>, event: Omit<HealEvent, 'at'>, now = Date.now()): Promise<void> {
  const entry: HealEvent = { ...event, at: new Date(now).toISOString() };
  bot.logger.warn({ heal: entry }, `Selbstheilung: ${entry.area} – ${entry.problem} → ${entry.action}`);
  try {
    await bot.redis.lpush(SELF_HEAL_KEY, JSON.stringify(entry));
    await bot.redis.ltrim(SELF_HEAL_KEY, 0, MAX_EVENTS - 1);
    await bot.redis.expire(SELF_HEAL_KEY, 30 * 86_400);
  } catch {
    // Redis kurz weg – das Log reicht dann
  }
}

/**
 * Runde mit Sperre gegen Doppelstart – aber mit Höchstdauer: Hängt eine Runde (z. B. eine Abfrage, die nie
 * antwortet), war das Modul bisher für immer still. Nach `maxMs` wird die Sperre gelöst und neu gestartet.
 */
export function guardedRound(bot: Pick<BotContext, 'logger' | 'redis'>, area: string, maxMs: number, run: () => Promise<unknown>, now: () => number = Date.now): () => Promise<void> {
  let startedAt: number | null = null;
  let generation = 0;
  return async () => {
    if (startedAt !== null) {
      if (now() - startedAt < maxMs) return; // läuft noch regulär
      await recordHeal(bot, { area, problem: `Runde hing seit ${Math.round((now() - startedAt) / 1000)} s`, action: 'Sperre gelöst, neu gestartet' }, now());
    }
    const mine = ++generation;
    startedAt = now();
    try {
      await run();
    } catch (error) {
      bot.logger.warn({ err: error }, `${area}: Runde fehlgeschlagen`);
    } finally {
      // Nur die eigene Runde gibt die Sperre frei – eine abgelöste, hängende Runde nicht mehr
      if (mine === generation) startedAt = null;
    }
  };
}
