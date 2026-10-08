import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  // Monorepo: Abhängigkeiten aus dem Repo-Root mit einpacken
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  serverExternalPackages: ['pg', '@prisma/adapter-pg', 'ioredis'],
  poweredByHeader: false,
  // Bot-Profilbild und -Banner gehen als Bild an eine Server-Action (Discord erlaubt bis 10 MB)
  experimental: { serverActions: { bodySizeLimit: '12mb' } },
};

export default config;
