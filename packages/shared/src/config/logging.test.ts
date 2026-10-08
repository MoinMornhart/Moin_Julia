import { describe, expect, it } from 'vitest';
import { LOG_CATEGORIES, logTarget, loggingConfigSchema, parseLoggingConfig } from './logging.js';

describe('Logging-Konfiguration', () => {
  it('liefert vollständige Standardwerte für eine leere Konfiguration', () => {
    const config = parseLoggingConfig({});
    expect(config.defaultChannelId).toBeNull();
    expect(config.ignoreBots).toBe(true);
    expect(Object.keys(config.categories)).toEqual([...LOG_CATEGORIES]);
    expect(config.categories.voice).toEqual({ enabled: true, channelId: null });
  });

  it('fällt bei kaputten Daten auf Standardwerte zurück', () => {
    expect(parseLoggingConfig({ defaultChannelId: 'kein-snowflake' }).defaultChannelId).toBeNull();
    expect(parseLoggingConfig(null).ignoredChannelIds).toEqual([]);
  });

  it('ergänzt fehlende Kategorien bei Teil-Konfigurationen', () => {
    const config = parseLoggingConfig({ categories: { voice: { enabled: false } } });
    expect(config.categories.voice.enabled).toBe(false);
    expect(config.categories.messages.enabled).toBe(true);
  });

  it('Zielkanal: eigener Kanal vor Standard-Kanal, aus = null', () => {
    const config = loggingConfigSchema.parse({
      defaultChannelId: '100000000000000001',
      categories: { messages: { channelId: '100000000000000002' }, voice: { enabled: false } },
    });
    expect(logTarget(config, 'messages')).toBe('100000000000000002');
    expect(logTarget(config, 'members')).toBe('100000000000000001');
    expect(logTarget(config, 'voice')).toBeNull();
  });

  it('ohne Standard-Kanal wird nichts gesendet', () => {
    expect(logTarget(parseLoggingConfig({}), 'messages')).toBeNull();
  });
});
