/** Versionen vergleichen (0.8.10 ist neuer als 0.8.9); unbekannte Formate gelten als „nicht neuer“. */
export function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => v.trim().replace(/^v/, '').split('.').map((n) => Number.parseInt(n, 10));
  const a = parse(latest);
  const b = parse(current);
  if (a.some(Number.isNaN) || b.some(Number.isNaN)) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}
