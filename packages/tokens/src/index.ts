/**
 * Vigas design tokens — the "Sand & Signal" Graphite theme from the premium design canvas.
 * Shared by the website (CSS variables) and the Android app (StyleSheet values).
 */

export const colors = {
  bg: '#12110F',
  bg2: '#171614',
  surface: '#1C1B18',
  raised: '#24221F',
  strong: '#302D29',
  pillar: '#3A3631',
  code: '#0D0C0B',
  footer: '#0F0E0C',
  ink: '#EFEAE1',
  ink2: '#A9A298',
  /** Muted text. Passes 4.5:1 on bg, surface and raised. */
  ink3: '#958E84',
  line: 'rgba(239,234,225,0.075)',
  line2: 'rgba(239,234,225,0.14)',
  line3: 'rgba(239,234,225,0.24)',
  orange: '#FF6A1A',
  orangeEdge: '#A8420C',
  orangeDeep: '#C9520F',
  orangeText: '#FF8A4C',
  orangeSoft: 'rgba(255,106,26,0.13)',
  onOrange: '#160903',
  sand: '#E3B65C',
  sandDeep: '#B88E3F',
  indigo: '#9A9DFA',
  green: '#6FCF73',
  red: '#F07A72',
  teal: '#5DB7B0',
  blue: '#5B8FD6',
  bar: '#2C5A8F',
} as const;

export type ColorToken = keyof typeof colors;

export const fonts = {
  serif: 'Instrument Serif',
  sans: 'Inter',
  mono: 'JetBrains Mono',
} as const;

export const fontStacks = {
  serif: "'Instrument Serif', Georgia, serif",
  sans: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace",
} as const;

export const radii = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 26, pill: 999 } as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 24: 96 } as const;

/** Brand color and monogram for each model maker, used for avatars. */
export const orgMarks: Record<string, { color: string; letter: string }> = {
  Anthropic: { color: '#E3B65C', letter: 'A' },
  OpenAI: { color: '#6FCF73', letter: 'O' },
  Google: { color: '#5B8FD6', letter: 'G' },
  Meta: { color: '#7AA2F7', letter: 'M' },
  Moonshot: { color: '#5DB7B0', letter: 'K' },
  DeepSeek: { color: '#9A9DFA', letter: 'D' },
  Xiaomi: { color: '#FF8A4C', letter: 'Mi' },
  NVIDIA: { color: '#76B900', letter: 'N' },
  Microsoft: { color: '#5DB7B0', letter: 'M' },
  xAI: { color: '#A9A298', letter: 'X' },
  Mistral: { color: '#FF6A1A', letter: 'M' },
};

export function orgMark(org: string): { color: string; letter: string } {
  return orgMarks[org] ?? { color: colors.ink2, letter: org.slice(0, 1).toUpperCase() || '?' };
}

/** Appends an alpha channel (0–1) to a #RRGGBB color. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

/** CSS custom properties for the web app, e.g. `--vg-orange: #FF6A1A;`. */
export function cssVariables(): string {
  const toKebab = (k: string) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  const lines = Object.entries(colors).map(([k, v]) => `  --vg-${toKebab(k)}: ${v};`);
  lines.push(`  --vg-font-serif: ${fontStacks.serif};`);
  lines.push(`  --vg-font-sans: ${fontStacks.sans};`);
  lines.push(`  --vg-font-mono: ${fontStacks.mono};`);
  return `:root {\n${lines.join('\n')}\n}`;
}
