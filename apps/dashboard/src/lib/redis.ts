import 'server-only';
import { Redis } from 'ioredis';
import { BOT_HEARTBEAT_KEY, CONFIG_CHANNEL, type BotHeartbeat, type ConfigEvent } from '@moin/shared';

const globalForRedis = globalThis as unknown as { redis?: Redis };

function redis(): Redis {
  if (!globalForRedis.redis) {
    const client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    client.on('error', () => {
      // Fehler werden bei den einzelnen Aufrufen behandelt; hier nur das Absturz-Event abfangen.
    });
    globalForRedis.redis = client;
  }
  return globalForRedis.redis;
}

/** Meldet dem Bot eine Änderung, damit sie ohne Neustart greift. */
export async function publishConfig(event: ConfigEvent): Promise<boolean> {
  try {
    await redis().publish(CONFIG_CHANNEL, JSON.stringify(event));
    return true;
  } catch {
    return false;
  }
}

export async function getBotHeartbeat(): Promise<BotHeartbeat | null> {
  try {
    const raw = await redis().get(BOT_HEARTBEAT_KEY);
    return raw ? (JSON.parse(raw) as BotHeartbeat) : null;
  } catch {
    return null;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis().get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await redis().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Cache ist optional
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await redis().del(key);
  } catch {
    // Cache ist optional
  }
}

/** Rohwert lesen (kein JSON), z. B. Ende eines Raid-Modus */
export async function getRaw(key: string): Promise<string | null> {
  try {
    return await redis().get(key);
  } catch {
    return null;
  }
}
