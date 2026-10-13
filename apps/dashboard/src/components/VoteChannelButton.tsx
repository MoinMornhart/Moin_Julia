'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createVoteChannel } from '@/app/g/[guildId]/community/actions';

/** „📊 Abstimmungs-Kanal anlegen“: der Bot legt einen Nur-abstimmen-Kanal neben dem Vorschlags-Kanal an und trägt ihn ein */
export function VoteChannelButton({ guildId, boardId, disabled, onCreated }: { guildId: string; boardId: string; disabled?: boolean; onCreated?: (id: string) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn-ghost px-3 py-1.5 text-xs"
        disabled={pending || disabled}
        title="Legt neben dem Vorschlags-Kanal einen Kanal an, in dem man nur abstimmen kann – und trägt ihn hier ein"
        onClick={() =>
          start(async () => {
            const r = await createVoteChannel(guildId, boardId);
            setMsg({ ok: r.ok, text: r.message ?? '' });
            if (r.ok && r.id) {
              onCreated?.(r.id);
              router.refresh();
            }
          })
        }
      >
        {pending ? '…' : '📊 Abstimmungs-Kanal anlegen'}
      </button>
      {msg && <span className={`text-xs ${msg.ok ? 'text-sea-400' : 'text-danger-500'}`}>{msg.text}</span>}
    </span>
  );
}
