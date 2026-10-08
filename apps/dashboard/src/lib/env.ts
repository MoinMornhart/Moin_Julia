import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Umgebungsvariable ${name} fehlt (.env prüfen).`);
  return value;
}

/** Öffentliche Basis-URL des Dashboards, z. B. https://bot.example.de – ohne Slash am Ende. */
export function dashboardUrl(): string {
  return required('DASHBOARD_URL').replace(/\/+$/, '');
}

export function oauthRedirectUri(): string {
  return `${dashboardUrl()}/api/auth/callback`;
}

export function discordClientId(): string {
  return required('DISCORD_CLIENT_ID');
}

export function discordClientSecret(): string {
  return required('DISCORD_CLIENT_SECRET');
}

export function discordBotToken(): string {
  return required('DISCORD_TOKEN');
}

/** Demo-Modus nur für Screenshots/Tests – niemals produktiv einschalten. */
export function isDemoMode(): boolean {
  return process.env.DASHBOARD_DEMO === 'true';
}

export function docsDir(): string {
  return process.env.DOCS_DIR ?? path.resolve(process.cwd(), '../../docs');
}

let cachedVersion: string | undefined;
export function appVersion(): string {
  if (cachedVersion) return cachedVersion;
  for (const candidate of [path.resolve(process.cwd(), 'VERSION'), path.resolve(process.cwd(), '../../VERSION')]) {
    try {
      cachedVersion = readFileSync(/*turbopackIgnore: true*/ candidate, 'utf8').trim();
      return cachedVersion;
    } catch {
      // weiter
    }
  }
  return 'dev';
}
