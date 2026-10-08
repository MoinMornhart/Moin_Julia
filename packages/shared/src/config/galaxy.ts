/**
 * Auswertung dessen, was ein alter Bot (GalaxyBot o. Ä.) in Discord hinterlassen hat – als reine
 * Funktionen, damit sie testbar sind. Der Scan selbst (Discord-API) liegt im Dashboard (lib/galaxy.ts).
 */

export interface ScannedMessage {
  title: string;
  description: string;
  color: number | null;
  /** Beschriftungen von Auswahl-Optionen und Knöpfen (ohne Link-Knöpfe) – z. B. Ticket-Kategorien */
  options: string[];
  /** Nachricht im neuen Discord-Format (Container statt Embed) */
  componentsV2: boolean;
}

interface RawEmbed {
  title?: string;
  description?: string;
  color?: number;
  author?: { name?: string };
  footer?: { text?: string };
  fields?: { name?: string; value?: string }[];
}

interface RawComponent {
  type: number;
  style?: number;
  label?: string;
  content?: string;
  options?: { label?: string }[];
  components?: RawComponent[];
  accessory?: RawComponent;
  accent_color?: number | null;
}

export interface RawBotMessage {
  embeds?: RawEmbed[];
  components?: RawComponent[];
  flags?: number;
  content?: string;
}

const IS_COMPONENTS_V2 = 1 << 15;
// Discord-Komponententypen
const ACTION_ROW = 1;
const BUTTON = 2;
const STRING_SELECT = 3;
const SECTION = 9;
const TEXT_DISPLAY = 10;
const CONTAINER = 17;
const LINK_STYLE = 5;

/** Alle Komponenten (auch verschachtelt in Containern/Abschnitten) der Reihe nach */
function walk(components: RawComponent[] | undefined, out: RawComponent[] = []): RawComponent[] {
  for (const c of components ?? []) {
    out.push(c);
    if (c.components) walk(c.components, out);
    if (c.accessory) walk([c.accessory], out);
  }
  return out;
}

/** Überschrift aus Markdown („# Titel“ / „**Titel**“) – sonst erste Zeile */
function splitHeading(text: string): { title: string; rest: string } {
  const lines = text.split('\n');
  const first = (lines[0] ?? '').trim();
  const heading = first.match(/^#{1,3}\s+(.+)$/)?.[1] ?? first.match(/^\*\*(.+)\*\*$/)?.[1];
  return heading ? { title: heading.trim(), rest: lines.slice(1).join('\n').trim() } : { title: '', rest: text.trim() };
}

/**
 * Nachricht auswerten: klassisches Embed (Titel, Autor, Beschreibung, Felder, Fußzeile) oder
 * Components V2 (Textbausteine in Containern). Null = nichts Verwertbares (z. B. reine Textnachricht ohne Panel).
 */
export function parseBotMessage(m: RawBotMessage): ScannedMessage | null {
  const all = walk(m.components);
  const options = all
    .flatMap((c) => {
      if (c.type === STRING_SELECT) return (c.options ?? []).map((o) => o.label ?? '');
      if (c.type === BUTTON && c.style !== LINK_STYLE) return [c.label ?? ''];
      return [];
    })
    .map((o) => o.trim())
    .filter(Boolean);
  const uniqueOptions = [...new Set(options)].slice(0, 25);

  const embed = m.embeds?.[0];
  if (embed) {
    const fields = (embed.fields ?? []).filter((f) => f.name || f.value).map((f) => `**${f.name ?? ''}**\n${f.value ?? ''}`.trim());
    const description = [embed.description ?? '', ...fields, embed.footer?.text ? `_${embed.footer.text}_` : ''].filter(Boolean).join('\n\n');
    return {
      title: (embed.title || embed.author?.name || '').slice(0, 256),
      description: description.slice(0, 1500),
      color: embed.color ?? null,
      options: uniqueOptions,
      componentsV2: false,
    };
  }

  const v2 = ((m.flags ?? 0) & IS_COMPONENTS_V2) !== 0 || all.some((c) => c.type === CONTAINER || c.type === TEXT_DISPLAY || c.type === SECTION);
  if (v2) {
    const texts = all.filter((c) => c.type === TEXT_DISPLAY && c.content?.trim()).map((c) => c.content!.trim());
    if (!texts.length && !uniqueOptions.length) return null;
    const { title, rest } = splitHeading(texts[0] ?? '');
    const container = all.find((c) => c.type === CONTAINER);
    return {
      title: title.slice(0, 256),
      description: [rest, ...texts.slice(1)].filter(Boolean).join('\n\n').slice(0, 1500),
      color: container?.accent_color ?? null,
      options: uniqueOptions,
      componentsV2: true,
    };
  }

  // Nur Text + Knöpfe/Menü (ohne Embed) zählt auch als Panel
  if (uniqueOptions.length && m.content?.trim()) {
    const { title, rest } = splitHeading(m.content);
    return { title: title.slice(0, 256), description: rest.slice(0, 1500), color: null, options: uniqueOptions, componentsV2: false };
  }
  return null;
}

// ── AutoMod-Regeln ──────────────────────────────────────────────────────────

export const AUTOMOD_TRIGGER_LABELS: Record<number, string> = {
  1: 'Wortliste',
  3: 'Spam-Erkennung',
  4: 'Vorgefertigte Wortliste (Discord)',
  5: 'Massen-Erwähnungen',
  6: 'Mitgliederprofil',
};

export interface ScannedRule {
  id: string;
  name: string;
  kind: 'keywords' | 'mentions' | 'other';
  /** Lesbare Regel-Art, z. B. „Spam-Erkennung“ */
  typeLabel: string;
  keywords: string[];
  /** Regex-Muster – Moin_Julia übernimmt sie nicht (nur Hinweis) */
  regexCount: number;
  /** Ausnahmen der Wortliste (erlaubte Wörter) */
  allowList: string[];
  mentionLimit: number | null;
  enabled: boolean;
  /** Gibt es etwas zu übernehmen? */
  importable: boolean;
}

export interface RawAutomodRule {
  id: string;
  name: string;
  creator_id: string;
  trigger_type: number;
  enabled?: boolean;
  trigger_metadata?: { keyword_filter?: string[]; regex_patterns?: string[]; allow_list?: string[]; mention_total_limit?: number };
}

export function parseAutomodRule(r: RawAutomodRule): ScannedRule {
  const meta = r.trigger_metadata ?? {};
  const kind = r.trigger_type === 1 ? 'keywords' : r.trigger_type === 5 ? 'mentions' : 'other';
  const keywords = (meta.keyword_filter ?? []).filter((w) => w.trim());
  const mentionLimit = meta.mention_total_limit ?? null;
  return {
    id: r.id,
    name: r.name,
    kind,
    typeLabel: AUTOMOD_TRIGGER_LABELS[r.trigger_type] ?? `Regel-Typ ${r.trigger_type}`,
    keywords,
    regexCount: (meta.regex_patterns ?? []).length,
    allowList: meta.allow_list ?? [],
    mentionLimit,
    enabled: r.enabled !== false,
    importable: (kind === 'keywords' && keywords.length > 0) || (kind === 'mentions' && !!mentionLimit),
  };
}
