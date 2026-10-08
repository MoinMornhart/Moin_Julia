import { ActivityType, Client, Events, GatewayIntentBits, Options, Partials } from 'discord.js';
import { Redis } from 'ioredis';
import { createPrisma } from '@moin/db';
import { CONFIG_CHANNEL, type ConfigEvent } from '@moin/shared';
import { loadEnv, readAppVersion } from './env.js';
import { createLogger } from './logger.js';
import { ModuleState } from './core/module-state.js';
import { ModuleRegistry } from './core/registry.js';
import { markGuildLeft, syncAllGuilds, upsertGuild } from './core/guilds.js';
import { startHealthServer, startHeartbeat } from './core/health.js';
import type { BotContext } from './core/types.js';
import { botModules } from './modules/index.js';

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL, env.LOG_PRETTY);
const version = readAppVersion();
const startedAt = new Date();

const prisma = createPrisma(env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
const subscriber = redis.duplicate();

// Intents wachsen mit den Modulen. Privilegiert (im Developer Portal einschalten): GuildMembers, MessageContent.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
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

const bot: BotContext = { client, prisma, redis, logger, modules: new ModuleState(prisma), version };
const registry = new ModuleRegistry(bot, botModules, env.DISCORD_TOKEN, env.DISCORD_CLIENT_ID);

client.once(Events.ClientReady, async (ready) => {
  logger.info({ user: ready.user.tag, guilds: ready.guilds.cache.size, version }, 'Bot ist online');
  ready.user.setActivity({ name: `Moin! · v${version}`, type: ActivityType.Custom });
  try {
    await syncAllGuilds(bot);
    for (const guild of ready.guilds.cache.values()) {
      await registry.syncGuildCommands(guild.id);
    }
  } catch (error) {
    logger.error({ err: error }, 'Server-Abgleich beim Start fehlgeschlagen');
  }
});

client.on(Events.GuildCreate, async (guild) => {
  logger.info({ guildId: guild.id, name: guild.name }, 'Neuem Server beigetreten');
  try {
    await upsertGuild(bot, guild);
    await registry.syncGuildCommands(guild.id);
  } catch (error) {
    logger.error({ err: error, guildId: guild.id }, 'Server konnte nicht eingerichtet werden');
  }
});

client.on(Events.GuildUpdate, (_old, guild) => {
  upsertGuild(bot, guild).catch((error: unknown) => logger.error({ err: error, guildId: guild.id }, 'Server-Update fehlgeschlagen'));
});

client.on(Events.GuildDelete, (guild) => {
  logger.info({ guildId: guild.id }, 'Server verlassen');
  markGuildLeft(bot, guild.id).catch((error: unknown) => logger.error({ err: error }, 'Server-Austritt nicht gespeichert'));
});

client.on(Events.InteractionCreate, (interaction) => {
  void registry.handleInteraction(interaction);
});

client.on(Events.Error, (error) => logger.error({ err: error }, 'Discord-Client-Fehler'));
client.on(Events.Warn, (message) => logger.warn(message));

// Änderungen aus dem Dashboard sofort übernehmen
subscriber.on('message', (_channel, raw) => {
  let event: ConfigEvent;
  try {
    event = JSON.parse(raw) as ConfigEvent;
  } catch {
    return;
  }
  logger.info({ event }, 'Konfiguration aus dem Dashboard geändert');
  bot.modules.invalidate(event.guildId);
  if (event.type === 'module' && client.isReady()) {
    registry.syncGuildCommands(event.guildId).catch((error: unknown) => logger.error({ err: error }, 'Befehle nicht aktualisiert'));
  }
});

process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'Unbehandelter Promise-Fehler'));

const healthServer = startHealthServer(bot, env.HEALTH_PORT);
let heartbeat: NodeJS.Timeout | undefined;
client.once(Events.ClientReady, () => {
  heartbeat = startHeartbeat(bot, startedAt);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Fahre geordnet herunter …');
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  clearInterval(heartbeat);
  healthServer.close();
  await Promise.allSettled([client.destroy(), subscriber.quit(), prisma.$disconnect()]);
  await redis.quit().catch(() => undefined);
  logger.info('Beendet. Tschüss! 👋');
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await registry.setupModules();
  await subscriber.subscribe(CONFIG_CHANNEL);
  await client.login(env.DISCORD_TOKEN);
} catch (error) {
  const code = (error as { code?: string }).code;
  const hint =
    code === 'TokenInvalid'
      ? 'DISCORD_TOKEN ist ungültig – im Developer Portal unter „Bot“ einen neuen Token erzeugen und in die .env eintragen.'
      : code === 'DisallowedIntents'
        ? 'Discord verweigert die Intents – im Developer Portal unter „Bot“ die „Privileged Gateway Intents“ einschalten.'
        : 'Start fehlgeschlagen.';
  logger.fatal({ err: error }, hint);
  shuttingDown = true;
  await Promise.allSettled([client.destroy(), subscriber.quit(), redis.quit(), prisma.$disconnect()]);
  healthServer.close();
  process.exit(1);
}
