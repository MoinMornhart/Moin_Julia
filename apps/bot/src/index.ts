import { Client, Events, GatewayIntentBits, Options, Partials } from 'discord.js';
import { Redis } from 'ioredis';
import { createPrisma, isSetupComplete, loadSettings } from '@moin/db';
import { CONFIG_CHANNEL, parsePresence, type BotState, type ConfigEvent } from '@moin/shared';
import { loadEnv, readAppVersion } from './env.js';
import { createLogger } from './logger.js';
import { ModuleState } from './core/module-state.js';
import { ModuleRegistry } from './core/registry.js';
import { markGuildLeft, syncAllGuilds, upsertGuild } from './core/guilds.js';
import { startHealthServer, startHeartbeat } from './core/health.js';
import { classifyLoginError } from './core/login-error.js';
import { applyPresence } from './core/presence.js';
import type { BotContext } from './core/types.js';
import { botModules } from './modules/index.js';

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL, env.LOG_PRETTY);
const version = readAppVersion();
const startedAt = new Date();

const prisma = createPrisma(env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
const subscriber = redis.duplicate();

let state: BotState = 'setup';
let lastError: string | undefined;
let client: Client | undefined;
const timers: NodeJS.Timeout[] = [];

// Ein Heartbeat für alle Zustände – so sieht das Dashboard immer, was der Bot gerade tut
const heartbeat = startHeartbeat({ redis, logger, version, startedAt, state: () => state, client: () => client, error: () => lastError });

const healthServer = startHealthServer({ prisma, port: env.HEALTH_PORT, state: () => state, client: () => client, version });
process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'Unbehandelter Promise-Fehler'));

