'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { setModuleEnabled } from '@/app/g/[guildId]/actions';

export function ModuleToggle({
  guildId,
  moduleId,
  enabled,
  disabled,
  label,
}: {
  guildId: string;
  moduleId: string;
  enabled: boolean;
  disabled: boolean;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(enabled);
  const [message, setMessage] = useState<string>();

  const toggle = () => {
    startTransition(async () => {
      setOptimistic(!optimistic);
      const result = await setModuleEnabled(guildId, moduleId, !optimistic);
      setMessage(result.message);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={optimistic}
        aria-label={`${label} ${optimistic ? 'ausschalten' : 'einschalten'}`}
        disabled={disabled || pending}
        onClick={toggle}
        className={`relative h-7 w-12 shrink-0 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40 ${
          optimistic ? 'border-sea-400 bg-sea-500' : 'border-ink-600 bg-ink-800'
        }`}
      >
        <span
          className={`absolute top-0.5 size-5.5 rounded-full shadow transition-all ${
            optimistic ? 'left-[calc(100%-1.5rem)] bg-ink-950' : 'left-0.5 bg-fog-500'
          }`}
        />
      </button>
      {message && <p className="max-w-48 text-right text-[11px] text-sun-400">{message}</p>}
    </div>
  );
}
