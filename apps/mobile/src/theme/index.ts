import { colors as tokens, orgMark, withAlpha } from '@vigas/tokens';

/**
 * App theme: the Graphite tokens from `@vigas/tokens` plus a few values the Android artboards in
 * `design/premium/Android*.dc.html` use inline.
 */
export const colors = {
  ...tokens,
  /** Article body copy. */
  body: '#E6E0D6',
  /** Arena answer copy. */
  bodySoft: '#D9D3C7',
  /** Typographic cover background (under the dot grid). */
  cover: '#151411',
  /** Groove between flutes on neutral pillars. */
  grooveDark: '#2A2724',
  /** Bottom navigation surface. */
  nav: '#171614',
  scrim: 'rgba(18,17,15,0.92)',
} as const;

/**
 * Font family names as registered with `useFonts` in the root layout. Android can't synthesize
 * weights for custom fonts reliably, so every weight is its own family.
 */
export const fonts = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemi: 'JetBrainsMono_600SemiBold',
} as const;

export type FontName = keyof typeof fonts;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, card: 22, xxl: 26, pill: 999 } as const;

/** Horizontal page gutter used by every Android artboard. */
export const GUTTER = 20;

/** Tinted background + foreground for a monogram avatar (`#RRGGBB` + 15% alpha, like the design's `c + '26'`). */
export function tint(color: string): { bg: string; fg: string } {
  return { bg: withAlpha(color, 0.15), fg: color };
}

export { orgMark, withAlpha };
