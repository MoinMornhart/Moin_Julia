import type { BotModule } from '../core/types.js';
import { allgemeinModule } from './allgemein/index.js';
import { loggingModule } from './logging/index.js';
import { moderationModule } from './moderation/index.js';
import { schutzModule } from './schutz/index.js';
import { tempvoiceModule } from './tempvoice/index.js';
import { willkommenModule } from './willkommen/index.js';

/** Alle Bot-Module. Neue Module hier eintragen (und im Katalog in @moin/shared). */
export const botModules: BotModule[] = [allgemeinModule, loggingModule, moderationModule, schutzModule, willkommenModule, tempvoiceModule];
