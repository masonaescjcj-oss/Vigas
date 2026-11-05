import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, orgMark, tint } from '@/theme';

import { T } from './text';

export interface MonogramProps {
  letter: string;
  color: string;
  size?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Tinted rounded square with a serif letter — tools, model makers. */
export function Monogram({ letter, color, size = 42, radius = 12, style }: MonogramProps) {
  const t = tint(color);
  const fontSize = Math.round(size * (letter.length > 1 ? 0.36 : 0.46));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { width: size, height: size, borderRadius: radius, backgroundColor: t.bg }, style]}
    >
      <T f="serif" size={fontSize} lh={1} color={t.fg}>
        {letter}
      </T>
    </View>
  );
}

export function OrgMonogram({ org, ...rest }: Omit<MonogramProps, 'letter' | 'color'> & { org: string }) {
  const m = orgMark(org);
  return <Monogram letter={m.letter} color={m.color} {...rest} />;
}

/** Round initials avatar (account, article author). */
export function Avatar({ text, size = 34, color = colors.sand }: { text: string; size?: number; color?: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}
    >
      <T f="sansSemi" size={13} lh={1} color={colors.onOrange}>
        {text}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
