import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  // Monorepo: Abhängigkeiten aus dem Repo-Root mit einpacken
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  serverExternalPackages: ['pg', '@prisma/adapter-pg', 'ioredis'],
  poweredByHeader: false,
};

export default config;
