/**
 * Dashboard „🍼 Für Dummies“ (Wunsch Philip, 14.10.): Umschalter oben rechts (pro Person, Cookie).
 * Modulnamen, Beschreibungen und Bereichs-Überschriften super einfach erklärt – freundlich, nie gemein.
 * Was hier nicht steht, bleibt wie gewohnt.
 */
export const MODULE_DUMMIES: Record<string, { name: string; description: string }> = {
  allgemein: { name: 'Hallo-Knopf', description: 'Damit siehst du, ob der Bot wach ist – wie „Hallo, bist du da?“ 👋' },
  logging: { name: 'Tagebuch', description: 'Der Bot schreibt alles auf, was passiert: wer kommt, wer geht, was gelöscht wurde – wie ein Tagebuch 📔' },
  moderation: { name: 'Schiedsrichter', description: 'Gelbe Karten, kurz auf die Bank setzen oder vom Platz stellen – wie beim Fußball 🟨🟥' },
  schutz: { name: 'Türsteher', description: 'Passt auf, dass keine Bösen reinkommen und niemand alles kaputt macht 🚪🛡️' },
  willkommen: { name: 'Begrüßung', description: 'Sagt neuen Leuten „Hallo!“ und gibt ihnen Namensschilder (Rollen) 🎉' },
  tempvoice: { name: 'Eigene Sprech-Zimmer', description: 'Jeder kann sich ein eigenes Zimmer zum Reden bauen – und es abschließen 🔑' },
  tickets: { name: 'Hilfe-Schalter', description: 'Wer Hilfe braucht, zieht eine Nummer und bekommt ein eigenes Zimmer mit dem Team 🛎️' },
  team: { name: 'Mitmachen im Team', description: 'Leute können sich bewerben – wie für einen Job, nur in klein 📝' },
  alerts: { name: 'Bescheid sagen', description: 'Sagt Bescheid, wenn jemand live geht oder ein neues Video hat 📣' },
  level: { name: 'Punkte sammeln', description: 'Wer schreibt und redet, sammelt Punkte und steigt Stufen hoch – wie im Spiel 🎮' },
  community: { name: 'Spiel & Spaß', description: 'Umfragen, Gewinnspiele, Geburtstage und Ideen-Kasten 🎈' },
  julia: { name: 'Julia (die sprechende Freundin)', description: 'Julia ist eine KI – man kann ihr Fragen stellen und sie antwortet, wie eine schlaue Freundin 🤖💬' },
  statistiken: { name: 'Zahlen & Kurven', description: 'Zeigt, wie viel los ist – wie ein Fieberthermometer für den Server 📈' },
  musik: { name: 'Musikbox', description: 'Der Bot spielt Lieder und Radio im Sprachkanal – wie eine Jukebox 🎵' },
  owner: { name: 'Chef-Zimmer', description: 'Ein geheimer Raum nur für den Chef (Owner) – mit Schloss 🔒👑' },
};

export const GROUP_DUMMIES: Record<string, string> = {
  Verwaltung: 'Aufpassen & Ordnung',
  Community: 'Spaß zusammen',
  'Julia KI': 'Julia, die schlaue Freundin',
  Werkzeuge: 'Werkzeugkiste 🧰',
};

/**
 * Fachwörter in den Bereichen (Feldnamen, Hinweise, Knöpfe) → einfache Wörter. Ganze Wörter, Groß-/Kleinschreibung
 * wie im Original; zusammengesetzte Wörter stehen vor ihren Teilen („Log-Kanal“ vor „Kanal“).
 */
export const TERM_DUMMIES: [string, string][] = [
  ['Mod-Log-Kanal', 'Schiedsrichter-Tagebuch-Raum'],
  ['Log-Kanäle', 'Tagebuch-Räume'],
  ['Log-Kanal', 'Tagebuch-Raum'],
  ['Sprachkanälen', 'Sprech-Räumen'],
  ['Sprachkanäle', 'Sprech-Räume'],
  ['Sprachkanal', 'Sprech-Raum'],
  ['Textkanälen', 'Schreib-Räumen'],
  ['Textkanäle', 'Schreib-Räume'],
  ['Textkanal', 'Schreib-Raum'],
  ['Kanälen', 'Räumen'],
  ['Kanäle', 'Räume'],
  ['Kanals', 'Raums'],
  ['Kanal', 'Raum'],
  ['Kategorien', 'Schubladen'],
  ['Kategorie', 'Schublade'],
  ['Rollen', 'Namensplaketten'],
  ['Rolle', 'Namensplakette'],
  ['Berechtigungen', 'Erlaubnisse'],
  ['Berechtigung', 'Erlaubnis'],
  ['Rechten', 'Erlaubnissen'],
  ['Rechte', 'Erlaubnisse'],
  ['Mitgliedern', 'Leuten'],
  ['Mitglieder', 'Leute'],
  ['Moderatoren', 'Aufpasser'],
  ['Moderator', 'Aufpasser'],
  ['Administratoren', 'Oberchefs'],
  ['Administrator', 'Oberchef'],
  ['Admins', 'Chefs'],
  ['Admin', 'Chef'],
  ['Owner', 'Besitzer'],
  ['Verwarnungen', 'Gelbe Karten'],
  ['Verwarnung', 'Gelbe Karte'],
  ['Timeouts', 'Auszeiten'],
  ['Timeout', 'Auszeit'],
  ['Webhooks', 'Brief-Roboter'],
  ['Webhook', 'Brief-Roboter'],
  ['Embeds', 'Info-Kästchen'],
  ['Embed', 'Info-Kästchen'],
  ['Platzhalter', 'Lückenfüller'],
  ['Vorlagen', 'Bastelvorlagen'],
  ['Vorlage', 'Bastelvorlage'],
  ['Einstellungen', 'Knöpfe & Schalter'],
  ['Panels', 'Knopf-Bretter'],
  ['Panel', 'Knopf-Brett'],
  ['Module', 'Programme'],
  ['Modul', 'Programm'],
  ['Cooldown', 'Wartezeit'],
  ['Limit', 'Maximum'],
  ['Limits', 'Maxima'],
];

const TERM_PATTERNS = TERM_DUMMIES.map(([from, to]) => ({ re: new RegExp(`(?<![\\p{L}\\p{N}-])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'gu'), to }));

/** Text einfach machen (für „Für Dummies“) – nur ganze Wörter */
export function simplifyText(text: string): string {
  let out = text;
  for (const { re, to } of TERM_PATTERNS) out = out.replace(re, to);
  return out;
}

/** Name/Beschreibung eines Moduls je nach Anzeige */
export function moduleLabel(meta: { id: string; name: { de: string }; description: { de: string } }, dummies: boolean): { name: string; description: string } {
  const d = dummies ? MODULE_DUMMIES[meta.id] : undefined;
  return d ?? { name: meta.name.de, description: meta.description.de };
}
