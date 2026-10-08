/** Kleine SVG-Diagramme ohne Bibliothek – skalieren mit der Breite, Tooltips über <title>. */

const fmt = (n: number) => n.toLocaleString('de-DE');
const shortDay = (d: string) => `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.`;

function ticks(days: string[]): number[] {
  if (days.length <= 1) return [0];
  const step = Math.max(1, Math.ceil(days.length / 6));
  const out: number[] = [];
  for (let i = 0; i < days.length; i += step) out.push(i);
  if (out.at(-1) !== days.length - 1) out.push(days.length - 1);
  return out;
}

/** Säulen (ein oder zwei Reihen, z. B. Beitritte/Austritte) */
export function BarChart({ days, series, label }: { days: string[]; series: { name: string; values: number[]; color: string }[]; label: string }) {
  const W = 600;
  const H = 160;
  const pad = { l: 34, r: 6, t: 8, b: 22 };
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const slot = (W - pad.l - pad.r) / Math.max(1, days.length);
  const bw = Math.max(1, (slot * 0.8) / series.length);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} className="stroke-ink-800" strokeWidth={1} />
          <text x={pad.l - 6} y={y(max * f) + 4} textAnchor="end" className="fill-fog-500 text-[10px]">
            {fmt(Math.round(max * f))}
          </text>
        </g>
      ))}
      {days.map((d, i) =>
        series.map((s, k) => {
          const v = s.values[i] ?? 0;
          const x = pad.l + i * slot + slot * 0.1 + k * bw;
          return (
            <rect key={`${d}-${s.name}`} x={x} y={y(v)} width={bw} height={Math.max(0, H - pad.b - y(v))} rx={Math.min(2, bw / 2)} fill={s.color}>
              <title>{`${shortDay(d)} · ${s.name}: ${fmt(v)}`}</title>
            </rect>
          );
        }),
      )}
      {ticks(days).map((i) => (
        <text key={i} x={pad.l + i * slot + slot / 2} y={H - 6} textAnchor="middle" className="fill-fog-500 text-[10px]">
          {shortDay(days[i] ?? '')}
        </text>
      ))}
    </svg>
  );
}

/** Linie mit Fläche (z. B. Mitgliederzahl) – Tage ohne Wert (0) werden übersprungen */
export function LineChart({ days, values, color, label }: { days: string[]; values: number[]; color: string; label: string }) {
  const W = 600;
  const H = 160;
  const pad = { l: 44, r: 6, t: 8, b: 22 };
  const known = values.map((v, i) => ({ v, i })).filter((p) => p.v > 0);
  if (known.length < 2) return <p className="py-10 text-center text-sm text-fog-500">Noch zu wenig Daten – nach ein paar Tagen erscheint hier die Kurve.</p>;
  const min = Math.min(...known.map((p) => p.v));
  const max = Math.max(...known.map((p) => p.v));
  const lo = Math.max(0, min - Math.max(1, (max - min) * 0.15));
  const hi = max + Math.max(1, (max - min) * 0.1);
  const x = (i: number) => pad.l + ((W - pad.l - pad.r) * i) / Math.max(1, days.length - 1);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
  const line = known.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(known.at(-1)!.i).toFixed(1)},${H - pad.b} L${x(known[0]!.i).toFixed(1)},${H - pad.b} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      {[lo, (lo + hi) / 2, hi].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className="stroke-ink-800" strokeWidth={1} />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="fill-fog-500 text-[10px]">
            {fmt(Math.round(v))}
          </text>
        </g>
      ))}
      <path d={area} fill={color} opacity={0.15} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {known.map((p) => (
        <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={days.length > 40 ? 0 : 2.5} fill={color}>
          <title>{`${shortDay(days[p.i] ?? '')}: ${fmt(p.v)}`}</title>
        </circle>
      ))}
      {ticks(days).map((i) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-fog-500 text-[10px]">
          {shortDay(days[i] ?? '')}
        </text>
      ))}
    </svg>
  );
}
