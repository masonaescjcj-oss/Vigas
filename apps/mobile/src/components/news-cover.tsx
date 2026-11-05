import type { Cover } from '@vigas/core';
import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { colors } from '@/theme';

import { T } from './text';

/** `radial-gradient(rgba(239,234,225,.1) 1px, transparent 1.2px)` tiled every `spacing` px. */
export function DotGrid({ spacing = 12, opacity = 0.1 }: { spacing?: number; opacity?: number }) {
  const id = `dots${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <Pattern id={id} patternUnits="userSpaceOnUse" width={spacing} height={spacing}>
          <Circle cx={spacing / 2} cy={spacing / 2} r={1} fill={colors.ink} fillOpacity={opacity} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

export interface NewsCoverProps {
  cover: Cover;
  variant?: 'card' | 'thumb';
  style?: StyleProp<ViewStyle>;
}

/** Typographic cover: a big figure and a small caption on a dot grid — no photos. */
export function NewsCover({ cover, variant = 'card', style }: NewsCoverProps) {
  const card = variant === 'card';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[card ? styles.card : styles.thumb, style]}
    >
      <DotGrid spacing={card ? 12 : 10} />
      <T f="mono" size={12} color={colors.ink3} numberOfLines={1} adjustsFontSizeToFit>
        {cover.caption}
      </T>
      <T f="serif" size={card ? 54 : 30} lh={1} color={cover.color} numberOfLines={1} adjustsFontSizeToFit>
        {cover.big}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 136,
    backgroundColor: colors.cover,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  thumb: {
    width: 92,
    height: 92,
    borderRadius: 14,
    backgroundColor: colors.cover,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
});
