/**
 * Dashboard „🍼 Für Dummies“ (Wunsch Philip, 14.10.): Umschalter oben rechts (pro Person, Cookie).
 * Seit 0.65.0 „für 1 IQ und weniger“: ganz kurze Wörter, Baby-Sprache, viele Emojis – freundlich, nie gemein.
 * Was hier nicht steht, bleibt wie gewohnt.
 */
export const MODULE_DUMMIES: Record<string, { name: string; description: string }> = {
  allgemein: { name: 'Hallo-Knopf', description: 'Bot wach? Drück und guck! 👀👋' },
  logging: { name: 'Tagebuch', description: 'Bot schreibt alles auf. Wer kommt? Wer geht? ✍️📔' },
  moderation: { name: 'Schiedsrichter', description: 'Frech? Gelbe Karte! 🟨 Ganz frech? Rote Karte! 🟥' },
  schutz: { name: 'Türsteher', description: 'Böse Leute? Bleiben draußen! 💪🚫' },
  willkommen: { name: 'Hallo sagen', description: 'Neue Leute da? Bot ruft „Hallooo!“ 🎉👋' },
  tempvoice: { name: 'Quatsch-Zimmer', description: 'Bau dir ein Zimmer zum Reden. Tür zu geht auch! 🚪🔑' },
  tickets: { name: 'Hilfe-Schalter', description: 'Aua? Hilfe? Klingeln! 🛎️ Dann kommt wer. 🙋' },
  team: { name: 'Mitmachen', description: 'Du willst helfen? Hier Hand heben! 🙋📝' },
  alerts: { name: 'Bescheid sagen', description: 'Wer ist live? Bot ruft: „Guckt mal!“ 📣📺' },
  level: { name: 'Punkte sammeln', description: 'Schreiben = Punkte ⭐ Viele Punkte = toll! 🎮' },
  community: { name: 'Spiel & Spaß', description: 'Abstimmen, gewinnen, Geburtstag feiern! 🎈🎂' },
  julia: { name: 'Julia', description: 'Julia ist ein schlauer Computer. Frag was – sie sagt was! 🤖💬' },
  statistiken: { name: 'Zahlen', description: 'Guck mal, wie viel los ist! Viel = toll! 📈🥳' },
  musik: { name: 'Musikbox', description: 'Bot macht Musik. Lalala! 🎵🎶' },
  owner: { name: 'Chef-Zimmer', description: 'Nur für den Chef. Psst! 🤫👑' },
};

export const GROUP_DUMMIES: Record<string, string> = {
  Verwaltung: 'Aufpassen 👮',
  Community: 'Spaß 🎈',
  'Julia KI': 'Julia 🤖',
  Werkzeuge: 'Werkzeugkiste 🧰',
};

/**
 * Ganze Texte (Überschriften, Kästen, Reiter, Knöpfe) → Baby-Sprache. Passt nur, wenn der GANZE Text so heißt
 * (Leerzeichen am Rand egal) – wird vor den Fachwörtern geprüft.
 */
export const PHRASE_DUMMIES: Record<string, string> = {
  // Statistik (Wunsch Philip: „diese Fenster sind noch zu schlau“)
  Mitgliederzahl: '👥 So viele Leute sind da',
  'Mitgliederzahl pro Tag': '👥 So viele Leute sind da',
  'Beitritte & Austritte': '🚪 Rein & raus',
  'Beitritte – Austritte': '🚪 Rein minus raus',
  'Beitritte und Austritte pro Tag': '🚪 Rein & raus',
  'Nachrichten pro Tag': '💬 So viel wurde geschrieben',
  'Sprachminuten pro Tag': '🎤 So lange wurde gequatscht',
  'Stunden im Sprachkanal': '🎤 Stunden gequatscht',
  Nachrichten: '💬 Geschrieben',
  Mitglieder: '👥 Leute',
  'Aktivste Mitglieder': '🏆 Die Plappermäuler',
  'kein Vergleich': '🤷 weiß nicht',
  'Statistik-Kanäle': '📺 Zahlen-Schilder',
  'Neuen Statistik-Kanal anlegen': '➕ Neues Zahlen-Schild',
  'Diese Kanäle nicht mitzählen': '🙈 Hier nicht zählen',
  Erfassung: '📝 Mitzählen',
  Zeitraum: '📅 Wie lange?',
  '7 Tage': '7× schlafen 😴',
  '30 Tage': '30× schlafen 😴',
  '90 Tage': '90× schlafen 😴',
  // Überall
  Übersicht: '👀 Gucken',
  Verwaltung: 'Aufpassen 👮',
  Exportieren: '📦 Mitnehmen',
  Aktiv: '✅ An',
  Inaktiv: '😴 Aus',
  Speichern: '💾 Merken!',
  Gespeichert: '✅ Gemerkt!',
  'Gespeichert.': '✅ Gemerkt!',
  Abbrechen: '🙅 Doch nicht',
  Löschen: '🗑️ Weg damit',
  Entfernen: '🗑️ Weg damit',
  Bearbeiten: '✏️ Ändern',
  Hinzufügen: '➕ Dazu!',
  Zurücksetzen: '🔄 Wie vorher',
  Vorschau: '👀 So sieht’s aus',
  'Vorschau wie in Discord': '👀 So sieht’s aus',
  Beschreibung: '📝 Was ist das?',
  Titel: '🏷️ Name oben',
  Farbe: '🎨 Farbe',
  Status: '🚦 Wie geht’s?',
  'Wer darf': '🙋 Wer darf?',
  'Was man beachten muss': '⚠️ Aufpassen!',
  'Was passiert': '🤔 Was passiert?',
  'Weitere Bereiche': '➡️ Noch mehr',
  Darstellung: '🎨 Aussehen',
  Sekunden: 'Sekündchen',
  'Server verwalten': '🏠 Server aufräumen',
};

