import type { PrismaClient } from '@moin/db';
import { DEFAULT_LOCALE, getModule, isLocale, type Locale } from '@moin/shared';

interface GuildState {
  locale: Locale;
  enabled: Map<string, boolean>;
  config: Map<string, unknown>;
}

/**
 * Zwischenspeicher für „welches Modul ist auf welchem Server an“, die Modul-Einstellungen
 * und die Server-Sprache. Wird bei Änderungen aus dem Dashboard (Redis-Event) gezielt geleert.
 */
export class ModuleState {
  private readonly cache = new Map<string, Promise<GuildState>>();

  constructor(private readonly prisma: PrismaClient) {}

  async isEnabled(guildId: string, moduleId: string): Promise<boolean> {
    const state = await this.load(guildId);
    return state.enabled.get(moduleId) ?? getModule(moduleId)?.defaultEnabled ?? false;
  }

  /** Einstellungen eines Moduls, durch `parse` geprüft (Standardwerte für Fehlendes). */
  async config<T>(guildId: string, moduleId: string, parse: (raw: unknown) => T): Promise<T> {
    const state = await this.load(guildId);
    return parse(state.config.get(moduleId));
  }

  async locale(guildId: string | null | undefined): Promise<Locale> {
    if (!guildId) return DEFAULT_LOCALE;
    return (await this.load(guildId)).locale;
  }

  invalidate(guildId: string): void {
    this.cache.delete(guildId);
  }

  private load(guildId: string): Promise<GuildState> {
    let pending = this.cache.get(guildId);
    if (!pending) {
      pending = this.fetch(guildId).catch((error: unknown) => {
        this.cache.delete(guildId);
        throw error;
      });
      this.cache.set(guildId, pending);
    }
    return pending;
  }

  private async fetch(guildId: string): Promise<GuildState> {
    const guild = await this.prisma.guild.findUnique({
      where: { id: guildId },
      select: { locale: true, modules: { select: { moduleId: true, enabled: true, config: true } } },
    });
    return {
      locale: isLocale(guild?.locale) ? guild.locale : DEFAULT_LOCALE,
      enabled: new Map(guild?.modules.map((m) => [m.moduleId, m.enabled]) ?? []),
      config: new Map(guild?.modules.map((m) => [m.moduleId, m.config]) ?? []),
    };
  }
}
