import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';

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
