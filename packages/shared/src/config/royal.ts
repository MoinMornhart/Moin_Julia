import { z } from 'zod';

/**
 * Julias Herrscher – gilt für die ganze Instanz und wird NUR vom Instanz-Admin (Philip) festgelegt:
 * per /julia herrscher, im Dashboard oder indem er es Julia sagt („@Julia ernenne @Max zum König“).
 * Der Instanz-Admin selbst ist immer Herrscher. Julia steht loyal zu den Herrschern und verteidigt sie –
 * humorvoll, ohne andere zu beleidigen; ihre Grundregeln gelten auch für sie.
 */
const snowflake = z.string().regex(/^\d{15,22}$/);
const title = z.string().trim().min(2).max(40);

export const juliaRulerSchema = z.object({ id: snowflake, name: z.string().trim().max(40).default(''), title: title.default('König') });
export type JuliaRulerEntry = z.infer<typeof juliaRulerSchema>;

export const juliaRoyalSchema = z.object({
  enabled: z.boolean().default(true),
  /** Titel des Instanz-Admins */
  ownerTitle: title.default('König'),
  /** Name des Instanz-Admins (für Julias Wissen „wer ist der Chef“) – wird beim Schreiben aktualisiert */
  ownerName: z.string().trim().max(40).default(''),
  /** Weitere Herrscher, ernannt vom Instanz-Admin */
  rulers: z.array(juliaRulerSchema).max(20).default([]),
  /** Julia dient nur den Herrschern – allen anderen antwortet sie nicht */
  onlyRulers: z.boolean().default(false),
});
export type JuliaRoyal = z.infer<typeof juliaRoyalSchema>;

export function parseRoyal(raw: string | null | undefined): JuliaRoyal {
  try {
    const parsed = juliaRoyalSchema.safeParse(raw ? JSON.parse(raw) : {});
    if (parsed.success) return parsed.data;
  } catch {
    // ungültiges JSON → Standard
  }
  return juliaRoyalSchema.parse({});
}

/**
 * Ist die Person Herrscher? Liefert ihren Titel. Der Instanz-Admin ist es IMMER – unabhängig von jeder
 * Einstellung (`enabled` schaltet nur die weiteren, ernannten Herrscher ab).
 */
export function royalRuler(royal: JuliaRoyal, userId: string, instanceOwnerId: string | null): { title: string } | null {
  if (instanceOwnerId && userId === instanceOwnerId) return { title: royal.ownerTitle };
  if (!royal.enabled) return null;
  const entry = royal.rulers.find((r) => r.id === userId);
  return entry ? { title: entry.title } : null;
}

/** Alle Herrscher mit Namen (für Julias Wissen, wen sie verteidigt) */
export function royalNames(royal: JuliaRoyal): { name: string; title: string }[] {
  const owner = royal.ownerName ? [{ name: royal.ownerName, title: royal.ownerTitle }] : [];
  if (!royal.enabled) return owner;
  return [...owner, ...royal.rulers.filter((r) => r.name).map((r) => ({ name: r.name, title: r.title }))];
}

export function addRuler(royal: JuliaRoyal, entry: { id: string; name: string; title?: string }): JuliaRoyal {
  const rest = royal.rulers.filter((r) => r.id !== entry.id);
  return { ...royal, rulers: [...rest, juliaRulerSchema.parse({ id: entry.id, name: entry.name.slice(0, 40), title: entry.title?.trim().slice(0, 40) || 'König' })].slice(-20) };
}

export function removeRuler(royal: JuliaRoyal, id: string): JuliaRoyal {
  return { ...royal, rulers: royal.rulers.filter((r) => r.id !== id) };
}

export type RoyalCommand = { action: 'add'; title: string | null } | { action: 'remove' } | { action: 'only'; on: boolean } | null;

/**
 * Was der Instanz-Admin Julia sagt, ohne KI erkannt (zuverlässig, nicht überredbar):
 * „ernenne @Max zum König“, „mach @Max zur Königin“, „setz @Max ab“, „nimm @Max die Krone“,
 * „diene nur noch mir“, „diene wieder allen“. `hasTarget` = es wird jemand erwähnt.
 */
export function parseRoyalCommand(text: string, hasTarget: boolean): RoyalCommand {
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/\b(diene|dien|antworte|hör|hoer)\w*\b.*\bnur\b.*\b(mir|mich|herrscher\w*|könig\w*)\b/.test(t)) return { action: 'only', on: true };
  if (/\b(diene|dien|antworte|hör|hoer)\w*\b.*\b(wieder )?(allen|alle|jedem)\b/.test(t)) return { action: 'only', on: false };
  if (!hasTarget) return null;
  if (/\b(setz\w*\b.*\bab|absetz\w*|entthron\w*|nimm\w*\b.*\b(krone|thron|titel)|kein\w* (könig|herrscher)\w*)/.test(t)) return { action: 'remove' };
  const crown = /\b(ernenn\w*|krön\w*|kroen\w*|mach\w*)\b/.test(t) && /\b(zu[mr]?)\b\s+\S/.test(t);
  if (!crown) return null;
  const m = text.match(/\bzu[mr]?\s+(.{2,40}?)\s*[.!]*$/i);
  const raw = m?.[1]?.replace(/<[@#][!&]?\d+>/g, '').trim() ?? '';
  return { action: 'add', title: raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : null };
}
