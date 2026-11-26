/**
 * Vigas design tokens — the "Obsidian Signal" 2026 visual language.
 * Shared by the website (CSS variables) and mobile surfaces.
 */

export const colors = {
  bg: '#0A0A0B',
  bg2: '#101012',
  surface: '#141416',
  raised: '#1B1B1E',
  strong: '#26262A',
  pillar: '#26262A',
  code: '#070708',
  footer: '#08080A',
  ink: '#F5F3EF',
  ink2: '#A6A5AB',
  /** Muted text with clear contrast on obsidian surfaces. */
  ink3: '#6F6E76',
  line: 'rgba(255,255,255,0.07)',
  line2: 'rgba(255,255,255,0.12)',
  line3: 'rgba(255,255,255,0.22)',
  orange: '#FF5A1F',
  orangeEdge: '#C73D0B',
  orangeDeep: '#FF4D14',
  orangeText: '#FF7A45',
  orangeSoft: 'rgba(255,90,31,0.13)',
  onOrange: '#FFFFFF',
  sand: '#E3B65C',
  sandDeep: '#B88E3F',
  indigo: '#8F8CFF',
  green: '#3EE39B',
  red: '#FF6B81',
  teal: '#5DB7B0',
  blue: '#5CC8FF',
  bar: '#2C5A8F',
} as const;

export type ColorToken = keyof typeof colors;

export const fonts = {
  serif: 'Instrument Serif',
  display: 'Bricolage Grotesque',
  sans: 'Geist',
  mono: 'Geist Mono',
} as const;

export const fontStacks = {
  serif: "'Instrument Serif', Georgia, serif",
  display: "'Bricolage Grotesque', 'Vazirmatn', ui-sans-serif, system-ui, sans-serif",
  sans: "'Geist', 'Vazirmatn', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'Geist Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace",
} as const;

export const radii = { sm: 8, md: 14, lg: 18, xl: 24, xxl: 28, pill: 999 } as const;

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
  SpaceXAI: { color: '#A9A298', letter: 'X' },
  Mistral: { color: '#FF6A1A', letter: 'M' },
  Alibaba: { color: '#FF8A4C', letter: 'Q' },
  'Z.ai': { color: '#5DB7B0', letter: 'Z' },
  MiniMax: { color: '#9A9DFA', letter: 'MM' },
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
