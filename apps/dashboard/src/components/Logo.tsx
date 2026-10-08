/** Wortmarke: Anker-Welle + „Moin_Julia“. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-coral-500" />
        <path
          d="M7 19c2.2 0 2.2-2 4.5-2s2.3 2 4.5 2 2.2-2 4.5-2 2.3 2 4.5 2"
          className="stroke-ink-950"
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="16" cy="11" r="2.6" className="fill-ink-950" />
      </svg>
      <span className="font-display text-lg font-bold tracking-tight">
        Moin<span className="text-coral-500">_</span>Julia
      </span>
    </span>
  );
}
