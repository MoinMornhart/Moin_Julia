import { createServer, type Server } from 'node:http';
import { Status } from 'discord.js';
import { BOT_HEARTBEAT_KEY, BOT_HEARTBEAT_TTL_SECONDS, type BotHeartbeat } from '@moin/shared';
import type { BotContext } from './types.js';

/**
 * Interner Healthcheck für Docker (Port wird NICHT nach außen freigegeben).
 * 200 nur, wenn die Gateway-Verbindung zu Discord steht und die Datenbank antwortet.
 */
export function startHealthServer(bot: BotContext, port: number): Server {
  const server = createServer(async (req, res) => {
    if (req.url !== '/health') {
      res.writeHead(404).end();
      return;
    }
    const discordReady = bot.client.isReady() && bot.client.ws.status === Status.Ready;
    let database = false;
    try {
      await bot.prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      database = false;
    }
    const ok = discordReady && database;
    res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: ok ? 'ok' : 'error', discord: discordReady, database, version: bot.version }));
  });
  server.listen(port, '0.0.0.0');
  return server;
}

/** Legt regelmäßig den Bot-Status in Redis ab – das Dashboard zeigt damit „Bot online“. */
export function startHeartbeat(bot: BotContext, startedAt: Date): NodeJS.Timeout {
  const beat = async () => {
    if (!bot.client.isReady()) return;
    const heartbeat: BotHeartbeat = {
      version: bot.version,
      startedAt: startedAt.toISOString(),
      updatedAt: new Date().toISOString(),
      guilds: bot.client.guilds.cache.size,
      pingMs: bot.client.ws.ping,
      user: bot.client.user.tag,
    };
    try {
      await bot.redis.set(BOT_HEARTBEAT_KEY, JSON.stringify(heartbeat), 'EX', BOT_HEARTBEAT_TTL_SECONDS);
    } catch (error) {
      bot.logger.warn({ err: error }, 'Heartbeat konnte nicht geschrieben werden');
    }
  };
  void beat();
  return setInterval(beat, 20_000);
}
