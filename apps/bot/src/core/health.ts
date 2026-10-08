import { createServer, type Server } from 'node:http';
import { Status, type Client } from 'discord.js';
import type { Redis } from 'ioredis';
import type { PrismaClient } from '@moin/db';
import { BOT_HEARTBEAT_KEY, BOT_HEARTBEAT_TTL_SECONDS, type BotHeartbeat, type BotState } from '@moin/shared';
import type { Logger } from '../logger.js';

/**
 * Interner Healthcheck für Docker (Port wird NICHT nach außen freigegeben).
 * Gesund heißt: Der Prozess läuft und die Datenbank antwortet. Ob Discord verbunden ist, steht im
 * Feld „discord“ und im Dashboard – ein Verbindungsproblem ist kein Grund für Neustart oder Rollback.
 */
export function startHealthServer(p: { prisma: PrismaClient; port: number; state: () => BotState; client: () => Client | undefined; version: string }): Server {
  const server = createServer(async (req, res) => {
    if (req.url !== '/health') {
      res.writeHead(404).end();
      return;
    }
    const state = p.state();
    const client = p.client();
    const discordReady = client ? client.isReady() && client.ws.status === Status.Ready : false;
    let database = false;
    try {
      await p.prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      database = false;
    }
    // Gesund = Prozess läuft und Datenbank antwortet. Die Discord-Verbindung zählt bewusst NICHT:
    // Ein Update kann z. B. einen falschen Token oder gesperrtes Netz nicht reparieren und würde sonst
    // endlos zurückrollen. Den Discord-Zustand zeigt das Dashboard (Heartbeat) mit Grund an.
    const ok = database;
    res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: ok ? 'ok' : 'error', state, discord: discordReady, database, version: p.version }));
  });
  server.listen(p.port, '0.0.0.0');
  return server;
}

/** Legt regelmäßig den Bot-Status in Redis ab – das Dashboard zeigt damit „Bot online“ bzw. was fehlt. */
export function startHeartbeat(p: {
  redis: Redis;
  logger: Logger;
  version: string;
  startedAt: Date;
  state: () => BotState;
  client?: () => Client | undefined;
  error?: () => string | undefined;
}): { stop: () => void; beat: () => Promise<void> } {
  const beat = async () => {
    const client = p.client?.();
    const online = client?.isReady() ?? false;
    const heartbeat: BotHeartbeat = {
      state: p.state(),
      version: p.version,
      startedAt: p.startedAt.toISOString(),
      updatedAt: new Date().toISOString(),
      guilds: online ? client!.guilds.cache.size : 0,
      pingMs: online ? client!.ws.ping : 0,
      user: online ? client!.user!.tag : '',
      error: p.error?.(),
    };
    try {
      await p.redis.set(BOT_HEARTBEAT_KEY, JSON.stringify(heartbeat), 'EX', BOT_HEARTBEAT_TTL_SECONDS);
    } catch (error) {
      p.logger.warn({ err: error }, 'Heartbeat konnte nicht geschrieben werden');
    }
  };
  void beat();
  const timer = setInterval(beat, 20_000);
  return { stop: () => clearInterval(timer), beat };
}
