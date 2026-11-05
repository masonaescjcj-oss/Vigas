import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { colors, fonts, type FontName } from '@/theme';

export interface TProps extends TextProps {
  /** Font face. Defaults to Inter regular. */
  f?: FontName;
  size?: number;
  color?: string;
  /** Line height as a multiple of `size`. */
  lh?: number;
  /** Letter spacing in em, like the CSS in the design files. */
  ls?: number;
  align?: TextStyle['textAlign'];
  upper?: boolean;
}

const DEFAULT_LH: Record<FontName, number> = {
  serif: 1.15,
  serifItalic: 1.15,
  sans: 1.45,
  sansMedium: 1.45,
  sansSemi: 1.45,
  mono: 1.35,
  monoMedium: 1.35,
  monoSemi: 1.35,
};

/** Base text. Every string in the app goes through this so fonts and colors stay on-token. */
export function T({ f = 'sans', size = 15, color = colors.ink, lh, ls, align, upper, style, ...rest }: TProps) {
  return (
    <Text
      maxFontSizeMultiplier={1.35}
      {...rest}
      style={[
        styles.base,
        {
          fontFamily: fonts[f],
          fontSize: size,
          lineHeight: Math.round(size * (lh ?? DEFAULT_LH[f])),
          color,
          letterSpacing: ls ? ls * size : undefined,
          textAlign: align,
          textTransform: upper ? 'uppercase' : undefined,
        },
        style,
      ]}
    />
  );
}

/** Small uppercase mono label (`.lbl` in the design). */
export function Label({ color = colors.ink3, ...rest }: TProps) {
  return <T f="monoMedium" size={12} lh={1.3} ls={0.12} upper color={color} {...rest} />;
}

/** Instrument Serif section heading (h2 in the artboards). */
export function Heading({ size = 24, ...rest }: TProps) {
  return <T f="serif" size={size} lh={1.1} accessibilityRole="header" {...rest} />;
}

const styles = StyleSheet.create({
  base: { includeFontPadding: false },
});
