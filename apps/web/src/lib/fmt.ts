/**
 * Client-safe display helpers. They mirror the formatters in @vigas/core: client components must not
 * import runtime values from that package, because its barrel pulls zod into the browser bundle.
 */

export function formatUsd(micros: number, opts: { free?: boolean; maxDecimals?: number } = {}): string {
  if (opts.free && micros === 0) return 'Free';
  const usd = micros / 1_000_000;
  const abs = Math.abs(usd);
  let decimals = 2;
  if (abs > 0 && abs < 0.01) decimals = Math.min(opts.maxDecimals ?? 6, Math.max(4, Math.ceil(-Math.log10(abs)) + 1));
  const s = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: decimals });
  return `${usd < 0 ? '−' : ''}$${s}`;
}

export function formatPricePerMillion(microsPerMillion: number): string {
  return microsPerMillion === 0 ? 'Free' : formatUsd(microsPerMillion, { maxDecimals: 4 });
}

export function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${Number((tokens / 1_000_000).toFixed(1))}M`;
  return `${Math.round(tokens / 1000)}K`;
}

export function formatCompact(n: number): string {
  const f = (v: number, unit: string) => `${v >= 100 ? Math.round(v) : Number(v.toFixed(1))}${unit}`;
  if (n >= 1e9) return f(n / 1e9, 'B');
  if (n >= 1e6) return f(n / 1e6, 'M');
  if (n >= 1e3) return f(n / 1e3, 'k');
  return String(n);
}

export function initials(name: string): string {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, 2)
    .join('');
}

export function timeAgo(date: Date | string, now: Date = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const s = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (s < 60) return 'now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

/** "5 Nov" in UTC. */
export function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
