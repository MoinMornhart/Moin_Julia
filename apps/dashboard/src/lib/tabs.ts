/** Reiter der Vorlagen-Seiten */
export function vorlagenTabs(guildId: string) {
  return [
    { key: 'transfer', label: 'Export & Import', href: `/g/${guildId}/vorlagen` },
    { key: 'galaxy', label: 'Von GalaxyBot', href: `/g/${guildId}/vorlagen/galaxybot` },
    { key: 'backups', label: 'Sicherungen', href: `/g/${guildId}/vorlagen/sicherungen` },
    { key: 'images', label: 'Bilder', href: `/g/${guildId}/vorlagen/bilder` },
  ];
}
