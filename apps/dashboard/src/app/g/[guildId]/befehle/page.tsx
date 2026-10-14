import { COMMAND_CATALOG, commandNote, commandPermissionLabel, JULIA_SENTENCES, MODULES } from '@moin/shared';
import { CommandList, type CommandView } from '@/components/CommandList';
import { requireGuildAccess } from '@/lib/access';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Befehle' };

/** Befehls-Übersicht (Wunsch Philip, 13.10.): alle Befehle nach Modul, durchsuchbar, mit „Was man beachten muss“ */
export default async function CommandsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  await requireGuildAccess(guildId);
  const stored = await db().guildModule.findMany({ where: { guildId }, select: { moduleId: true, enabled: true } });
  const enabled = (id: string) => stored.find((s) => s.moduleId === id)?.enabled ?? MODULES.find((m) => m.id === id)?.defaultEnabled ?? false;

  const commands: CommandView[] = COMMAND_CATALOG.map((c) => ({ ...c, who: commandPermissionLabel(c.permissions), note: commandNote(c.name) }));
  const modules = [
    ...MODULES.filter((m) => commands.some((c) => c.module === m.id)).map((m) => ({ id: m.id, icon: m.icon, name: m.name.de, on: m.id === 'allgemein' ? true : enabled(m.id) })),
    // Kern-Befehle (z. B. /moin zugang) stehen nicht im Modul-Katalog, sind aber immer da
    ...(commands.some((c) => c.module === 'kern') ? [{ id: 'kern', icon: '⚙️', name: 'Kern', on: true }] : []),
  ];

  return (
    <div className="grid max-w-6xl gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold">📖 Befehle</h1>
        <p className="mt-1 text-sm text-fog-300">
          Alle {commands.length} Befehle des Bots – nach Modul sortiert. Pro Modul eine Tabelle „Was man beachten muss“: wer den Befehl nutzen darf, was der Bot dafür braucht,
          Voraussetzungen und ob man es rückgängig machen kann. Die Liste kommt direkt aus den Befehlen des Bots und ist immer aktuell.
        </p>
      </header>
      <CommandList commands={commands} modules={modules} sentences={JULIA_SENTENCES} />
    </div>
  );
}
