import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN fehlt – Bot-Token aus dem Discord Developer Portal eintragen.'),
  DISCORD_CLIENT_ID: z.string().regex(/^\d+$/, 'DISCORD_CLIENT_ID muss die Application-ID (nur Ziffern) sein.'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL fehlt.'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  HEALTH_PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.stringbool().default(false),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    console.error(`Konfiguration unvollständig (.env prüfen):\n${problems}`);
    process.exit(1);
  }
  return result.data;
}

/** Version aus der Datei VERSION im Repo-Root (im Container: /app/VERSION). */
export function readAppVersion(): string {
  for (const candidate of [resolve(process.cwd(), 'VERSION'), resolve(process.cwd(), '../../VERSION')]) {
    try {
      return readFileSync(candidate, 'utf8').trim();
    } catch {
      // nächste Möglichkeit probieren
    }
  }
  return 'dev';
}
