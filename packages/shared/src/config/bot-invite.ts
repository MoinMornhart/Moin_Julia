/**
 * Bot auf einen anderen Server einladen (Wunsch Philip, 14.10.): gleicher Link für Dashboard, /moin einladen
 * und den Knopf „Zum Server hinzufügen“ im Discord-Profil des Bots.
 */

/**
 * Rechte beim Einladen – nur, was die Module wirklich brauchen (Security-Audit), statt „Administrator“:
 * Mitglieder kicken/bannen/timeouten, Kanäle + Rollen + Server verwalten, Audit-Log, Nachrichten verwalten,
 * Senden/Embeds/Dateien/Verlauf/Reaktionen/externe Emojis/@everyone, Threads, Sprache (Verbinden, Sprechen,
 * Video, Verschieben). „Administrator ersetzen“ im Owner-Bereich kann damit nur diese Rechte vergeben.
 */
export const BOT_INVITE_PERMISSIONS = '1409038151414';
export const BOT_INVITE_SCOPES = ['bot', 'applications.commands'] as const;

/** Einladungs-Link ohne Weiterleitung – Discord lässt den Server auswählen */
export function botInviteUrl(clientId: string, authorizeUrl = 'https://discord.com/oauth2/authorize'): string {
  return `${authorizeUrl}?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(BOT_INVITE_SCOPES.join(' '))}&permissions=${BOT_INVITE_PERMISSIONS}`;
}

/** Einstellung für den Knopf „App hinzufügen“ im Discord-Profil (Server-Installation, Typ 0) */
export function guildInstallConfig(): { '0': { oauth2_install_params: { scopes: string[]; permissions: string } } } {
  return { '0': { oauth2_install_params: { scopes: [...BOT_INVITE_SCOPES], permissions: BOT_INVITE_PERMISSIONS } } };
}

/** Ist der Knopf schon eingerichtet (von uns oder selbst im Developer Portal)? */
export function hasGuildInstall(app: { custom_install_url?: string | null; install_params?: unknown; integration_types_config?: Record<string, { oauth2_install_params?: unknown } | undefined> | null }): boolean {
  return !!(app.custom_install_url || app.install_params || app.integration_types_config?.['0']?.oauth2_install_params);
}
