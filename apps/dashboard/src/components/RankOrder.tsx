'use client';

import { useState, useTransition } from 'react';
import { orderWarnings, RANK_GROUP_LABELS, rankGroup, suggestOrder, type FixerRole } from '@moin/shared';
import { setRoleOrder } from '@/app/g/[guildId]/raenge/actions';

export type OrderRole = FixerRole & { color: number };

const hex = (c: number) => (c ? `#${c.toString(16).padStart(6, '0')}` : '#8c96ba');

/** Ränge-Fixer (Issue #8): Reihenfolge per Ziehen oder ↑↓ ändern, „Sinnvoll sortieren“, speichern */
export function RankOrder({ guildId, roles }: { guildId: string; roles: OrderRole[] }) {
  const [order, setOrder] = useState(roles);
  const [drag, setDrag] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const changed = order.some((r, i) => r.id !== roles[i]?.id);
  const warnings = orderWarnings(order);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    setOrder(next);
    setMsg(null);
  };

  return (
    <section className="card grid gap-4 p-5" aria-label="Ränge-Fixer">
      <div>
        <h2 className="font-display text-lg font-semibold">🧹 Ränge-Fixer: Reihenfolge</h2>
        <p className="mt-1 text-sm text-fog-300">
          Oben stehende Rollen gewinnen in Discord. Ziehen oder mit ↑↓ verschieben – oder „Sinnvoll sortieren“: Admins → Team → Besondere → Mitglieder. Rollen über der Bot-Rolle
          (und über deiner eigenen) stehen nicht in der Liste.
        </p>
      </div>
      {msg && (
        <p role="status" className={`rounded-xl border px-4 py-3 text-sm ${msg.ok ? 'border-sea-500/40 bg-sea-500/10' : 'border-danger-500/40 bg-danger-500/10'}`}>
          {msg.text}
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="grid gap-1 rounded-xl border border-sun-400/50 bg-sun-400/10 p-3 text-sm" aria-label="Hinweise zur Reihenfolge">
          {warnings.map((w) => (
            <li key={w}>⚠️ {w}</li>
          ))}
        </ul>
      )}
      <ol className="grid gap-1" aria-label="Reihenfolge der Ränge">
        {order.map((r, i) => (
          <li
            key={r.id}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag !== null) move(drag, i);
              setDrag(null);
            }}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${drag === i ? 'border-coral-500' : 'border-ink-800'} cursor-grab bg-ink-900/60`}
            aria-label={`Platz ${i + 1}: ${r.name}`}
          >
            <span className="w-6 text-right text-xs text-fog-500">{i + 1}.</span>
            <span aria-hidden className="text-fog-500">⠿</span>
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: hex(r.color) }} />
            <span className="min-w-0 flex-1 truncate" style={{ color: r.color ? hex(r.color) : undefined }}>
              {r.name}
            </span>
            <span className="hidden text-xs text-fog-500 sm:inline">{RANK_GROUP_LABELS[rankGroup(r)]}</span>
            <button type="button" className="rounded px-1.5 hover:bg-ink-700 disabled:opacity-30" disabled={i === 0 || pending} onClick={() => move(i, i - 1)} aria-label={`${r.name} nach oben`}>
              ↑
            </button>
            <button type="button" className="rounded px-1.5 hover:bg-ink-700 disabled:opacity-30" disabled={i === order.length - 1 || pending} onClick={() => move(i, i + 1)} aria-label={`${r.name} nach unten`}>
              ↓
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost"
          disabled={pending}
          onClick={() => {
            setOrder(suggestOrder(order));
            setMsg({ ok: true, text: 'Vorschlag eingesetzt – prüfen und dann speichern.' });
          }}
        >
          ✨ Sinnvoll sortieren
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={pending || !changed}
          onClick={() =>
            start(async () => {
              const r = await setRoleOrder(
                guildId,
                order.map((x) => x.id),
              );
              setMsg({ ok: r.ok, text: r.message });
            })
          }
        >
          {pending ? '…' : 'Reihenfolge speichern'}
        </button>
        {changed && (
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => setOrder(roles)}>
            Zurücksetzen
          </button>
        )}
      </div>
      <p className="text-xs text-fog-500">Auch in Discord: /raenge verschieben rolle:@Rolle richtung:hoch</p>
    </section>
  );
}
