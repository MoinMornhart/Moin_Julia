import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Für `prisma generate` wird keine echte Verbindung gebraucht.
    url: process.env.DATABASE_URL ?? 'postgresql://placeholder@localhost:5432/placeholder',
  },
});
