import { pino, type Logger } from 'pino';

export function createLogger(level: string, pretty: boolean): Logger {
  return pino({
    level,
    base: { app: 'moin-julia-bot' },
    transport: pretty ? { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss' } } : undefined,
  });
}

export type { Logger };
