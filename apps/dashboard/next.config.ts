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
  // Sicherheits-Header (Security-Audit): kein Einbetten in fremde Seiten, keine fremden Skripte/Plugins,
  // Formulare nur an uns selbst oder Discord (Login). Bilder dürfen von überall kommen (Avatare, Embed-Vorschau).
  async headers() {
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://discord.com",
      "frame-ancestors 'none'",
    ].join('; ');
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ];
  },
};

export default config;
