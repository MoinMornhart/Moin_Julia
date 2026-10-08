'use server';

import { saveSettings, type AppSettings } from '@moin/db';
import { appSettings, checkSetupCode, invalidateSettings } from '@/lib/config';
import { db } from '@/lib/db';
import { publishConfig } from '@/lib/redis';
import { getSession } from '@/lib/session';
import { checkDiscord } from '@/lib/validate';

export interface SystemResult {
  ok: boolean;
  messages: string[];
}

/** Leere Geheimnis-Felder bedeuten „unverändert lassen“. */
export async function saveSystemSettings(form: FormData): Promise<SystemResult> {
  const session = await getSession();
  const current = await appSettings();
  if (!session || !current.instanceOwnerId || session.userId !== current.instanceOwnerId) {
    return { ok: false, messages: ['Nur der Instanz-Admin darf die System-Einstellungen ändern.'] };
  }
  const text = (key: string) => {
    const v = form.get(key);
    return typeof v === 'string' ? v.trim() : '';
  };
  const next: Partial<AppSettings> = {
    discordToken: text('discordToken') || current.discordToken,
    discordClientId: text('discordClientId') || current.discordClientId,
    discordClientSecret: text('discordClientSecret') || current.discordClientSecret,
    dashboardUrl: text('dashboardUrl').replace(/\/+$/, '') || current.dashboardUrl,
    anthropicApiKey: form.get('anthropicApiKey.clear') === 'on' ? null : text('anthropicApiKey') || current.anthropicApiKey,
    twitchClientId: text('twitchClientId') || null,
    twitchClientSecret: form.get('twitchClientSecret.clear') === 'on' ? null : text('twitchClientSecret') || current.twitchClientSecret,
    youtubeApiKey: form.get('youtubeApiKey.clear') === 'on' ? null : text('youtubeApiKey') || current.youtubeApiKey,
  };
  if (next.dashboardUrl && !/^https?:\/\/[^\s/]+/.test(next.dashboardUrl)) {
    return { ok: false, messages: ['Die Dashboard-URL muss mit http:// oder https:// beginnen.'] };
  }

  const discordChanged =
    next.discordToken !== current.discordToken || next.discordClientId !== current.discordClientId || next.discordClientSecret !== current.discordClientSecret;
  const messages: string[] = [];
  if (discordChanged) {
    const check = await checkDiscord({
      token: next.discordToken ?? '',
      clientId: next.discordClientId ?? '',
      clientSecret: next.discordClientSecret ?? '',
      redirectUri: next.dashboardUrl ? `${next.dashboardUrl}/api/auth/callback` : undefined,
    });
    if (!check.ok) return { ok: false, messages: check.errors };
    messages.push(...check.warnings);
  }

  await saveSettings(db(), next);
  invalidateSettings();
  await publishConfig({ type: 'system' });
  return { ok: true, messages: ['Gespeichert – der Bot startet mit den neuen Einstellungen neu.', ...messages] };
}

/** Instanz-Admin werden (nur solange es noch keinen gibt) – mit dem Einrichtungs-Code aus der .env. */
export async function claimInstanceAdmin(code: string): Promise<SystemResult> {
  const session = await getSession();
  if (!session) return { ok: false, messages: ['Bitte zuerst mit Discord anmelden.'] };
  if ((await appSettings()).instanceOwnerId) return { ok: false, messages: ['Es gibt bereits einen Instanz-Admin.'] };
  if (!checkSetupCode(code)) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return { ok: false, messages: ['Der Code stimmt nicht. Im Container: moin-julia setup-code'] };
  }
  await saveSettings(db(), { instanceOwnerId: session.userId });
  invalidateSettings();
  return { ok: true, messages: ['Du bist jetzt Instanz-Admin.'] };
}