let shuttingDown = false;
async function shutdown(signal: string, code = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Fahre geordnet herunter …');
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  timers.forEach(clearInterval);
  heartbeat.stop();
  healthServer.close();
  await Promise.allSettled([client?.destroy(), subscriber.quit(), prisma.$disconnect()]);
  await redis.quit().catch(() => undefined);
  logger.info('Beendet. Tschüss! 👋');
  process.exit(code);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

/** Neustart, damit neue Tokens/Schlüssel greifen (Docker startet den Container automatisch wieder). */
function restartForNewSettings(): void {
  logger.info('Neue Einstellungen aus dem Dashboard – Bot startet neu');
  void shutdown('settings-changed', 0);
}

const settings = await loadSettings(prisma);

if (!isSetupComplete(settings)) {
  // ── Einrichtungsmodus: warten, bis der Assistent im Dashboard fertig ist ─────
  state = 'setup';
  logger.warn('Einrichtung noch nicht abgeschlossen – öffne das Dashboard und folge dem Einrichtungs-Assistenten.');
  subscriber.on('message', (_channel, raw) => {
    if ((JSON.parse(raw) as ConfigEvent).type === 'system') restartForNewSettings();
  });
  await subscriber.subscribe(CONFIG_CHANNEL);
  // Rückfall, falls das Redis-Event verloren geht
  timers.push(
    setInterval(async () => {
      if (isSetupComplete(await loadSettings(prisma).catch(() => settings))) restartForNewSettings();
    }, 30_000),
  );
} else {
  await startBot(settings.discordToken!, settings.discordClientId!);
}

async function startBot(token: string, applicationId: string): Promise<void> {
  // Intents wachsen mit den Modulen. Privilegiert (im Developer Portal einschalten): GuildMembers, MessageContent.
  const discord = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildInvites,
      GatewayIntentBits.AutoModerationConfiguration,
      GatewayIntentBits.AutoModerationExecution,
    ],
    // Teil-Objekte, damit auch Ereignisse zu nicht gecachten Nachrichten/Mitgliedern ankommen (z. B. Löschungen nach einem Neustart)
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User],
    // Nachrichten-Cache für Lösch-/Bearbeitungs-Logs begrenzen: max. 300 pro Kanal, älter als 6 h wird verworfen
    makeCache: Options.cacheWithLimits({ ...Options.DefaultMakeCacheSettings, MessageManager: 300 }),
    sweepers: {
      ...Options.DefaultSweeperSettings,
      messages: { interval: 30 * 60, lifetime: 6 * 60 * 60 },
    },
  });
  client = discord;
  state = 'connecting';
  void heartbeat.beat();

  const bot: BotContext = { client: discord, prisma, redis, logger, modules: new ModuleState(prisma), version };
  const registry = new ModuleRegistry(bot, botModules, token, applicationId);

  discord.once(Events.ClientReady, async (ready) => {
    logger.info({ user: ready.user.tag, guilds: ready.guilds.cache.size, version }, 'Bot ist online');
    applyPresence(ready, parsePresence(settings.botPresence), version);
    state = 'online';
    lastError = undefined;
    void heartbeat.beat();
    try {
      await syncAllGuilds(bot);
      for (const guild of ready.guilds.cache.values()) {
        await registry.syncGuildCommands(guild.id);
      }
      await registry.runReady();
    } catch (error) {
      logger.error({ err: error }, 'Server-Abgleich beim Start fehlgeschlagen');
    }
  });

  discord.on(Events.GuildCreate, async (guild) => {
    logger.info({ guildId: guild.id, name: guild.name }, 'Neuem Server beigetreten');
    try {
      await upsertGuild(bot, guild);
      await registry.syncGuildCommands(guild.id);
      await registry.runConfigChange(guild.id);
    } catch (error) {
      logger.error({ err: error, guildId: guild.id }, 'Server konnte nicht eingerichtet werden');
    }
  });

  discord.on(Events.GuildUpdate, (_old, guild) => {
    upsertGuild(bot, guild).catch((error: unknown) => logger.error({ err: error, guildId: guild.id }, 'Server-Update fehlgeschlagen'));
  });

  discord.on(Events.GuildDelete, (guild) => {
    logger.info({ guildId: guild.id }, 'Server verlassen');
    markGuildLeft(bot, guild.id).catch((error: unknown) => logger.error({ err: error }, 'Server-Austritt nicht gespeichert'));
  });

  discord.on(Events.InteractionCreate, (interaction) => {
    void registry.handleInteraction(interaction);
  });

  discord.on(Events.Error, (error) => logger.error({ err: error }, 'Discord-Client-Fehler'));
  discord.on(Events.Warn, (message) => logger.warn(message));

  // Änderungen aus dem Dashboard sofort übernehmen
  subscriber.on('message', (_channel, raw) => {
    let event: ConfigEvent;
    try {
      event = JSON.parse(raw) as ConfigEvent;
    } catch {
      return;
    }
    if (event.type === 'system') {
      restartForNewSettings();
      return;
    }
    if (event.type === 'presence') {
      if (discord.isReady()) {
        loadSettings(prisma)
          .then((s) => applyPresence(discord, parsePresence(s.botPresence), version))
          .catch((error: unknown) => logger.warn({ err: error }, 'Status nicht übernommen'));
      }
      return;
    }
    if (event.type === 'module-action') {
      if (discord.isReady()) void registry.runAction(event.guildId, event.moduleId, event.action, event.by);
      return;
    }
    logger.info({ event }, 'Konfiguration aus dem Dashboard geändert');
    bot.modules.invalidate(event.guildId);
    if (!discord.isReady()) return;
    if (event.type === 'module') {
      registry.syncGuildCommands(event.guildId).catch((error: unknown) => logger.error({ err: error }, 'Befehle nicht aktualisiert'));
    }
    void registry.runConfigChange(event.guildId, event.type === 'guild-settings' ? undefined : event.moduleId);
  });

  try {
    await registry.setupModules();
    await subscriber.subscribe(CONFIG_CHANNEL);
    await discord.login(token);
    // Wächter: hängt die Verbindung (Firewall, DNS, Discord-Störung), Grund melden und neu versuchen
    timers.push(
      setTimeout(() => {
        if (discord.isReady()) return;
        state = 'error';
        lastError = 'Keine Verbindung zu Discord nach 3 Minuten (Netzwerk/DNS/Firewall des Containers prüfen)';
        logger.error(lastError);
        void heartbeat.beat().then(() => setTimeout(() => void shutdown('connect-timeout', 1), 60_000));
      }, 180_000),
    );
  } catch (error) {
    // Kein Absturz-Kreislauf: Der Bot wartet und das Dashboard zeigt, was zu tun ist.
    state = classifyLoginError(error);
    lastError = error instanceof Error ? error.message.slice(0, 300) : String(error);
    const hint =
      state === 'token-invalid'
        ? 'Der Discord-Token ist ungültig – im Dashboard unter „System“ einen neuen eintragen.'
        : state === 'intents-missing'
          ? 'Discord verweigert die Intents – im Developer Portal unter „Bot“ die „Privileged Gateway Intents“ einschalten.'
          : 'Start fehlgeschlagen – neuer Versuch in 60 Sekunden.';
    logger.fatal({ err: error }, hint);
    void heartbeat.beat();
    // Token ungültig: warten, bis im Dashboard ein neuer eingetragen wird (system-Event → Neustart).
    // Sonst nach 60 s neu starten (Docker startet den Container wieder) – das Dashboard zeigt so lange den Grund.
    if (state !== 'token-invalid') timers.push(setTimeout(() => void shutdown('retry-login', 1), 60_000));
  }
}
