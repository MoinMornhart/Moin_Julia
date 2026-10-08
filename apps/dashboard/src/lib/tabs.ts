/** Reiter der Ticket-Seiten */
export function ticketsTabs(guildId: string, counts: { panels: number; open: number }) {
  return [
    { key: 'settings', label: 'Einstellungen', href: `/g/${guildId}/tickets` },
    { key: 'panels', label: `Panels (${counts.panels})`, href: `/g/${guildId}/tickets/panels` },
    { key: 'list', label: `Tickets (${counts.open} offen)`, href: `/g/${guildId}/tickets/liste` },
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
