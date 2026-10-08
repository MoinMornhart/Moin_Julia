/** Reiter der Ticket-Seiten */
export function ticketsTabs(guildId: string, counts: { panels: number; open: number }) {
  return [
    { key: 'settings', label: 'Einstellungen', href: `/g/${guildId}/tickets` },
    { key: 'panels', label: `Panels (${counts.panels})`, href: `/g/${guildId}/tickets/panels` },
    { key: 'list', label: `Tickets (${counts.open} offen)`, href: `/g/${guildId}/tickets/liste` },
  ];
}

/** Reiter der Team-Seiten (Bewerbungssystem) */
export function teamTabs(guildId: string, counts: { pending: number; probation: number }) {
  return [
    { key: 'inbox', label: `Bewerbungen (${counts.pending})`, href: `/g/${guildId}/team` },
    { key: 'positions', label: 'Stellen', href: `/g/${guildId}/team/stellen` },
    { key: 'probation', label: `Probezeit (${counts.probation})`, href: `/g/${guildId}/team/probezeit` },
    { key: 'settings', label: 'Einstellungen', href: `/g/${guildId}/team/einstellungen` },
  ];
}

/** Reiter der Vorlagen-Seiten */
export function vorlagenTabs(guildId: string) {
  return [
    { key: 'transfer', label: 'Export & Import', href: `/g/${guildId}/vorlagen` },
    { key: 'galaxy', label: 'Von GalaxyBot', href: `/g/${guildId}/vorlagen/galaxybot` },
    { key: 'backups', label: 'Sicherungen', href: `/g/${guildId}/vorlagen/sicherungen` },
    { key: 'images', label: 'Bilder', href: `/g/${guildId}/vorlagen/bilder` },
  ];
}

/** Reiter des Social-Media-Moduls */
export function alertsTabs(guildId: string, feeds: number) {
  return [
    { key: 'feeds', label: `Kanäle (${feeds})`, href: `/g/${guildId}/alerts` },
    { key: 'connections', label: 'Verbindungen', href: `/g/${guildId}/alerts/verbindungen` },
  ];
}

/** Reiter des Level-Moduls */
export function levelTabs(guildId: string) {
  return [
    { key: 'board', label: 'Bestenliste', href: `/g/${guildId}/level` },
    { key: 'rewards', label: 'Belohnungen', href: `/g/${guildId}/level/belohnungen` },
    { key: 'settings', label: 'Einstellungen', href: `/g/${guildId}/level/einstellungen` },
  ];
}

/** Reiter des Community-Moduls */
export function communityTabs(guildId: string, counts: { suggestions: number; giveaways: number }) {
  return [
    { key: 'settings', label: 'Einstellungen', href: `/g/${guildId}/community` },
    { key: 'suggestions', label: `Vorschläge (${counts.suggestions})`, href: `/g/${guildId}/community/vorschlaege` },
    { key: 'giveaways', label: `Giveaways (${counts.giveaways})`, href: `/g/${guildId}/community/giveaways` },
    { key: 'birthdays', label: 'Geburtstage', href: `/g/${guildId}/community/geburtstage` },
  ];
}

/** Reiter des Julia-Moduls */
export function juliaTabs(guildId: string) {
  return [
    { key: 'settings', label: 'Einstellungen', href: `/g/${guildId}/julia` },
    { key: 'modes', label: 'Modi', href: `/g/${guildId}/julia/modi` },
    { key: 'profiles', label: 'Profile', href: `/g/${guildId}/julia/profile` },
    { key: 'connection', label: 'Verbindung', href: `/g/${guildId}/julia/verbindung` },
  ];
}
