import 'server-only';
import { createPrisma, type PrismaClient } from '@moin/db';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Eine Prisma-Instanz pro Prozess (auch bei Hot-Reload im Dev-Modus). */
export function db(): PrismaClient {
  globalForPrisma.prisma ??= createPrisma();
  return globalForPrisma.prisma;
}
