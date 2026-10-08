import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export * from './generated/prisma/client.js';

export function createPrisma(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) {
    throw new Error('DATABASE_URL ist nicht gesetzt.');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