/** Texte mit Zahlen (z. B. „+113 im Zeitraum“, „-1 % zum Zeitraum davor“) */
const PHRASE_PATTERNS: { re: RegExp; to: (m: RegExpMatchArray) => string }[] = [
  { re: /^([+\-−]?)(\d[\d.,]*) % zum Zeitraum davor$/u, to: (m) => (m[1] === '-' || m[1] === '−' ? `📉 ${m[2]} % weniger als vorher` : m[2] === '0' ? '😐 gleich wie vorher' : `📈 ${m[2]} % mehr als vorher`) },
  { re: /^([+\-−]?\d[\d.,]*) im Zeitraum$/u, to: (m) => `${m[1]} in der Zeit` },
  { re: /^(\d[\d.,]*) rein · (\d[\d.,]*) raus$/u, to: (m) => `🚶‍➡️ ${m[1]} rein · 🚶 ${m[2]} raus` },
];

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
  ['Limits', 'Maxima'],
  ['Limit', 'Maximum'],
  ['Statistiken', 'Zählereien'],
  ['Statistik', 'Zählerei'],
  ['Zeitraum', 'Zeit'],
  ['Beitritte', 'Reinkommer'],
  ['Austritte', 'Rausgeher'],
  ['Automatisch', 'Ganz von allein'],
  ['automatisch', 'ganz von allein'],
  ['optional', 'muss nicht'],
  ['Optional', 'Muss nicht'],
  ['deaktiviert', 'aus 😴'],
  ['aktiviert', 'an ✅'],
];

const TERM_PATTERNS = TERM_DUMMIES.map(([from, to]) => ({ re: new RegExp(`(?<![\\p{L}\\p{N}-])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'gu'), to }));

/** Text einfach machen (für „Für Dummies“): erst ganze Sätze/Überschriften, sonst einzelne Wörter */
export function simplifyText(text: string): string {
  const core = text.trim();
  if (!core) return text;
  const lead = text.slice(0, text.indexOf(core));
  const tail = text.slice(text.indexOf(core) + core.length);
  const phrase = PHRASE_DUMMIES[core];
  if (phrase !== undefined) return lead + phrase + tail;
  // Überschrift mit eigenem Emoji davor („👥 Mitgliederzahl“): Baby-Text bringt sein Emoji selbst mit
  const icon = core.match(/^[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+\s+/u);
  const iconPhrase = icon ? PHRASE_DUMMIES[core.slice(icon[0].length)] : undefined;
  if (icon && iconPhrase !== undefined) return lead + (/^\p{Extended_Pictographic}/u.test(iconPhrase) ? iconPhrase : icon[0] + iconPhrase) + tail;
  for (const { re, to } of PHRASE_PATTERNS) {
    const m = core.match(re);
    if (m) return lead + to(m) + tail;
  }
  let out = text;
  for (const { re, to } of TERM_PATTERNS) out = out.replace(re, to);
  return out;
}

/** Name/Beschreibung eines Moduls je nach Anzeige */
export function moduleLabel(meta: { id: string; name: { de: string }; description: { de: string } }, dummies: boolean): { name: string; description: string } {
  const d = dummies ? MODULE_DUMMIES[meta.id] : undefined;
  return d ?? { name: meta.name.de, description: meta.description.de };
}
