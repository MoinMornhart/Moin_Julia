import { z } from 'zod';

/**
 * Julia-Werkzeuge (Issue #4, „Tool Calling“): Julia kann Aktionen VORSCHLAGEN – jemandem eine
 * Privatnachricht schicken, jemanden timeouten, einen Kanal anlegen. Ausgeführt wird nur, wenn
 *  1. der Server es eingeschaltet hat (Standard: aus),
 *  2. die fragende Person die passenden Discord-Rechte hat (geprüft im Code, nicht vom Modell) und
 *  3. sie den Bestätigungs-Knopf drückt.
 * Ziele (Personen) müssen in der Nachricht erwähnt sein – Julia kann sich niemanden „ausdenken“.
 */
export const JULIA_TOOLS = ['dm', 'timeout', 'kanal'] as const;
export type JuliaTool = (typeof JULIA_TOOLS)[number];

/** Nötiges Discord-Recht pro Werkzeug (Name wie in PermissionFlagsBits) */
export const JULIA_TOOL_PERMISSION: Record<JuliaTool, 'ModerateMembers' | 'ManageChannels'> = {
  dm: 'ModerateMembers',
  timeout: 'ModerateMembers',
  kanal: 'ManageChannels',
};

export const JULIA_TOOL_LABELS: Record<JuliaTool, string> = {
  dm: 'Privatnachricht an eine Person schicken',
  timeout: 'Person timeouten',
  kanal: 'Kanal anlegen',
};

export const juliaToolsSchema = z
  .object({
    enabled: z.boolean().default(false),
    allowed: z.array(z.enum(JULIA_TOOLS)).max(JULIA_TOOLS.length).default([...JULIA_TOOLS]),
  })
  .default({ enabled: false, allowed: [...JULIA_TOOLS] });
export type JuliaToolsConfig = z.infer<typeof juliaToolsSchema>;

/** Höchstens 28 Tage (Discord-Grenze) */
export const MAX_TIMEOUT_MINUTES = 28 * 24 * 60;

export type JuliaAction =
  | { kind: 'dm'; userId: string; text: string }
  | { kind: 'timeout'; userId: string; minutes: number; reason: string }
  | { kind: 'kanal'; name: string; voice: boolean };

/** Welche Werkzeuge darf diese Person nutzen? `has` prüft ein Discord-Recht. */
export function toolsFor(tools: JuliaToolsConfig, has: (permission: (typeof JULIA_TOOL_PERMISSION)[JuliaTool]) => boolean): JuliaTool[] {
  if (!tools.enabled) return [];
  return JULIA_TOOLS.filter((tool) => tools.allowed.includes(tool) && has(JULIA_TOOL_PERMISSION[tool]));
}

