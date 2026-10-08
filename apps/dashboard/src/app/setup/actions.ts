'use server';

import { cookies } from 'next/headers';
import { saveSettings } from '@moin/db';
import {
  appSettings,
  checkSetupCode,
  createSetupTicket,
  invalidateSettings,
  requestOrigin,
  setupComplete,
  SETUP_COOKIE,
  verifySetupTicket,
} from '@/lib/config';
import { db } from '@/lib/db';
import { publishConfig } from '@/lib/redis';
import { checkAnthropic, checkDiscord, checkTwitch, checkYouTube, type CheckResult } from '@/lib/validate';

export interface SetupValues {
  token: string;
  clientId: string;
  clientSecret: string;
  dashboardUrl: string;
  anthropicApiKey: string;
  twitchClientId: string;
  twitchClientSecret: string;
  youtubeApiKey: string;
}

async function hasTicket(): Promise<boolean> {
  return verifySetupTicket((await cookies()).get(SETUP_COOKIE)?.value);
}

const NO_TICKET: CheckResult = { ok: false, errors: ['Die Sitzung ist abgelaufen – bitte den Einrichtungs-Code erneut eingeben (Seite neu laden).'], warnings: [], info: [] };

/** Schritt 1: Einrichtungs-Code prüfen und ein 2-Stunden-Ticket als Cookie setzen. */
export async function verifyCode(code: string): Promise<{ ok: boolean; message?: string }> {
  if ((await setupComplete()) && (await appSettings()).instanceOwnerId) {
    return { ok: false, message: 'Die Einrichtung ist bereits abgeschlossen. Änderungen gehen unter „System“ im Dashboard.' };
  }
  if (!checkSetupCode(code)) {
    // Kleine Bremse gegen Durchprobieren
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { ok: false, message: 'Der Code stimmt nicht. Er steht am Ende der Installation bzw. im Container: moin-julia setup-code' };
  }
  (await cookies()).set(SETUP_COOKIE, createSetupTicket(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: (await requestOrigin()).startsWith('https://'),
    path: '/',
    maxAge: 2 * 60 * 60,
  });
  return { ok: true };
}

export async function checkDiscordStep(v: Pick<SetupValues, 'token' | 'clientId' | 'clientSecret' | 'dashboardUrl'>): Promise<CheckResult> {
  if (!(await hasTicket())) return NO_TICKET;
  const base = v.dashboardUrl.trim().replace(/\/+$/, '');
  return checkDiscord({ token: v.token, clientId: v.clientId, clientSecret: v.clientSecret, redirectUri: base ? `${base}/api/auth/callback` : undefined });
}

export async function checkOptionalStep(kind: 'anthropic' | 'twitch' | 'youtube', v: SetupValues): Promise<CheckResult> {
  if (!(await hasTicket())) return NO_TICKET;
  if (kind === 'anthropic') return checkAnthropic(v.anthropicApiKey);
  if (kind === 'twitch') return checkTwitch(v.twitchClientId, v.twitchClientSecret);
  return checkYouTube(v.youtubeApiKey);
}

/** Letzter Schritt: alles verschlüsselt speichern und den Bot neu starten lassen. */
export async function finishSetup(v: SetupValues): Promise<{ ok: boolean; message?: string }> {
  if (!(await hasTicket())) return { ok: false, message: NO_TICKET.errors[0] };
  if ((await setupComplete()) && (await appSettings()).instanceOwnerId) {
    return { ok: false, message: 'Die Einrichtung ist bereits abgeschlossen.' };
  }
  const url = v.dashboardUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+/.test(url)) return { ok: false, message: 'Die Dashboard-Adresse muss mit http:// oder https:// beginnen.' };

  const discord = await checkDiscord({ token: v.token, clientId: v.clientId, clientSecret: v.clientSecret });
  if (!discord.ok) return { ok: false, message: discord.errors[0] };

  await saveSettings(db(), {
    discordToken: v.token.trim().replace(/^Bot\s+/i, ''),
    discordClientId: v.clientId.trim(),
    discordClientSecret: v.clientSecret.trim(),
    dashboardUrl: url,
    anthropicApiKey: v.anthropicApiKey || null,
    twitchClientId: v.twitchClientId || null,
    twitchClientSecret: v.twitchClientSecret || null,
    youtubeApiKey: v.youtubeApiKey || null,
  });
  invalidateSettings();
  await publishConfig({ type: 'system' });
  return { ok: true };
}
