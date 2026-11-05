import { formatUsd, timeAgo } from '@vigas/core';

/** "Claude Opus 5.5 (Max)" → "Claude Opus 5.5". */
export function baseModelName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '');
}

/** Compact label for pillars and the podium: "Claude Opus 5.5 (Max)" → "Opus 5.5". */
export function pillarName(name: string): string {
  return baseModelName(name).replace(/^Claude\s+/, '');
}

/** "12 MIN", "2 H", "NOW" — the news-river timestamp style. */
export function agoLabel(iso: string): string {
  return timeAgo(iso).toUpperCase();
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Thursday · 5 Nov". */
export function dayLabel(d: Date = new Date()): string {
  return `${WEEKDAYS[d.getDay()]} · ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "5 Nov". */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** One-letter weekday for usage bars ("M", "T", …). */
export function weekdayLetter(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '·' : (WEEKDAYS[d.getDay()] ?? '·').slice(0, 1);
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Up late.';
  if (h < 12) return 'Good morning.';
  if (h < 18) return 'Good afternoon.';
  return 'Good evening.';
}

export function pct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

export const usd = (micros: number) => formatUsd(micros);

export function usdFromDollars(dollars: number | null | undefined): string {
  if (dollars === null || dollars === undefined) return '—';
  return formatUsd(Math.round(dollars * 1_000_000));
}

export function intl(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Card headline: the clause before " — " or ". " when the title has a subtitle-like tail
 * ("Inference prices fell 38% this quarter. Here’s who…" → "Inference prices fell 38% this quarter").
 */
export function shortTitle(title: string): string {
  const m = /^(.{24,}?)(?: — |\. )(.{12,})$/.exec(title);
  return m ? m[1]! : title;
}

/** Splits an article title into its main clause and the part after an em dash (set in italic sand). */
export function splitTitle(title: string): [string, string | null] {
  const i = title.indexOf(' — ');
  if (i < 12) return [title, null];
  return [title.slice(0, i), title.slice(i + 3)];
}

/** Unique value for the `t` route param, so following the same link twice re-applies its params. */
export function navStamp(): string {
  return Date.now().toString(36);
}