/** Kanalname wie Discord ihn für Textkanäle will: klein, Bindestriche, keine Sonderzeichen */
export function channelSlug(name: string, voice = false): string {
  const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, 100);
  if (voice) return trimmed.replace(/[@#<>`]/g, '').trim();
  return trimmed
    .toLowerCase()
    .replace(/\s/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

const cleanText = (s: string, max: number) => s.replace(/\s+/g, ' ').replaceAll('@everyone', '@​everyone').replaceAll('@here', '@​here').trim().slice(0, max);

/** Eine Markierung „aktion: timeout | 123… | 10 | Grund“ lesen (ohne die eckigen Klammern) */
export function parseAction(body: string): JuliaAction | null {
  const [kindRaw = '', ...rest] = body.split('|').map((p) => p.trim());
  const kind = kindRaw.toLowerCase();
  const userId = (rest[0] ?? '').replace(/[<@!>]/g, '');
  if (kind === 'dm' || kind === 'nachricht') {
    const text = cleanText(rest.slice(1).join(' | '), 1000);
    return /^\d{15,22}$/.test(userId) && text ? { kind: 'dm', userId, text } : null;
  }
  if (kind === 'timeout') {
    const minutes = Math.round(Number((rest[1] ?? '').replace(',', '.')));
    if (!/^\d{15,22}$/.test(userId) || !Number.isFinite(minutes) || minutes < 1) return null;
    return { kind: 'timeout', userId, minutes: Math.min(minutes, MAX_TIMEOUT_MINUTES), reason: cleanText(rest.slice(2).join(' | '), 300) };
  }
  if (kind === 'kanal' || kind === 'channel') {
    const voice = /^(sprache|voice|sprachkanal)$/i.test(rest[1] ?? '');
    const name = channelSlug(rest[0] ?? '', voice);
    return name ? { kind: 'kanal', name, voice } : null;
  }
  return null;
}

/** „[[aktion: …]]“ aus der Antwort ziehen (höchstens 3 pro Antwort) */
export function extractActions(text: string): { text: string; actions: JuliaAction[] } {
  const actions: JuliaAction[] = [];
  const clean = text
    .replace(/\[\[\s*aktion\s*:\s*([^\]]{1,1200})\]\]/gi, (_m, body: string) => {
      const action = parseAction(body);
      if (action) actions.push(action);
      return '';
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text: clean, actions: actions.slice(0, 3) };
}

/**
 * Darf diese Aktion vorgeschlagen werden? Werkzeug erlaubt + Ziel in der Nachricht erwähnt.
 * (Rangfolge, Bot-Rechte usw. prüft der Bot erst beim Ausführen.)
 */
export function actionAllowed(action: JuliaAction, tools: readonly JuliaTool[], targetIds: readonly string[]): boolean {
  if (!tools.includes(action.kind)) return false;
  if (action.kind === 'kanal') return true;
  return targetIds.includes(action.userId);
}

/** Zusatz für den System-Prompt – nur wenn die Person mindestens ein Werkzeug nutzen darf */
export function actionsPrompt(tools: readonly JuliaTool[], targets: readonly { id: string; name: string }[]): string {
  if (!tools.length) return '';
  const clean = (s: string) => s.replace(/[[\]\n|"]/g, '').slice(0, 40);
  const lines = [
    '- Diese Person darf dich um Aktionen bitten (Ausnahme zur Regel „du kannst nur schreiben“). Du führst sie nicht selbst aus: Du schlägst sie mit einer Markierung am Ende deiner Antwort vor, die Person bestätigt dann per Knopf. Nur wenn sie ausdrücklich darum bittet, nie von dir aus. Sag in deiner Antwort kurz, was du vorschlägst.',
  ];
  if (tools.includes('dm')) lines.push('  • Privatnachricht: [[aktion: dm | <ID> | Text der Nachricht]]');
  if (tools.includes('timeout')) lines.push('  • Timeout: [[aktion: timeout | <ID> | Minuten | Grund]]');
  if (tools.includes('kanal')) lines.push('  • Kanal anlegen: [[aktion: kanal | name | text]] oder [[aktion: kanal | Name | sprache]]');
  if (tools.some((x) => x !== 'kanal')) {
    lines.push(
      targets.length
        ? `  Personen (nur diese, mit genau dieser ID): ${targets.map((t) => `${clean(t.name)} = ${t.id}`).join(', ')}`
        : '  Personen-Aktionen gehen nur, wenn die Person in der Nachricht mit @ erwähnt wird – bitte sonst darum.',
    );
  }
  return lines.join('\n');
}

/** Lesbare Beschreibung für die Bestätigungs-Nachricht */
export function describeAction(action: JuliaAction): string {
  if (action.kind === 'dm') return `📨 Privatnachricht an <@${action.userId}>:\n> ${action.text.slice(0, 500)}`;
  if (action.kind === 'timeout') {
    const d = action.minutes >= 1440 && action.minutes % 1440 === 0 ? `${action.minutes / 1440} Tag(e)` : action.minutes >= 60 && action.minutes % 60 === 0 ? `${action.minutes / 60} Stunde(n)` : `${action.minutes} Minute(n)`;
    return `⏳ Timeout für <@${action.userId}>: ${d}${action.reason ? ` – Grund: ${action.reason}` : ''}`;
  }
  return `${action.voice ? '🔊 Sprachkanal' : '💬 Textkanal'} anlegen: **${action.name}**`;
}
